class ImportMagic {
    private readonly TEXTURE_SIZE = 4096;
    private originalRulerUnits: Units | undefined;
    private documentName: string | undefined;
    private tileInfo: ITileInfo | undefined;
    private movedLayers: number = 0;
    private skippedLayers: number = 0;
    
    constructor() {
        if (!app.documents.length)
            this.fail('No document to work with.');

        if (this.hasBackgroundLayer())
            this.fail('Documents with a background layer are not supported.');

        this.initRulerUnits();
        this.getDocumentName();
        this.getTileInfo();
        this.setDocDimensions();
        this.moveTextures();
        this.finish();
    }

    private hasBackgroundLayer(): boolean {
        // Ugh, Adobe, what are you doing?!
        try { 
            app.activeDocument.backgroundLayer; 

            return true; 
        } catch(error) { 
            return false; 
        }
    }

    private initRulerUnits(): void {
        this.originalRulerUnits = app.preferences.rulerUnits;
        app.preferences.rulerUnits = Units.PIXELS;
    }

    private restoreRulerUnits(): void {
        if (typeof this.originalRulerUnits !== 'undefined')
            app.preferences.rulerUnits = this.originalRulerUnits;
    }

    private getDocumentName(): void {
        this.documentName = this.stripExtensionFromName(app.activeDocument.name);
    }

    private stripExtensionFromName(name: string): string {
        return name.split('.')[0];
    }

    private getTileInfo(): void {
        try {
            if (typeof this.documentName === 'undefined')
                throw '';
            
            this.tileInfo = this.parseTileInfoFromDocName(this.documentName);
        } catch (error) {
            this.fail('Could not parse needed info from filename. Make sure it is named like "+33+126_17".');
        }
    }

    private parseTileInfoFromDocName(docName: string): ITileInfo {
        const regex: RegExp = /([+-]\d{1,3})/g;
        const latLon: RegExpMatchArray | null = docName.match(regex);
        const zoom: string | undefined = docName.split('_')[1];
    
        if (latLon === null || latLon?.length <= 1 || typeof zoom === 'undefined')
            throw '';

        return {lat: parseInt(latLon[0], 10), lon: parseInt(latLon[1], 10), zoom: parseInt(zoom, 10)};
    }

    private setDocDimensions(): void {
        const texturesCounts: ITexCount = this.getTexturesCounts();
        const xDimension: number = this.calcDimension(texturesCounts.x);
        const yDimension: number = this.calcDimension(texturesCounts.y);
        
        app.activeDocument.resizeCanvas(xDimension, yDimension)
    }
    
    private getTexturesCounts(): ITexCount {
        const textureCoords: ITexCoords = this.getTextureCoords(this.tileInfo!.zoom);
        const xTexturesCount: number = (textureCoords.right - textureCoords.left) / 16 + 1;
        const yTexturesCount: number = (textureCoords.bottom - textureCoords.top) / 16 + 1;
    
        return {x: xTexturesCount, y: yTexturesCount};
    }
    
    private calcDimension(texturesCount: number): number {
        return texturesCount * this.TEXTURE_SIZE;
    }
    
    private getTextureCoords(zoom: number): ITexCoords {
        const leftTop: ITexCoord = this.wgs84_to_texture(this.tileInfo!.lat + 1, this.tileInfo!.lon, zoom);
        const rightBottom: ITexCoord = this.wgs84_to_texture(this.tileInfo!.lat, this.tileInfo!.lon + 1, zoom);
    
        return {left: leftTop.x, top: leftTop.y, right: rightBottom.x, bottom: rightBottom.y};
    }
    
    private wgs84_to_texture(lat: number, lon: number, zoom: number): ITexCoord {
        const ratio_x: number = lon / 180;           
        const ratio_y: number = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / Math.PI;
        const pic_x: number = (ratio_x + 1) * Math.pow(2, (zoom + 7));
        const pic_y: number = (1 - ratio_y) * Math.pow(2, (zoom + 7));
        const tile_x: number = Math.floor(pic_x / 256);
        const tile_y: number = Math.floor(pic_y / 256);
        const tex_x: number = Math.floor(tile_x / 16) * 16;
        const tex_y: number = Math.floor(tile_y / 16) * 16;
        
        return {x: tex_x, y: tex_y};
    }

    private moveTextures(): void {
        const layers: Layers = app.activeDocument.layers;
        const positionDivider: number = 16;
    
        for (var i = 0; i < layers.length; i++) {
            const texInfo: ITexInfo | null = this.getLayerInfo(layers[i]);
            
            if (texInfo === null) {
                this.skippedLayers++;
                continue;
            }

            // For placing higher ZL than document
            const positionDividerMultiplier: number = Math.pow(2, texInfo.tex_zoom - this.tileInfo!.zoom);
    
            const textureCoords: ITexCoords = this.getTextureCoords(texInfo.tex_zoom);
            const xPos = (texInfo.tex_x - textureCoords.left) / (positionDivider * positionDividerMultiplier);
            let yPos = (texInfo.tex_y - textureCoords.top) / (positionDivider * positionDividerMultiplier);
    
            // No idea why this offset is needed
            if ((texInfo.tex_zoom - this.tileInfo!.zoom) >= 2) {
                yPos += 1 / positionDividerMultiplier;
            }
    
            this.moveLayerTo(layers[i], xPos, yPos);
    
            // For placing higher ZL than document
            if (texInfo.tex_zoom !== this.tileInfo!.zoom) {
                this.scaleLayer(layers[i], positionDividerMultiplier);
            }
        }
    }

    private getLayerInfo(layer: Layer): ITexInfo | null {
        const splitName: string[] = layer.name.split('_');

        // Exactly three parts are expected
        if (splitName.length !== 3)
            return null;

        const tex_y: number = parseInt(splitName[0], 10);
        const tex_x: number = parseInt(splitName[1], 10);
        const tex_zoom: number = parseInt(splitName[2].slice(-2), 10)

        // All three parts are expected to be numbers
        if (isNaN(tex_x) || isNaN(tex_y) || isNaN(tex_zoom))
            return null;

        // Some sanity check for supported zoom levels
        if (tex_zoom < this.tileInfo!.zoom || tex_zoom > 19)
            return null;

        return {tex_x, tex_y, tex_zoom};
    }

    private moveLayerTo(layer: Layer, x: number, y: number): void {
        const bounds: UnitRect = layer.bounds;
        const x_pos: number | UnitValue = (x * this.TEXTURE_SIZE) - <number>bounds[0];
        const y_pos: number | UnitValue = (y * this.TEXTURE_SIZE) - <number>bounds[1];
                
        // Only move layer it it needs to move
        if (x_pos === 0 && y_pos === 0) {
            this.skippedLayers++
            return;
        }
    
        layer.translate(-x_pos, -y_pos);
        this.movedLayers++
    }
    
    private scaleLayer(layer: Layer, divider: number): void {
        var bounds: UnitRect = layer.bounds;
        var width = <number>bounds[2] - <number>bounds[0];
    
        // Only resize if it is not yet resized
        if (width !== this.TEXTURE_SIZE)
            return;
    
        var imageScalePercentage = (1 / divider) * 100;
        layer.resize(imageScalePercentage, imageScalePercentage, AnchorPosition.TOPLEFT);
    }

    private fail(error: string): void {
        this.restoreRulerUnits();

        throw new Error(error);
    }

    private finish(): void {
        this.restoreRulerUnits();

        alert(`Operation finished.\n\nMoved Layers: ${this.movedLayers}\nSkipped Layers: ${this.skippedLayers}`);
    }
}

const importMagic: ImportMagic = new ImportMagic();
