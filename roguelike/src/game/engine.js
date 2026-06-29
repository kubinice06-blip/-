import { TILE, MAP_W, MAP_H, FOV_RADIUS, WIN_FLOOR, ITEM } from "./constants.js";
import { randInt, chance, choice } from "./rng.js";
import { generateDungeon, randomFloorTile } from "./dungeon.js";
import {
  spawnEnemy,
  spawnItem,
  createPlayer,
  floorEnemyCount,
  floorItemCount,
} from "./entities.js";

// ── 補助 ───────────────────────────────────────────────────────────
const cheby = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function emptyGrid(value) {
  return Array.from({ length: MAP_H }, () =>
    Array.from({ length: MAP_W }, () => value)
  );
}

function log(state, text, color = "#b8b0a4") {
  state.messages.push({ text, color, id: state.msgId++ });
  if (state.messages.length > 40) state.messages.shift();
}

// 始点から終点まで壁に遮られず見通せるか（Bresenham）
function hasLOS(tiles, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  // 安全のための反復上限
  for (let i = 0; i < 200; i++) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) return true;
    if (tiles[y][x] === TILE.WALL) return false; // 途中の壁で遮断
  }
  return false;
}

function computeFOV(state) {
  const { player, dungeon } = state;
  state.visible = emptyGrid(false);
  const R = FOV_RADIUS;
  const minX = Math.max(0, player.x - R);
  const maxX = Math.min(MAP_W - 1, player.x + R);
  const minY = Math.max(0, player.y - R);
  const maxY = Math.min(MAP_H - 1, player.y + R);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (cheby({ x, y }, player) > R) continue;
      if (hasLOS(dungeon.tiles, player.x, player.y, x, y)) {
        state.visible[y][x] = true;
        state.explored[y][x] = true;
      }
    }
  }
  state.visible[player.y][player.x] = true;
  state.explored[player.y][player.x] = true;
}

// ── フロア構築 ─────────────────────────────────────────────────────
function buildFloor(state, floor) {
  const dungeon = generateDungeon();
  state.dungeon = dungeon;
  state.floor = floor;
  state.explored = emptyGrid(false);
  state.visible = emptyGrid(false);

  state.player.x = dungeon.start.x;
  state.player.y = dungeon.start.y;

  // 敵を配置（開始部屋には湧かせない）
  const occupied = [dungeon.start, dungeon.stairs];
  state.enemies = [];
  const eCount = floorEnemyCount(floor);
  for (let i = 0; i < eCount; i++) {
    const pos = randomFloorTile(dungeon, occupied);
    if (!pos) break;
    // 開始地点に近すぎる敵は避ける
    if (cheby(pos, dungeon.start) < 5) { i--; occupied.push(pos); continue; }
    state.enemies.push(spawnEnemy(floor, pos));
    occupied.push(pos);
  }

  // アイテムを配置
  state.items = [];
  const iCount = floorItemCount(floor);
  for (let i = 0; i < iCount; i++) {
    const pos = randomFloorTile(dungeon, occupied);
    if (!pos) break;
    state.items.push(spawnItem(floor, pos));
    occupied.push(pos);
  }

  computeFOV(state);
}

// ── 新規ゲーム ─────────────────────────────────────────────────────
export function newGame() {
  const dungeon = generateDungeon();
  const state = {
    dungeon,
    floor: 1,
    player: createPlayer(dungeon.start),
    enemies: [],
    items: [],
    explored: emptyGrid(false),
    visible: emptyGrid(false),
    messages: [],
    msgId: 1,
    status: "playing", // playing | dead | won
    turn: 0,
    wonShown: false,
  };
  buildFloor(state, 1);
  log(state, "你踏入了陰暗的地城。祝你好運，冒險者。", "#c8a060");
  log(state, "用方向鍵或畫面按鈕移動。撞向敵人即可攻擊。", "#8a8278");
  return state;
}

// ── 戦闘 ───────────────────────────────────────────────────────────
function attackDamage(atk, def) {
  return Math.max(1, atk - def + randInt(-1, 1));
}

function playerAttack(state, enemy) {
  const dmg = attackDamage(state.player.atk, enemy.def);
  enemy.hp -= dmg;
  if (enemy.hp <= 0) {
    log(state, `你擊倒了 ${enemy.name}！（+${enemy.xp} 經驗）`, "#9acd5a");
    state.enemies = state.enemies.filter((e) => e.id !== enemy.id);
    gainXp(state, enemy.xp);
    if (chance(0.25)) {
      const g = randInt(2, 6) + state.floor;
      state.player.gold += g;
      log(state, `${enemy.name} 掉落了 ${g} 金幣。`, "#e0c860");
    }
  } else {
    log(state, `你對 ${enemy.name} 造成 ${dmg} 點傷害。`, "#cfc7ba");
  }
}

function enemyAttack(state, enemy) {
  const dmg = attackDamage(enemy.atk, state.player.def);
  state.player.hp -= dmg;
  log(state, `${enemy.name} 對你造成 ${dmg} 點傷害！`, "#cf6f6f");
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.status = "dead";
    log(state, "你倒下了……地城吞噬了又一位冒險者。", "#cf4f4f");
  }
}

function gainXp(state, amount) {
  const p = state.player;
  p.xp += amount;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = Math.floor(p.xpNext * 1.5);
    p.maxHp += 8;
    p.hp = p.maxHp;
    p.atk += 2;
    p.def += 1;
    log(state, `升級！你現在是 ${p.level} 級。體力全滿，能力提升。`, "#c8a060");
  }
}

// ── 敵ターン ───────────────────────────────────────────────────────
function enemyTurn(state) {
  const { player, dungeon } = state;
  for (const enemy of state.enemies) {
    if (state.status !== "playing") return;
    const dist = cheby(enemy, player);
    if (dist <= 1) {
      enemyAttack(state, enemy);
      continue;
    }
    const aware =
      dist <= enemy.sight &&
      hasLOS(dungeon.tiles, enemy.x, enemy.y, player.x, player.y);

    let stepX = 0;
    let stepY = 0;
    if (aware) {
      stepX = Math.sign(player.x - enemy.x);
      stepY = Math.sign(player.y - enemy.y);
    } else if (chance(0.4)) {
      // ふらつき移動
      const dir = choice([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      stepX = dir[0];
      stepY = dir[1];
    }
    if (stepX === 0 && stepY === 0) continue;

    // 距離の大きい軸を優先、塞がっていれば別軸を試す
    const tryOrder =
      Math.abs(player.x - enemy.x) >= Math.abs(player.y - enemy.y)
        ? [[stepX, 0], [0, stepY]]
        : [[0, stepY], [stepX, 0]];

    for (const [dx, dy] of tryOrder) {
      if (dx === 0 && dy === 0) continue;
      const nx = enemy.x + dx;
      const ny = enemy.y + dy;
      if (!moveBlocked(state, enemy, nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
        break;
      }
    }
  }
}

function moveBlocked(state, self, nx, ny) {
  if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) return true;
  if (state.dungeon.tiles[ny][nx] === TILE.WALL) return true;
  if (state.player.x === nx && state.player.y === ny) return true;
  if (state.enemies.some((e) => e !== self && e.x === nx && e.y === ny)) return true;
  return false;
}

// ── アイテム取得 ───────────────────────────────────────────────────
function pickupAt(state, x, y) {
  const idx = state.items.findIndex((it) => it.x === x && it.y === y);
  if (idx === -1) return;
  const it = state.items[idx];
  if (it.type === ITEM.POTION) {
    state.player.potions += 1;
    log(state, `撿到 ${it.name}。（藥水 x${state.player.potions}）`, "#e06fa0");
  } else if (it.type === ITEM.GOLD) {
    state.player.gold += it.amount;
    log(state, `撿到 ${it.amount} 金幣。`, "#e0c860");
  } else if (it.type === ITEM.WEAPON) {
    state.player.atk += it.bonus;
    log(state, `裝備了 ${it.name}！攻擊 +${it.bonus}。`, "#7fb8e0");
  } else if (it.type === ITEM.ARMOR) {
    state.player.def += it.bonus;
    log(state, `裝備了 ${it.name}！防禦 +${it.bonus}。`, "#7fb8e0");
  }
  state.items.splice(idx, 1);
}

// ── 公開アクション ─────────────────────────────────────────────────
// すべて新しい state オブジェクトを返す（React 再描画のため）

function clone(state) {
  return structuredClone(state);
}

// プレイヤー移動 / 攻撃。1ターン消費したら敵を行動させる。
export function movePlayer(prev, dx, dy) {
  if (prev.status !== "playing") return prev;
  const state = clone(prev);
  const { player } = state;
  const nx = player.x + dx;
  const ny = player.y + dy;

  if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) return prev;
  if (state.dungeon.tiles[ny][nx] === TILE.WALL) return prev; // 壁: ターン消費なし

  const enemy = state.enemies.find((e) => e.x === nx && e.y === ny);
  if (enemy) {
    playerAttack(state, enemy);
  } else {
    player.x = nx;
    player.y = ny;
    pickupAt(state, nx, ny);
  }

  endPlayerTurn(state);
  return state;
}

// その場で待機（1ターン経過）
export function waitTurn(prev) {
  if (prev.status !== "playing") return prev;
  const state = clone(prev);
  log(state, "你原地戒備了一回合。", "#8a8278");
  endPlayerTurn(state);
  return state;
}

// 藥水を使う
export function usePotion(prev) {
  if (prev.status !== "playing") return prev;
  if (prev.player.potions <= 0) {
    const state = clone(prev);
    log(state, "沒有藥水可用。", "#8a8278");
    return state;
  }
  const state = clone(prev);
  const p = state.player;
  if (p.hp >= p.maxHp) {
    log(state, "體力已滿，現在喝藥水太浪費了。", "#8a8278");
    return state; // ターン消費なし
  }
  p.potions -= 1;
  const heal = randInt(20, 30);
  p.hp = Math.min(p.maxHp, p.hp + heal);
  log(state, `你喝下藥水，恢復了 ${heal} 點體力。`, "#e06fa0");
  endPlayerTurn(state);
  return state;
}

// 階段を降りる（プレイヤーが階段上にいる場合）
export function descend(prev) {
  if (prev.status !== "playing") return prev;
  const p = prev.player;
  if (p.x !== prev.dungeon.stairs.x || p.y !== prev.dungeon.stairs.y) {
    const state = clone(prev);
    log(state, "這裡沒有往下的階梯。", "#8a8278");
    return state;
  }
  const state = clone(prev);
  const next = state.floor + 1;
  buildFloor(state, next);
  log(state, `你沿著階梯來到第 ${next} 層。`, "#c8a060");
  if (next >= WIN_FLOOR && !state.wonShown) {
    state.status = "won";
    state.wonShown = true;
  }
  return state;
}

function endPlayerTurn(state) {
  if (state.status !== "playing") {
    computeFOV(state);
    return;
  }
  enemyTurn(state);
  state.turn += 1;
  computeFOV(state);
}

// 「通關」表示後も無盡モードで続行する
export function continueEndless(prev) {
  const state = clone(prev);
  if (state.status === "won") {
    state.status = "playing";
    log(state, "你決定繼續深入，挑戰無盡的地城……", "#c8a060");
  }
  return state;
}
