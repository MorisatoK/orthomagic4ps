"use strict";
var ImportMagic = (function () {
    function ImportMagic() {
        this.TEXTURE_SIZE = 4096;
        this.movedLayers = 0;
        this.skippedLayers = 0;
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
    ImportMagic.prototype.hasBackgroundLayer = function () {
        try {
            app.activeDocument.backgroundLayer;
            return true;
        }
        catch (error) {
            return false;
        }
    };
    ImportMagic.prototype.initRulerUnits = function () {
        this.originalRulerUnits = app.preferences.rulerUnits;
        app.preferences.rulerUnits = Units.PIXELS;
    };
    ImportMagic.prototype.restoreRulerUnits = function () {
        if (typeof this.originalRulerUnits !== 'undefined')
            app.preferences.rulerUnits = this.originalRulerUnits;
    };
    ImportMagic.prototype.getDocumentName = function () {
        this.documentName = this.stripExtensionFromName(app.activeDocument.name);
    };
    ImportMagic.prototype.stripExtensionFromName = function (name) {
        return name.split('.')[0];
    };
    ImportMagic.prototype.getTileInfo = function () {
        try {
            if (typeof this.documentName === 'undefined')
                throw '';
            this.tileInfo = this.parseTileInfoFromDocName(this.documentName);
        }
        catch (error) {
            this.fail('Could not parse needed info from filename. Make sure it is named like "+33+126_17".');
        }
    };
    ImportMagic.prototype.parseTileInfoFromDocName = function (docName) {
        var regex = /([+-]\d{1,3})/g;
        var latLon = docName.match(regex);
        var zoom = docName.split('_')[1];
        if (latLon === null || (latLon === null || latLon === void 0 ? void 0 : latLon.length) <= 1)
            throw '';
        return { lat: parseInt(latLon[0], 10), lon: parseInt(latLon[1], 10), zoom: parseInt(zoom, 10) };
    };
    ImportMagic.prototype.setDocDimensions = function () {
        var texturesCounts = this.getTexturesCounts();
        var xDimension = this.calcDimension(texturesCounts.x);
        var yDimension = this.calcDimension(texturesCounts.y);
        app.activeDocument.resizeCanvas(xDimension, yDimension);
    };
    ImportMagic.prototype.getTexturesCounts = function () {
        var textureCoords = this.getTextureCoords(this.tileInfo.zoom);
        var xTexturesCount = (textureCoords.right - textureCoords.left) / 16 + 1;
        var yTexturesCount = (textureCoords.bottom - textureCoords.top) / 16 + 1;
        return { x: xTexturesCount, y: yTexturesCount };
    };
    ImportMagic.prototype.calcDimension = function (texturesCount) {
        return texturesCount * this.TEXTURE_SIZE;
    };
    ImportMagic.prototype.getTextureCoords = function (zoom) {
        var leftTop = this.wgs84_to_texture(this.tileInfo.lat + 1, this.tileInfo.lon, zoom);
        var rightBottom = this.wgs84_to_texture(this.tileInfo.lat, this.tileInfo.lon + 1, zoom);
        return { left: leftTop.x, top: leftTop.y, right: rightBottom.x, bottom: rightBottom.y };
    };
    ImportMagic.prototype.wgs84_to_texture = function (lat, lon, zoom) {
        var ratio_x = lon / 180;
        var ratio_y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / Math.PI;
        var pic_x = (ratio_x + 1) * Math.pow(2, (zoom + 7));
        var pic_y = (1 - ratio_y) * Math.pow(2, (zoom + 7));
        var tile_x = Math.floor(pic_x / 256);
        var tile_y = Math.floor(pic_y / 256);
        var tex_x = Math.floor(tile_x / 16) * 16;
        var tex_y = Math.floor(tile_y / 16) * 16;
        return { x: tex_x, y: tex_y };
    };
    ImportMagic.prototype.moveTextures = function () {
        var layers = app.activeDocument.layers;
        var positionDivider = 16;
        for (var i = 0; i < layers.length; i++) {
            var texInfo = this.getLayerInfo(layers[i]);
            if (texInfo === null) {
                this.skippedLayers++;
                continue;
            }
            var positionDividerMultiplier = Math.pow(2, texInfo.tex_zoom - this.tileInfo.zoom);
            var textureCoords = this.getTextureCoords(texInfo.tex_zoom);
            var xPos = (texInfo.tex_x - textureCoords.left) / (positionDivider * positionDividerMultiplier);
            var yPos = (texInfo.tex_y - textureCoords.top) / (positionDivider * positionDividerMultiplier);
            if ((texInfo.tex_zoom - this.tileInfo.zoom) >= 2) {
                yPos += 1 / positionDividerMultiplier;
            }
            this.moveLayerTo(layers[i], xPos, yPos);
            if (texInfo.tex_zoom !== this.tileInfo.zoom) {
                this.scaleLayer(layers[i], positionDividerMultiplier);
            }
        }
    };
    ImportMagic.prototype.getLayerInfo = function (layer) {
        var splitName = layer.name.split('_');
        if (splitName.length !== 3)
            return null;
        var tex_y = parseInt(splitName[0], 10);
        var tex_x = parseInt(splitName[1], 10);
        var tex_zoom = parseInt(splitName[2].slice(-2), 10);
        if (isNaN(tex_x) || isNaN(tex_y) || isNaN(tex_zoom))
            return null;
        if (tex_zoom < this.tileInfo.zoom || tex_zoom > 19)
            return null;
        return { tex_x: tex_x, tex_y: tex_y, tex_zoom: tex_zoom };
    };
    ImportMagic.prototype.moveLayerTo = function (layer, x, y) {
        var bounds = layer.bounds;
        var x_pos = (x * this.TEXTURE_SIZE) - bounds[0];
        var y_pos = (y * this.TEXTURE_SIZE) - bounds[1];
        if (x_pos === 0 && y_pos === 0) {
            this.skippedLayers++;
            return;
        }
        layer.translate(-x_pos, -y_pos);
        this.movedLayers++;
    };
    ImportMagic.prototype.scaleLayer = function (layer, divider) {
        var bounds = layer.bounds;
        var width = bounds[2] - bounds[0];
        if (width !== this.TEXTURE_SIZE)
            return;
        var imageScalePercentage = (1 / divider) * 100;
        layer.resize(imageScalePercentage, imageScalePercentage, AnchorPosition.TOPLEFT);
    };
    ImportMagic.prototype.fail = function (error) {
        this.restoreRulerUnits();
        throw new Error(error);
    };
    ImportMagic.prototype.finish = function () {
        this.restoreRulerUnits();
        alert("Operation finished.\n\nMoved Layers: " + this.movedLayers + "\nSkipped Layers: " + this.skippedLayers);
    };
    return ImportMagic;
}());
var importMagic = new ImportMagic();
