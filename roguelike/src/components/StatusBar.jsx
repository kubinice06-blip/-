import { WIN_FLOOR } from "../game/constants.js";

function Bar({ label, value, max, color, bg }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-wrap">
      <div className="bar-label">
        <span>{label}</span>
        <span>
          {Math.ceil(value)}/{max}
        </span>
      </div>
      <div className="bar-track" style={{ background: bg }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function StatusBar({ state }) {
  const p = state.player;
  return (
    <div className="status">
      <div className="status-top">
        <span className="floor">
          第 <b>{state.floor}</b> 層{" "}
          <small>/ 目標 {WIN_FLOOR}</small>
        </span>
        <span className="lvl">LV {p.level}</span>
        <span className="gold">$ {p.gold}</span>
      </div>
      <Bar label="體力" value={p.hp} max={p.maxHp} color="#cf5f5f" bg="#3a2226" />
      <Bar label="經驗" value={p.xp} max={p.xpNext} color="#5a9acd" bg="#222a3a" />
      <div className="stats-row">
        <span>⚔ 攻擊 {p.atk}</span>
        <span>🛡 防禦 {p.def}</span>
        <span>🧪 藥水 {p.potions}</span>
      </div>
    </div>
  );
}
