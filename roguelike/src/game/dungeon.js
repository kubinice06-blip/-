import { TILE, MAP_W, MAP_H } from "./constants.js";
import { randInt } from "./rng.js";

// 矩形の部屋を連結したシンプルなダンジョンを生成する。
// 戻り値: { width, height, tiles[y][x], rooms[], stairs:{x,y}, start:{x,y} }
export function generateDungeon() {
  const width = MAP_W;
  const height = MAP_H;

  // 全面を壁で埋める
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TILE.WALL)
  );

  const rooms = [];
  const maxRooms = 12;

  for (let i = 0; i < maxRooms * 3 && rooms.length < maxRooms; i++) {
    const w = randInt(4, 8);
    const h = randInt(3, 6);
    const x = randInt(1, width - w - 2);
    const y = randInt(1, height - h - 2);
    const room = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };

    // 既存の部屋と（余白込みで）重ならないか確認
    const overlaps = rooms.some(
      (r) =>
        x <= r.x + r.w + 1 &&
        x + w + 1 >= r.x &&
        y <= r.y + r.h + 1 &&
        y + h + 1 >= r.y
    );
    if (overlaps) continue;

    carveRoom(tiles, room);

    // 直前の部屋とL字の通路でつなぐ
    if (rooms.length > 0) {
      const prev = rooms[rooms.length - 1];
      if (Math.random() < 0.5) {
        carveHTunnel(tiles, prev.cx, room.cx, prev.cy);
        carveVTunnel(tiles, prev.cy, room.cy, room.cx);
      } else {
        carveVTunnel(tiles, prev.cy, room.cy, prev.cx);
        carveHTunnel(tiles, prev.cx, room.cx, room.cy);
      }
    }
    rooms.push(room);
  }

  const start = { x: rooms[0].cx, y: rooms[0].cy };
  const last = rooms[rooms.length - 1];
  const stairs = { x: last.cx, y: last.cy };

  return { width, height, tiles, rooms, stairs, start };
}

function carveRoom(tiles, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      tiles[y][x] = TILE.FLOOR;
    }
  }
}

function carveHTunnel(tiles, x1, x2, y) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
    tiles[y][x] = TILE.FLOOR;
  }
}

function carveVTunnel(tiles, y1, y2, x) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    tiles[y][x] = TILE.FLOOR;
  }
}

// プレイヤーや敵を置ける床タイルをランダムに返す（占有済みは除外）
export function randomFloorTile(dungeon, occupied = []) {
  const taken = new Set(occupied.map((p) => `${p.x},${p.y}`));
  for (let tries = 0; tries < 500; tries++) {
    const room = dungeon.rooms[randInt(0, dungeon.rooms.length - 1)];
    const x = randInt(room.x, room.x + room.w - 1);
    const y = randInt(room.y, room.y + room.h - 1);
    if (dungeon.tiles[y][x] === TILE.FLOOR && !taken.has(`${x},${y}`)) {
      return { x, y };
    }
  }
  return null;
}
