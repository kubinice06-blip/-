import { useState, useEffect, useCallback } from "react";
import { WIN_FLOOR } from "./game/constants.js";
import {
  newGame,
  movePlayer,
  waitTurn,
  usePotion,
  descend,
  continueEndless,
} from "./game/engine.js";
import GameBoard from "./components/GameBoard.jsx";
import StatusBar from "./components/StatusBar.jsx";
import MessageLog from "./components/MessageLog.jsx";
import Controls from "./components/Controls.jsx";

export default function App() {
  const [state, setState] = useState(() => newGame());

  const onMove = useCallback((dx, dy) => setState((s) => movePlayer(s, dx, dy)), []);
  const onWait = useCallback(() => setState((s) => waitTurn(s)), []);
  const onPotion = useCallback(() => setState((s) => usePotion(s)), []);
  const onDescend = useCallback(() => setState((s) => descend(s)), []);
  const onContinue = useCallback(() => setState((s) => continueEndless(s)), []);
  const onRestart = useCallback(() => setState(newGame()), []);

  // キーボード操作
  useEffect(() => {
    const handler = (e) => {
      const k = e.key.toLowerCase();
      const map = {
        arrowup: [0, -1], w: [0, -1], k: [0, -1],
        arrowdown: [0, 1], s: [0, 1], j: [0, 1],
        arrowleft: [-1, 0], a: [-1, 0], h: [-1, 0],
        arrowright: [1, 0], d: [1, 0], l: [1, 0],
      };
      if (map[k]) {
        e.preventDefault();
        onMove(map[k][0], map[k][1]);
      } else if (k === " " || k === ".") {
        e.preventDefault();
        onWait();
      } else if (k === "q") {
        onPotion();
      } else if (k === ">" || k === "enter") {
        onDescend();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onMove, onWait, onPotion, onDescend]);

  const p = state.player;
  const canDescend =
    state.status === "playing" &&
    p.x === state.dungeon.stairs.x &&
    p.y === state.dungeon.stairs.y;

  return (
    <div className="app">
      <header className="title">
        <h1>地城迷蹤</h1>
        <span className="subtitle">Roguelike · 可遊玩測試版</span>
      </header>

      <StatusBar state={state} />

      <div className="board-frame">
        <GameBoard state={state} />

        {state.status === "dead" && (
          <Overlay
            title="你死了"
            tone="bad"
            lines={[
              `抵達第 ${state.floor} 層`,
              `等級 ${p.level} · 金幣 ${p.gold}`,
            ]}
            buttonText="重新開始"
            onButton={onRestart}
          />
        )}

        {state.status === "won" && (
          <Overlay
            title="測試版通關！"
            tone="good"
            lines={[
              `你抵達了第 ${WIN_FLOOR} 層。`,
              "「地圖踢館」Boss 戰將在後續版本登場。",
            ]}
            buttonText="繼續探索（無盡模式）"
            onButton={onContinue}
            secondText="重新開始"
            onSecond={onRestart}
          />
        )}
      </div>

      <MessageLog messages={state.messages} />

      <Controls
        onMove={onMove}
        onWait={onWait}
        onPotion={onPotion}
        onDescend={onDescend}
        canDescend={canDescend}
        potions={p.potions}
        disabled={state.status !== "playing"}
      />

      <footer className="hint">
        方向鍵/WASD 移動 · 空白 待機 · Q 藥水 · 站在 <span className="stairs-hint">&gt;</span> 上按下樓
      </footer>
    </div>
  );
}

function Overlay({ title, tone, lines, buttonText, onButton, secondText, onSecond }) {
  return (
    <div className="overlay">
      <div className={`overlay-card ${tone}`}>
        <h2>{title}</h2>
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        <button className="overlay-btn" onClick={onButton}>
          {buttonText}
        </button>
        {secondText && (
          <button className="overlay-btn ghost" onClick={onSecond}>
            {secondText}
          </button>
        )}
      </div>
    </div>
  );
}
