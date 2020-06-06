class ExportMagic {
    private readonly MAX_ZOOM: number = 19;
    private readonly PROC_START_SNAPSHOT_NAME: string = 'PROCSTART';
    private cTID: (str: string) => number = (str: string) => app.charIDToTypeID(str);
    private sTID: (str: string) => number = (str: string) => app.stringIDToTypeID(str);

    private originalRulerUnits: Units | undefined;
    private documentName: string | undefined;
    private tileInfo: ITileInfo | undefined;
    private zoomGroups: ITexZoomGroups = {};

    constructor() {
        this.checkPreconditions();
        this.initRulerUnits();
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

        for (let i: number = this.tileInfo!.zoom; i <= this.MAX_ZOOM; i++) {
            // eslint-disable-next-line no-prototype-builtins
            if (!this.zoomGroups.hasOwnProperty(i.toString())) continue;

            // if (i !== this.tileInfo!.zoom) this.resizeCanvas(i);

            const zoomGroup: Layer[] = this.zoomGroups[i];

            for (const layer of zoomGroup) {
                this.setActiveSnapshot(this.PROC_START_SNAPSHOT_NAME);
                this.clearCanvas(layer);

                app.activeDocument.crop(layer.bounds);

                // ToDo: Resize when higher zoom level
                // ToDo: Export
            }
        }
    }

    /** It's faster to delete all other layers on every iteration and then crop and resize,
     * than cropping and resizing the document with all layers/smart objects for every iteration.
     * Also deleting all invisible layers at once is very much faster than deleting every layer on its own.
     */
    private clearCanvas(currentLayer: Layer): void {
        for (let i: number = this.tileInfo!.zoom; i <= this.MAX_ZOOM; i++) {
            // eslint-disable-next-line no-prototype-builtins
            if (!this.zoomGroups.hasOwnProperty(i.toString())) continue;

            const zoomGroup: Layer[] = this.zoomGroups[i];

            for (const layer of zoomGroup) {
                if (layer.name === currentLayer.name) continue;

                // If there are linked layers, remove them as well.
                // Special case for using cut masks - see wiki.
                if (layer.linkedLayers.length > 0)
                    for (const linkedLayer of layer.linkedLayers) linkedLayer.visible = false;

                layer.visible = false;
            }
        }

        this.deleteHiddenLayers();
    }

    private deleteHiddenLayers(): void {
        const descriptor: ActionDescriptor = new ActionDescriptor();
        const reference: ActionReference = new ActionReference();

        reference.putEnumerated(this.sTID('layer'), this.sTID('ordinal'), this.sTID('hidden'));
        descriptor.putReference(this.sTID('null'), reference);

        app.executeAction(this.sTID('delete'), descriptor, DialogModes.NO);
    }

    private resizeCanvas(zoom: number): void {
        const zoomDiff: number = zoom - this.tileInfo!.zoom;
        const multiplier: number = Math.pow(2, zoomDiff);
        const width: number | UnitValue = app.activeDocument.width;
        const height: number | UnitValue = app.activeDocument.height;

        // app.activeDocument.resizeImage(<number>width * multiplier, <number>height * multiplier);

        // alert(`${<number>width * multiplier}, ${<number>height * multiplier}`);
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

            // ToDo: delete further named snapshots that have been created, if there are any
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
