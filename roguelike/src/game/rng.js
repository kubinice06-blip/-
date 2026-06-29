// ── 乱数ユーティリティ ─────────────────────────────────────────────
export const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const chance = (p) => Math.random() < p;

// 重み付き抽選: items = [{ weight, ...}] -> 1件を返す
export const weightedChoice = (items) => {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
};
