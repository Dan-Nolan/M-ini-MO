// backend/src/MapLoader.ts
import fs from "fs";
import path from "path";

interface Tile {
  id: number;
  properties: { [key: string]: any };
}

interface Tileset {
  firstgid: number;
  image: string;
  imageheight: number;
  imagewidth: number;
  name: string;
  tilecount: number;
  tileheight: number;
  tilewidth: number;
  tiles: Tile[];
}

interface Chunk {
  data: number[];
  width: number;
  height: number;
  x: number;
  y: number;
}

interface Layer {
  name: string;
  type: string;
  chunks?: Chunk[];
  properties?: { [key: string]: any };
}

interface Tilemap {
  layers: Layer[];
  tilesets: Tileset[];
}

export class MapLoader {
  private map: Tilemap;
  private collidableTiles: Set<number>;

  constructor(mapPath: string) {
    const fullPath = path.resolve(mapPath);
    const rawData = fs.readFileSync(fullPath, "utf-8");
    this.map = JSON.parse(rawData);
    this.collidableTiles = this.findCollidableTiles();
  }

  private findCollidableTiles(): Set<number> {
    const collidableTiles = new Set<number>();
    for (const tileset of this.map.tilesets) {
      for (const tile of tileset.tiles) {
        if (
          tile.properties?.some(
            (prop: { name: string; value: any }) =>
              prop.name === "collideable" && prop.value
          )
        ) {
          collidableTiles.add(tile.id + tileset.firstgid);
        }
      }
    }
    return collidableTiles;
  }

  isTileBlocked(x: number, y: number): boolean {
    for (const layer of this.map.layers) {
      if (layer.type === "tilelayer" && layer.chunks) {
        for (const chunk of layer.chunks) {
          // Check if the coordinates are within the chunk's bounds
          if (
            x >= chunk.x - chunk.width &&
            x < chunk.x &&
            y >= chunk.y - chunk.height &&
            y < chunk.y
          ) {
            // translate to the local chunk coordinate space
            const localX = x - (chunk.x - chunk.width);
            const localY = y - (chunk.y - chunk.height);

            // get the index of the tile in the chunk
            const index = localY * chunk.width + localX;
            const tile = chunk.data[index];
            if (this.collidableTiles.has(tile)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
}
