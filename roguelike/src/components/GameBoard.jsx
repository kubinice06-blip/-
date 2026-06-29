import { useMemo } from "react";
import { TILE, MAP_W, MAP_H, VIEW_W, VIEW_H, GLYPH } from "../game/constants.js";

// プレイヤーを中心に VIEW_W x VIEW_H のタイルを描画する（カメラ）
export default function GameBoard({ state }) {
  const { dungeon, player, enemies, items, visible, explored } = state;

  // カメラ左上をクランプ
  const camX = clamp(player.x - Math.floor(VIEW_W / 2), 0, MAP_W - VIEW_W);
  const camY = clamp(player.y - Math.floor(VIEW_H / 2), 0, MAP_H - VIEW_H);

  const enemyMap = useMemo(() => {
    const m = new Map();
    for (const e of enemies) m.set(`${e.x},${e.y}`, e);
    return m;
  }, [enemies]);

  const itemMap = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(`${it.x},${it.y}`, it);
    return m;
  }, [items]);

  const rows = [];
  for (let vy = 0; vy < VIEW_H; vy++) {
    const cells = [];
    const y = camY + vy;
    for (let vx = 0; vx < VIEW_W; vx++) {
      const x = camX + vx;
      cells.push(renderCell(x, y));
    }
    rows.push(
      <div className="board-row" key={vy}>
        {cells}
      </div>
    );
  }

  function renderCell(x, y) {
    const key = `${x},${y}`;
    const inBounds = x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
    if (!inBounds || !explored[y][x]) {
      return <span className="cell dark" key={key} />;
    }
    const isVisible = visible[y][x];
    const isWall = dungeon.tiles[y][x] === TILE.WALL;

    let glyph = isWall ? GLYPH.WALL : GLYPH.FLOOR;
    let color = isWall ? "#4a4450" : "#5a5560";
    let cls = "cell";

    // 階段
    if (!isWall && x === dungeon.stairs.x && y === dungeon.stairs.y) {
      glyph = GLYPH.STAIRS;
      color = "#5fd0d0";
    }

    if (isVisible) {
      // 視界内: エンティティを表示
      if (player.x === x && player.y === y) {
        glyph = GLYPH.PLAYER;
        color = "#e8c070";
        cls += " player";
      } else if (enemyMap.has(key)) {
        const e = enemyMap.get(key);
        glyph = e.glyph;
        color = e.color;
        cls += " enemy";
      } else if (itemMap.has(key)) {
        const it = itemMap.get(key);
        glyph = it.glyph;
        color = it.color;
      } else if (!isWall) {
        color = "#7a7466"; // 視界内の床は明るめ
      } else {
        color = "#6a6470";
      }
    } else {
      // 記憶のみ: 暗く表示
      cls += " memory";
    }

    return (
      <span className={cls} key={key} style={{ color }}>
        {glyph}
      </span>
    );
  }

  return <div className="board">{rows}</div>;
}

function clamp(v, lo, hi) {
  if (hi < lo) return lo;
  return Math.max(lo, Math.min(hi, v));
}
