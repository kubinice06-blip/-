import { randInt, weightedChoice, chance } from "./rng.js";
import { ITEM } from "./constants.js";

// ── 敵テンプレート ─────────────────────────────────────────────────
// minFloor 以上の階層で出現する。深い階ほど強い敵の重みが上がる。
const ENEMY_TYPES = [
  { name: "史萊姆", glyph: "s", color: "#6fcf6f", hp: 8, atk: 3, def: 0, xp: 4, sight: 5, minFloor: 1 },
  { name: "哥布林", glyph: "g", color: "#9acd5a", hp: 12, atk: 5, def: 1, xp: 7, sight: 7, minFloor: 1 },
  { name: "骷髏兵", glyph: "k", color: "#d8d2c0", hp: 16, atk: 7, def: 2, xp: 11, sight: 7, minFloor: 2 },
  { name: "惡狼", glyph: "w", color: "#c98b5a", hp: 14, atk: 8, def: 1, xp: 10, sight: 9, minFloor: 2 },
  { name: "食人魔", glyph: "O", color: "#cf6f6f", hp: 28, atk: 11, def: 3, xp: 20, sight: 6, minFloor: 4 },
  { name: "暗影法師", glyph: "m", color: "#a06fcf", hp: 20, atk: 13, def: 2, xp: 24, sight: 8, minFloor: 5 },
  { name: "石巨人", glyph: "G", color: "#9a9aa8", hp: 46, atk: 14, def: 6, xp: 42, sight: 5, minFloor: 6 },
];

let nextId = 1;
const newId = () => nextId++;

// 指定階層に出現しうる敵から1体を生成する
export function spawnEnemy(floor, pos) {
  const pool = ENEMY_TYPES.filter((t) => t.minFloor <= floor).map((t) => ({
    ...t,
    // 浅い階の弱い敵は徐々に出にくく、強い敵が出やすくなる
    weight: Math.max(1, 6 - (floor - t.minFloor)),
  }));
  const t = weightedChoice(pool);

  // 階層に応じた緩やかなステータス上昇
  const bonusHp = Math.floor((floor - t.minFloor) * 1.5);
  const bonusAtk = Math.floor((floor - t.minFloor) * 0.6);

  return {
    id: newId(),
    name: t.name,
    glyph: t.glyph,
    color: t.color,
    x: pos.x,
    y: pos.y,
    hp: t.hp + bonusHp,
    maxHp: t.hp + bonusHp,
    atk: t.atk + bonusAtk,
    def: t.def,
    xp: t.xp,
    sight: t.sight,
  };
}

// ── アイテム生成 ───────────────────────────────────────────────────
export function spawnItem(floor, pos) {
  const roll = weightedChoice([
    { kind: ITEM.POTION, weight: 5 },
    { kind: ITEM.GOLD, weight: 5 },
    { kind: ITEM.WEAPON, weight: 2 },
    { kind: ITEM.ARMOR, weight: 2 },
  ]);

  const base = { id: newId(), x: pos.x, y: pos.y, type: roll.kind };

  if (roll.kind === ITEM.POTION) {
    return { ...base, heal: randInt(18, 28), glyph: "!", color: "#e06fa0", name: "治療藥水" };
  }
  if (roll.kind === ITEM.GOLD) {
    return { ...base, amount: randInt(5, 15) + floor * 2, glyph: "$", color: "#e0c860", name: "金幣" };
  }
  if (roll.kind === ITEM.WEAPON) {
    const bonus = randInt(1, 2) + Math.floor(floor / 2);
    return { ...base, bonus, glyph: "/", color: "#7fb8e0", name: `利刃 +${bonus}` };
  }
  // ARMOR
  const bonus = randInt(1, 2) + Math.floor(floor / 3);
  return { ...base, bonus, glyph: "]", color: "#7fb8e0", name: `護甲 +${bonus}` };
}

// 新規プレイヤー
export function createPlayer(pos) {
  return {
    x: pos.x,
    y: pos.y,
    hp: 30,
    maxHp: 30,
    atk: 6,
    def: 1,
    level: 1,
    xp: 0,
    xpNext: 12,
    gold: 0,
    potions: 1,
  };
}

// 1フロアに配置する敵数・アイテム数（階層が深いほど増える）
export function floorEnemyCount(floor) {
  return Math.min(14, 4 + floor + (chance(0.5) ? 1 : 0));
}
export function floorItemCount(floor) {
  return randInt(3, 5);
}
