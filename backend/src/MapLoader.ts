import fs from "fs";
import path from "path";

interface Tile {
  id: number;
  properties: { [key: string]: any };
}

interface Layer {
  name: string;
  type: string;
  data: number[];
  width: number;
  height: number;
  properties?: { [key: string]: any };
}

interface Tilemap {
  layers: Layer[];
  tilesets: any[];
}

export class MapLoader {
  private map: Tilemap;

  constructor(mapPath: string) {
    const fullPath = path.resolve(mapPath);
    const rawData = fs.readFileSync(fullPath, "utf-8");
    this.map = JSON.parse(rawData);
  }

  getCollisionLayerNames(): string[] {
    return this.map.layers
      .filter(
        (layer) => layer.type === "tilelayer" && layer.properties?.collides
      )
      .map((layer) => layer.name);
  }

  isTileBlocked(x: number, y: number): boolean {
    for (const layer of this.map.layers) {
      if (layer.type === "tilelayer" && layer.properties?.collides) {
        const index = y * layer.width + x;
        const tileId = layer.data[index];
        if (tileId !== 0) {
          // 0 usually means no tile
          return true;
        }
      }
    }
    return false;
  }

  // Additional methods as needed
}
