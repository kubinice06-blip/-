// ── ゲーム全体の定数 ───────────────────────────────────────────────
export const TILE = { WALL: 0, FLOOR: 1 };

// マップサイズ（タイル単位）
export const MAP_W = 40;
export const MAP_H = 26;

// プレイヤー周囲の視界半径
export const FOV_RADIUS = 6;

// カメラ（画面に映すタイル数）— プレイヤー中心
export const VIEW_W = 19;
export const VIEW_H = 13;

// 測試版のゴール階層。ここに到達すると「通關」表示。
// 「地圖踢館（ボス戦）」は後日この階層に追加予定。
export const WIN_FLOOR = 8;

// タイル表示記号
export const GLYPH = {
  WALL: "#",
  FLOOR: "·",
  STAIRS: ">",
  PLAYER: "@",
};

// アイテム種別
export const ITEM = {
  POTION: "potion",
  GOLD: "gold",
  WEAPON: "weapon",
  ARMOR: "armor",
};
