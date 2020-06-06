interface ITileInfo {
    lat: number;
    lon: number;
    zoom: number;
}

interface ITexCoord {
    x: number;
    y: number;
}

interface ITexCoords {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

interface ITexCount {
    x: number;
    y: number;
}

interface ITexInfo {
    tex_x: number;
    tex_y: number;
    tex_zoom: number;
}

interface ITexZoomGroups {
    [zoom: number]: Layer[];
}

interface IExtGuides extends Guides {
    [index: number]: Guide;
    add: (direction: Direction, coordinate: UnitValue | number) => Guide;
}
