class ExportMagic {
    private readonly MAX_ZOOM: number = 19;
    private readonly PROC_START_SNAPSHOT_NAME: string = 'PROCSTART';
    private readonly EXPORT_OPTIONS: JPEGSaveOptions = new JPEGSaveOptions();
    private cTID: (str: string) => number = (str: string) => app.charIDToTypeID(str);
    private sTID: (str: string) => number = (str: string) => app.stringIDToTypeID(str);

    private originalRulerUnits: Units | undefined;
    private documentName: string | undefined;
    private tileInfo: ITileInfo | undefined;
    private zoomGroups: ITexZoomGroups = {};

    constructor() {
        this.checkPreconditions();
        this.initRulerUnits();
        this.setExportOptions();
        this.getDocumentName();
        this.getTileInfo();
        this.groupTexByZoom();
        this.processTextures();
        this.finish();
    }

    private checkPreconditions(): void {
        if (!app.documents.length) this.fail('No document to work with.');

        if (!app.activeDocument.saved) this.fail('Please save your document first before starting the export.');

        if (this.hasBackgroundLayer()) this.fail('Documents with a background layer are not supported.');
    }

    private hasBackgroundLayer(): boolean {
        // Ugh, Adobe, what are you doing?!
        try {
            app.activeDocument.backgroundLayer;

            return true;
        } catch (error) {
            return false;
        }
    }

    private initRulerUnits(): void {
        this.originalRulerUnits = app.preferences.rulerUnits;
        app.preferences.rulerUnits = Units.PIXELS;
    }

    private restoreRulerUnits(): void {
        if (typeof this.originalRulerUnits !== 'undefined') app.preferences.rulerUnits = this.originalRulerUnits;
    }

    private setExportOptions(): void {
        this.EXPORT_OPTIONS.embedColorProfile = true;
        // Somewhat higher than input JPEG, because lossyness
        this.EXPORT_OPTIONS.quality = 9;
        this.EXPORT_OPTIONS.formatOptions = FormatOptions.STANDARDBASELINE;
        this.EXPORT_OPTIONS.matte = MatteType.NONE;
    }

    private getDocumentName(): void {
        this.documentName = this.stripExtensionFromName(app.activeDocument.name);
    }

    private stripExtensionFromName(name: string): string {
        return name.split('.')[0];
    }

    private getTileInfo(): void {
        try {
            if (typeof this.documentName === 'undefined') throw '';

            this.tileInfo = this.parseTileInfoFromDocName(this.documentName);
        } catch (error) {
            this.fail('Could not parse needed info from filename. Make sure it is named like "+33+126_17".');
        }
    }

    private parseTileInfoFromDocName(docName: string): ITileInfo {
        const regex = /([+-]\d{1,3})/g;
        const latLon: RegExpMatchArray | null = docName.match(regex);
        const zoom: string | undefined = docName.split('_')[1];

        if (latLon === null || latLon?.length <= 1 || typeof zoom === 'undefined') throw '';

        return {
            lat: parseInt(latLon[0], 10),
            lon: parseInt(latLon[1], 10),
            zoom: parseInt(zoom, 10),
        };
    }

    private groupTexByZoom(): void {
        const layers: Layers = app.activeDocument.layers;

        // Type 'Layers' is not an array type or a string type or does not have a '[Symbol.iterator]()' method that returns an iterator.
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < layers.length; i++) {
            const texInfo: ITexInfo | null = this.getLayerInfo(layers[i]);

            if (texInfo === null) continue;

            // eslint-disable-next-line no-prototype-builtins
            if (!this.zoomGroups.hasOwnProperty(texInfo.tex_zoom.toString())) this.zoomGroups[texInfo.tex_zoom] = [];

            this.zoomGroups[texInfo.tex_zoom].push(layers[i]);
        }
    }

    private processTextures(): void {
        this.setHistoryState(this.PROC_START_SNAPSHOT_NAME);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        for (let i: number = this.tileInfo!.zoom; i <= this.MAX_ZOOM; i++) {
            // eslint-disable-next-line no-prototype-builtins
            if (!this.zoomGroups.hasOwnProperty(i.toString())) continue;

            const zoomGroup: Layer[] = this.zoomGroups[i];

            for (const layer of zoomGroup) {
                this.setActiveSnapshot(this.PROC_START_SNAPSHOT_NAME);
                this.clearCanvas(layer, i);

                app.activeDocument.crop(layer.bounds);

                if (i !== this.tileInfo?.zoom) this.resizeCanvas(i);

                this.exportCanvas(layer);
            }
        }
    }

    private exportCanvas(layer: Layer): void {
        const document: Document = app.activeDocument;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const ortho4xpName: string = this.documentName!.split('_')[0];
        const providerName: string = this.getProviderDirectoryName(layer.name);
        const destination = new Folder(`${document.path.toString()}/orthomagic4ps/${ortho4xpName}/${providerName}`);

        if (!destination.exists) destination.create();

        const file: File = new File(`${destination.toString()}/${layer.name}.jpg`);

        document.saveAs(file, this.EXPORT_OPTIONS, true, Extension.LOWERCASE);
    }

    private getProviderDirectoryName(name: string): string {
        const nameParts: string[] = name.split('_');
        const providerPart: string = nameParts[2];
        const provider: string = providerPart.slice(0, -2);
        const zoom: string = providerPart.slice(-2);

        return `${provider}_${zoom}`;
    }

    /** It's faster to delete all other layers on every iteration and then crop and resize,
     * than cropping and resizing the document with all layers/smart objects for every iteration.
     * Also deleting all invisible layers at once is very much faster than deleting every layer on its own.
     */
    private clearCanvas(currentLayer: Layer, currentZoom: number): void {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        for (let i: number = this.tileInfo!.zoom; i <= this.MAX_ZOOM; i++) {
            // eslint-disable-next-line no-prototype-builtins
            if (!this.zoomGroups.hasOwnProperty(i.toString())) continue;

            const zoomGroup: Layer[] = this.zoomGroups[i];

            for (const layer of zoomGroup) {
                if (
                    layer.name === currentLayer.name ||
                    (i > currentZoom && this.isLayerOverlapping(currentLayer, layer))
                )
                    continue;

                // If there are linked layers, remove them as well.
                // Special case for using cut masks - see wiki.
                if (layer.linkedLayers.length > 0)
                    for (const linkedLayer of layer.linkedLayers) linkedLayer.visible = false;

                layer.visible = false;
            }
        }

        this.deleteHiddenLayers();
    }

    private isLayerOverlapping(currentLayer: Layer, overlapLayer: Layer): boolean {
        const cLeft: number | UnitValue = currentLayer.bounds[0];
        const cTop: number | UnitValue = currentLayer.bounds[1];
        const cRight: number | UnitValue = currentLayer.bounds[2];
        const cBottom: number | UnitValue = currentLayer.bounds[3];

        const oLeft: number | UnitValue = overlapLayer.bounds[0];
        const oTop: number | UnitValue = overlapLayer.bounds[1];
        const oRight: number | UnitValue = overlapLayer.bounds[2];
        const oBottom: number | UnitValue = overlapLayer.bounds[3];

        return cLeft < oRight && oLeft < cRight && cTop < oBottom && oTop < cBottom;
    }

    private deleteHiddenLayers(): void {
        const descriptor: ActionDescriptor = new ActionDescriptor();
        const reference: ActionReference = new ActionReference();

        reference.putEnumerated(this.sTID('layer'), this.sTID('ordinal'), this.sTID('hidden'));
        descriptor.putReference(this.sTID('null'), reference);

        app.executeAction(this.sTID('delete'), descriptor, DialogModes.NO);
    }

    /** Each layer needs to be resized separately after crop, otherwise the document would easily end up
     * with several hundred thousand pixels dimensions - and Photoshop does not like that
     */
    private resizeCanvas(zoom: number): void {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const zoomDiff: number = zoom - this.tileInfo!.zoom;
        const multiplier: number = Math.pow(2, zoomDiff);
        const width: number | UnitValue = app.activeDocument.width;
        const height: number | UnitValue = app.activeDocument.height;

        app.activeDocument.resizeImage(<number>width * multiplier, <number>height * multiplier);
    }

    private setHistoryState(name: string): void {
        const descriptor: ActionDescriptor = new ActionDescriptor();
        const reference1: ActionReference = new ActionReference();
        const reference2: ActionReference = new ActionReference();

        reference1.putClass(this.cTID('SnpS'));
        descriptor.putReference(this.cTID('null'), reference1);
        reference2.putProperty(this.cTID('HstS'), this.cTID('CrnH'));
        descriptor.putReference(this.cTID('From'), reference2);
        descriptor.putString(this.cTID('Nm  '), name);
        descriptor.putEnumerated(this.cTID('Usng'), this.cTID('HstS'), this.cTID('FllD'));

        app.executeAction(this.cTID('Mk  '), descriptor, DialogModes.NO);
    }

    private clearHistoryStates(): void {
        this.setActiveSnapshot(this.PROC_START_SNAPSHOT_NAME);

        // Type 'HistoryStates' is not an array type or a string type or does not have a '[Symbol.iterator]()' method that returns an iterator.
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < app.activeDocument.historyStates.length; i++) {
            const state: HistoryState = app.activeDocument.historyStates[i];

            if (!state.snapshot) continue;

            if (state.name === this.PROC_START_SNAPSHOT_NAME) this.removeSnapshot(state.name);
        }
    }

    private getSnapshot(name: string): HistoryState | undefined {
        // Ugh, Adobe.
        try {
            return app.activeDocument.historyStates.getByName(name);
        } catch (error) {
            return undefined;
        }
    }

    private setActiveSnapshot(name: string): void {
        const snapshot: HistoryState | undefined = this.getSnapshot(name);

        if (typeof snapshot !== 'undefined') app.activeDocument.activeHistoryState = snapshot;
    }

    private removeSnapshot(name: string): void {
        const descriptor: ActionDescriptor = new ActionDescriptor();
        const reference: ActionReference = new ActionReference();

        reference.putName(this.cTID('SnpS'), name);
        descriptor.putReference(this.cTID('null'), reference);

        app.executeAction(this.cTID('Dlt '), descriptor, DialogModes.NO);
    }

    private getLayerInfo(layer: Layer): ITexInfo | null {
        const splitName: string[] = layer.name.split('_');

        // Exactly three parts are expected
        if (splitName.length !== 3) return null;

        const tex_y: number = parseInt(splitName[0], 10);
        const tex_x: number = parseInt(splitName[1], 10);
        const tex_zoom: number = parseInt(splitName[2].slice(-2), 10);

        // All three parts are expected to be numbers
        if (isNaN(tex_x) || isNaN(tex_y) || isNaN(tex_zoom)) return null;

        // Some sanity check for supported zoom levels
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (tex_zoom < this.tileInfo!.zoom || tex_zoom > 19) return null;

        return {tex_x, tex_y, tex_zoom};
    }

    private fail(error: string): void {
        this.restoreRulerUnits();
        this.clearHistoryStates();

        throw new Error(error);
    }

    private finish(): void {
        this.restoreRulerUnits();
        this.clearHistoryStates();

        alert(`Operation finished.`);
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const exportMagic = new ExportMagic();
