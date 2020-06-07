"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var ExportMagic = (function () {
    function ExportMagic() {
        this.MAX_ZOOM = 19;
        this.PROC_START_SNAPSHOT_NAME = 'PROCSTART';
        this.EXPORT_OPTIONS = new JPEGSaveOptions();
        this.cTID = function (str) { return app.charIDToTypeID(str); };
        this.sTID = function (str) { return app.stringIDToTypeID(str); };
        this.zoomGroups = {};
        this.checkPreconditions();
        this.initRulerUnits();
        this.setExportOptions();
        this.getDocumentName();
        this.getTileInfo();
        this.groupTexByZoom();
        this.processTextures();
        this.finish();
    }
    ExportMagic.prototype.checkPreconditions = function () {
        if (!app.documents.length)
            this.fail('No document to work with.');
        if (!app.activeDocument.saved)
            this.fail('Please save your document first before starting the export.');
        if (this.hasBackgroundLayer())
            this.fail('Documents with a background layer are not supported.');
    };
    ExportMagic.prototype.hasBackgroundLayer = function () {
        try {
            app.activeDocument.backgroundLayer;
            return true;
        }
        catch (error) {
            return false;
        }
    };
    ExportMagic.prototype.initRulerUnits = function () {
        this.originalRulerUnits = app.preferences.rulerUnits;
        app.preferences.rulerUnits = Units.PIXELS;
    };
    ExportMagic.prototype.restoreRulerUnits = function () {
        if (typeof this.originalRulerUnits !== 'undefined')
            app.preferences.rulerUnits = this.originalRulerUnits;
    };
    ExportMagic.prototype.setExportOptions = function () {
        this.EXPORT_OPTIONS.embedColorProfile = true;
        this.EXPORT_OPTIONS.quality = 9;
        this.EXPORT_OPTIONS.formatOptions = FormatOptions.STANDARDBASELINE;
        this.EXPORT_OPTIONS.matte = MatteType.NONE;
    };
    ExportMagic.prototype.getDocumentName = function () {
        this.documentName = this.stripExtensionFromName(app.activeDocument.name);
    };
    ExportMagic.prototype.stripExtensionFromName = function (name) {
        return name.split('.')[0];
    };
    ExportMagic.prototype.getTileInfo = function () {
        try {
            if (typeof this.documentName === 'undefined')
                throw '';
            this.tileInfo = this.parseTileInfoFromDocName(this.documentName);
        }
        catch (error) {
            this.fail('Could not parse needed info from filename. Make sure it is named like "+33+126_17".');
        }
    };
    ExportMagic.prototype.parseTileInfoFromDocName = function (docName) {
        var regex = /([+-]\d{1,3})/g;
        var latLon = docName.match(regex);
        var zoom = docName.split('_')[1];
        if (latLon === null || (latLon === null || latLon === void 0 ? void 0 : latLon.length) <= 1 || typeof zoom === 'undefined')
            throw '';
        return {
            lat: parseInt(latLon[0], 10),
            lon: parseInt(latLon[1], 10),
            zoom: parseInt(zoom, 10)
        };
    };
    ExportMagic.prototype.groupTexByZoom = function () {
        var layers = app.activeDocument.layers;
        for (var i = 0; i < layers.length; i++) {
            var texInfo = this.getLayerInfo(layers[i]);
            if (texInfo === null)
                continue;
            if (!this.zoomGroups.hasOwnProperty(texInfo.tex_zoom.toString()))
                this.zoomGroups[texInfo.tex_zoom] = [];
            this.zoomGroups[texInfo.tex_zoom].push(layers[i]);
        }
    };
    ExportMagic.prototype.processTextures = function () {
        var e_1, _a;
        var _b;
        this.setHistoryState(this.PROC_START_SNAPSHOT_NAME);
        for (var i = this.tileInfo.zoom; i <= this.MAX_ZOOM; i++) {
            if (!this.zoomGroups.hasOwnProperty(i.toString()))
                continue;
            var zoomGroup = this.zoomGroups[i];
            try {
                for (var zoomGroup_1 = (e_1 = void 0, __values(zoomGroup)), zoomGroup_1_1 = zoomGroup_1.next(); !zoomGroup_1_1.done; zoomGroup_1_1 = zoomGroup_1.next()) {
                    var layer = zoomGroup_1_1.value;
                    this.setActiveSnapshot(this.PROC_START_SNAPSHOT_NAME);
                    this.clearCanvas(layer, i);
                    app.activeDocument.crop(layer.bounds);
                    if (i !== ((_b = this.tileInfo) === null || _b === void 0 ? void 0 : _b.zoom))
                        this.resizeCanvas(i);
                    this.exportCanvas(layer);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (zoomGroup_1_1 && !zoomGroup_1_1.done && (_a = zoomGroup_1["return"])) _a.call(zoomGroup_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    };
    ExportMagic.prototype.exportCanvas = function (layer) {
        var document = app.activeDocument;
        var ortho4xpName = this.documentName.split('_')[0];
        var providerName = this.getProviderDirectoryName(layer.name);
        var destination = new Folder(document.path.toString() + "/orthomagic4ps/" + ortho4xpName + "/" + providerName);
        if (!destination.exists)
            destination.create();
        var file = new File(destination.toString() + "/" + layer.name + ".jpg");
        document.saveAs(file, this.EXPORT_OPTIONS, true, Extension.LOWERCASE);
    };
    ExportMagic.prototype.getProviderDirectoryName = function (name) {
        var nameParts = name.split('_');
        var providerPart = nameParts[2];
        var provider = providerPart.slice(0, -2);
        var zoom = providerPart.slice(-2);
        return provider + "_" + zoom;
    };
    ExportMagic.prototype.clearCanvas = function (currentLayer, currentZoom) {
        var e_2, _a, e_3, _b;
        for (var i = this.tileInfo.zoom; i <= this.MAX_ZOOM; i++) {
            if (!this.zoomGroups.hasOwnProperty(i.toString()))
                continue;
            var zoomGroup = this.zoomGroups[i];
            try {
                for (var zoomGroup_2 = (e_2 = void 0, __values(zoomGroup)), zoomGroup_2_1 = zoomGroup_2.next(); !zoomGroup_2_1.done; zoomGroup_2_1 = zoomGroup_2.next()) {
                    var layer = zoomGroup_2_1.value;
                    if (layer.name === currentLayer.name ||
                        (i > currentZoom && this.isLayerOverlapping(currentLayer, layer)))
                        continue;
                    if (layer.linkedLayers.length > 0)
                        try {
                            for (var _c = (e_3 = void 0, __values(layer.linkedLayers)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                var linkedLayer = _d.value;
                                linkedLayer.visible = false;
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_b = _c["return"])) _b.call(_c);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                    layer.visible = false;
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (zoomGroup_2_1 && !zoomGroup_2_1.done && (_a = zoomGroup_2["return"])) _a.call(zoomGroup_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        this.deleteHiddenLayers();
    };
    ExportMagic.prototype.isLayerOverlapping = function (currentLayer, overlapLayer) {
        var cLeft = currentLayer.bounds[0];
        var cTop = currentLayer.bounds[1];
        var cRight = currentLayer.bounds[2];
        var cBottom = currentLayer.bounds[3];
        var oLeft = overlapLayer.bounds[0];
        var oTop = overlapLayer.bounds[1];
        var oRight = overlapLayer.bounds[2];
        var oBottom = overlapLayer.bounds[3];
        return cLeft < oRight && oLeft < cRight && cTop < oBottom && oTop < cBottom;
    };
    ExportMagic.prototype.deleteHiddenLayers = function () {
        var descriptor = new ActionDescriptor();
        var reference = new ActionReference();
        reference.putEnumerated(this.sTID('layer'), this.sTID('ordinal'), this.sTID('hidden'));
        descriptor.putReference(this.sTID('null'), reference);
        app.executeAction(this.sTID('delete'), descriptor, DialogModes.NO);
    };
    ExportMagic.prototype.resizeCanvas = function (zoom) {
        var zoomDiff = zoom - this.tileInfo.zoom;
        var multiplier = Math.pow(2, zoomDiff);
        var width = app.activeDocument.width;
        var height = app.activeDocument.height;
        app.activeDocument.resizeImage(width * multiplier, height * multiplier);
    };
    ExportMagic.prototype.setHistoryState = function (name) {
        var descriptor = new ActionDescriptor();
        var reference1 = new ActionReference();
        var reference2 = new ActionReference();
        reference1.putClass(this.cTID('SnpS'));
        descriptor.putReference(this.cTID('null'), reference1);
        reference2.putProperty(this.cTID('HstS'), this.cTID('CrnH'));
        descriptor.putReference(this.cTID('From'), reference2);
        descriptor.putString(this.cTID('Nm  '), name);
        descriptor.putEnumerated(this.cTID('Usng'), this.cTID('HstS'), this.cTID('FllD'));
        app.executeAction(this.cTID('Mk  '), descriptor, DialogModes.NO);
    };
    ExportMagic.prototype.clearHistoryStates = function () {
        this.setActiveSnapshot(this.PROC_START_SNAPSHOT_NAME);
        for (var i = 0; i < app.activeDocument.historyStates.length; i++) {
            var state = app.activeDocument.historyStates[i];
            if (!state.snapshot)
                continue;
            if (state.name === this.PROC_START_SNAPSHOT_NAME)
                this.removeSnapshot(state.name);
        }
    };
    ExportMagic.prototype.getSnapshot = function (name) {
        try {
            return app.activeDocument.historyStates.getByName(name);
        }
        catch (error) {
            return undefined;
        }
    };
    ExportMagic.prototype.setActiveSnapshot = function (name) {
        var snapshot = this.getSnapshot(name);
        if (typeof snapshot !== 'undefined')
            app.activeDocument.activeHistoryState = snapshot;
    };
    ExportMagic.prototype.removeSnapshot = function (name) {
        var descriptor = new ActionDescriptor();
        var reference = new ActionReference();
        reference.putName(this.cTID('SnpS'), name);
        descriptor.putReference(this.cTID('null'), reference);
        app.executeAction(this.cTID('Dlt '), descriptor, DialogModes.NO);
    };
    ExportMagic.prototype.getLayerInfo = function (layer) {
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
    ExportMagic.prototype.fail = function (error) {
        this.restoreRulerUnits();
        this.clearHistoryStates();
        throw new Error(error);
    };
    ExportMagic.prototype.finish = function () {
        this.restoreRulerUnits();
        this.clearHistoryStates();
        alert("Operation finished.");
    };
    return ExportMagic;
}());
var exportMagic = new ExportMagic();
