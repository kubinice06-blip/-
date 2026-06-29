// 画面下の操作パッド（タッチ＆クリック対応）
export default function Controls({
  onMove,
  onWait,
  onPotion,
  onDescend,
  canDescend,
  potions,
  disabled,
}) {
  const Btn = ({ children, onClick, className = "", title }) => (
    <button
      className={`pad-btn ${className}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className="controls">
      <div className="dpad">
        <div />
        <Btn className="dir" onClick={() => onMove(0, -1)} title="上 (↑/W)">
          ▲
        </Btn>
        <div />
        <Btn className="dir" onClick={() => onMove(-1, 0)} title="左 (←/A)">
          ◀
        </Btn>
        <Btn className="dir wait" onClick={onWait} title="待機 (空白)">
          ●
        </Btn>
        <Btn className="dir" onClick={() => onMove(1, 0)} title="右 (→/D)">
          ▶
        </Btn>
        <div />
        <Btn className="dir" onClick={() => onMove(0, 1)} title="下 (↓/S)">
          ▼
        </Btn>
        <div />
      </div>

      <div className="actions">
        <Btn className="act potion" onClick={onPotion} title="喝藥水 (Q)">
          🧪 藥水
          <span className="badge">{potions}</span>
        </Btn>
        <Btn
          className={`act descend ${canDescend ? "ready" : ""}`}
          onClick={onDescend}
          title="下樓 (>)"
        >
          ⬇ 下樓
        </Btn>
      </div>
    </div>
  );
}
