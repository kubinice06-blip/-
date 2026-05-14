import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from "react";

// ── 辯論主題 ──────────────────────────────────────────────────────────────────
const TOPICS = [
  "消費社會中的慾望與匱乏",
  "禮物經濟與資本主義的極限",
  "符號價值如何取代使用價值",
  "神話如何使剝削自然化",
  "耗費與積累：哪一個更接近人類本性？",
  "超真實如何消解革命的可能？",
  "身體、快感與生產力之間的張力",
];

// ── 思想家設定 ────────────────────────────────────────────────────────────────
const THEORISTS = {
  bataille: {
    label: "巴代伊",
    fullName: "喬治·巴代伊",
    initial: "巴",
    color: "#c0392b",
    bgBubble: "rgba(192,57,43,0.10)",
    borderBubble: "rgba(192,57,43,0.30)",
    side: "left",
    concepts: "一般經濟、耗費（dépense）、潛拉奇、主權、被詛咒的部分",
    persona:
      "你是喬治·巴代伊（Georges Bataille）。你的核心概念是一般經濟（économie générale）、非生產性耗費（dépense）、潛拉奇（potlatch）、主權（souveraineté）、被詛咒的部分（la part maudite）。你認為資本主義壓抑了過剩能量的耗費，而這種壓抑才是真正的暴力。你的語言激越、帶神秘主義色彩，毫不畏懼觸碰禁忌與死亡主題。請以第一人稱發言，不要說「作為巴代伊」之類的自我指稱。",
  },
  baudrillard: {
    label: "布希亞",
    fullName: "尚·布希亞",
    initial: "布",
    color: "#1f618d",
    bgBubble: "rgba(31,97,141,0.10)",
    borderBubble: "rgba(31,97,141,0.30)",
    side: "right",
    concepts: "擬像、符號價值、消費社會、超真實、象徵交換",
    persona:
      "你是尚·布希亞（Jean Baudrillard）。你的核心概念是擬像（simulacres）、符號價值（valeur-signe）、消費社會、超真實（hyperréalité）、象徵交換與死亡。你認為在消費社會中，商品的符號意義已完全取代使用價值，連「真實」本身也成了一種擬像。你的語調冷靜、犀利而帶有嘲諷意味。請以第一人稱發言，不要說「作為布希亞」之類的自我指稱。",
  },
  barthes: {
    label: "羅蘭·巴特",
    fullName: "羅蘭·巴特",
    initial: "羅",
    color: "#b7950b",
    bgBubble: "rgba(183,149,11,0.10)",
    borderBubble: "rgba(183,149,11,0.30)",
    side: "left",
    concepts: "神話學、符號學、意識形態自然化、文本的歡愉",
    persona:
      "你是羅蘭·巴特（Roland Barthes）。你的核心概念是神話（mythologies）、符號學（sémiologie）、資產階級意識形態的自然化、文本的歡愉（le plaisir du texte）。你善於揭露日常語言與影像如何把歷史性的社會建構偽裝成自然本質。你的語言精確、優雅，帶有解構意味。請以第一人稱發言，不要說「作為巴特」之類的自我指稱。",
  },
};

const ORDER = ["bataille", "baudrillard", "barthes"];

// ── SSE 串流函式 ──────────────────────────────────────────────────────────────
async function streamMessage(system, messages, onDelta, signal) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      stream: true,
      system,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        const evt = JSON.parse(payload);
        if (
          evt.type === "content_block_delta" &&
          evt.delta?.type === "text_delta"
        ) {
          onDelta(evt.delta.text);
        }
      } catch {
        /* ignore malformed chunks */
      }
    }
  }
}

// ── Prompt 建構 ───────────────────────────────────────────────────────────────
function buildTheoristMessages(theoristKey, topic, prior) {
  const t = THEORISTS[theoristKey];
  const history = prior
    .map((e) => `${THEORISTS[e.theorist].fullName}：${e.text}`)
    .join("\n\n");

  const content = `辯論主題：「${topic}」

${history ? `先前的辯論內容：\n${history}\n\n` : ""}請以${t.fullName}的身份，針對主題${prior.length > 0 ? "以及他人論點" : ""}發表你的觀點。要求：
- ${prior.length > 0 ? "直接回應他人論點，可指名反駁或延伸" : "直接切入主題核心"}
- 必須運用你的核心概念：${t.concepts}
- 使用繁體中文（台灣用語）
- 長度：100至150個中文字，精簡有力
- 只輸出發言內容本身，不要加姓名前綴`.trim();

  return [{ role: "user", content }];
}

function buildSummaryMessages(topic, roundExchanges, roundNumber) {
  const dialogue = roundExchanges
    .map((e) => `${THEORISTS[e.theorist].fullName}：${e.text}`)
    .join("\n\n");

  const content = `以下是關於「${topic}」的第 ${roundNumber} 回合辯論：

${dialogue}

請以思想史學者身份，用繁體中文（台灣用語）寫一段100字以內的綜合評述，指出三位思想家觀點的核心張力、交匯點，以及對理解當代經濟現象的啟示。只輸出評述本身，不要加標題或署名。`.trim();

  return [{ role: "user", content }];
}

// ── 子組件 ────────────────────────────────────────────────────────────────────
const ExchangeBubble = ({ exchange, isStreaming }) => {
  const t = THEORISTS[exchange.theorist];
  const isLeft = t.side === "left";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isLeft ? "row" : "row-reverse",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 16,
        animation: "fadeIn .3s ease-out",
      }}
    >
      {/* 頭像 */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          flexShrink: 0,
          background: `${t.color}18`,
          border: `1.5px solid ${t.color}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: t.color,
          fontWeight: 700,
          marginTop: 2,
        }}
      >
        {t.initial}
      </div>
      {/* 氣泡 */}
      <div
        style={{
          maxWidth: "74%",
          background: t.bgBubble,
          border: `1px solid ${t.borderBubble}`,
          borderRadius: isLeft ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
          padding: "10px 15px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: t.color,
            letterSpacing: 1,
            marginBottom: 6,
            fontWeight: 700,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {t.fullName}
          {exchange.round && (
            <span style={{ color: "#4a4038", fontWeight: 400 }}>
              第{exchange.round}回合
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "#d5cdc0",
            lineHeight: 1.85,
            fontFamily: "'Noto Serif TC', Georgia, serif",
          }}
        >
          {exchange.text}
          {isStreaming && (
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 14,
                background: "#d5cdc0",
                marginLeft: 2,
                verticalAlign: "text-bottom",
                animation: "blink 1s step-end infinite",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryBox = ({ summary, isStreaming }) => (
  <div
    style={{
      margin: "18px 0 24px",
      padding: "14px 18px",
      background: "rgba(90,50,130,0.08)",
      border: "1px solid rgba(110,70,160,0.22)",
      borderLeft: "3px solid #7b4fa6",
      borderRadius: "0 8px 8px 0",
      animation: "fadeIn .35s ease-out",
    }}
  >
    <div
      style={{
        fontSize: 10,
        color: "#9060c0",
        letterSpacing: 2.5,
        marginBottom: 8,
        fontWeight: 700,
      }}
    >
      ◈ 第{summary.round}回合綜合評述
    </div>
    <div
      style={{
        fontSize: 12.5,
        color: "#bfb8d0",
        lineHeight: 1.9,
        fontStyle: "italic",
        fontFamily: "'Noto Serif TC', Georgia, serif",
      }}
    >
      {summary.text}
      {isStreaming && (
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 13,
            background: "#bfb8d0",
            marginLeft: 2,
            verticalAlign: "text-bottom",
            animation: "blink 1s step-end infinite",
          }}
        />
      )}
    </div>
  </div>
);

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function DebateGenerator() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [exchanges, setExchanges] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingExchange, setStreamingExchange] = useState(null);
  const [streamingSummary, setStreamingSummary] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);

  const transcriptRef = useRef(null);
  const abortRef = useRef(null);

  // 離開時取消串流
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // 自動捲動至最新訊息
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [exchanges, streamingExchange, streamingSummary]);

  const resetDebate = useCallback(() => {
    abortRef.current?.abort();
    setExchanges([]);
    setSummaries([]);
    setStreamingExchange(null);
    setStreamingSummary(null);
    setCurrentRound(0);
    setIsGenerating(false);
  }, []);

  const handleTopicChange = useCallback(
    (t) => {
      if (exchanges.length > 0) resetDebate();
      setTopic(t);
    },
    [exchanges.length, resetDebate]
  );

  const handleRandom = useCallback(() => {
    const others = TOPICS.filter((t) => t !== topic);
    handleTopicChange(others[Math.floor(Math.random() * others.length)]);
  }, [topic, handleTopicChange]);

  // 生成一回合辯論
  const runRound = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    const round = currentRound + 1;
    const controller = new AbortController();
    abortRef.current = controller;
    const roundExchanges = [];

    try {
      // 三位思想家依序發言
      for (const key of ORDER) {
        let accText = "";
        const entry = { id: `${Date.now()}-${key}`, theorist: key, text: "", round };
        setStreamingExchange({ ...entry });

        await streamMessage(
          THEORISTS[key].persona,
          buildTheoristMessages(key, topic, [...exchanges, ...roundExchanges]),
          (delta) => {
            accText += delta;
            setStreamingExchange((prev) => prev ? { ...prev, text: accText } : prev);
          },
          controller.signal
        );

        const finished = { ...entry, text: accText };
        roundExchanges.push(finished);
        setExchanges((prev) => [...prev, finished]);
        setStreamingExchange(null);

        // 短暫停頓，讓讀者有緩衝
        await new Promise((r) => setTimeout(r, 300));
      }

      // 綜合評述
      let summaryText = "";
      setStreamingSummary({ round, text: "" });

      await streamMessage(
        "你是一位嚴謹的思想史學者，專長二十世紀法國理論。",
        buildSummaryMessages(topic, roundExchanges, round),
        (delta) => {
          summaryText += delta;
          setStreamingSummary({ round, text: summaryText });
        },
        controller.signal
      );

      setSummaries((prev) => [...prev, { round, text: summaryText }]);
      setStreamingSummary(null);
      setCurrentRound(round);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      setIsGenerating(false);
      setStreamingExchange(null);
      setStreamingSummary(null);
    }
  }, [isGenerating, currentRound, exchanges, topic]);

  // 推導所有已出現的回合序號（用於渲染）
  const allRounds = useMemo(() => {
    const s = new Set(exchanges.map((e) => e.round));
    if (streamingExchange) s.add(streamingExchange.round);
    return [...s].sort((a, b) => a - b);
  }, [exchanges, streamingExchange]);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0a09", fontFamily: "'Noto Serif TC', Georgia, serif", color: "#d5cdc0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 1; }
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0b0a09; }
        ::-webkit-scrollbar-thumb { background: #2e2218; border-radius: 3px; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(160deg, #14100e 0%, #0c0a09 100%)",
        borderBottom: "1px solid #1f1a17",
        padding: "22px 28px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 5, color: "#4e4038", marginBottom: 7, textTransform: "uppercase" }}>
            Bataille &times; Baudrillard &times; Barthes
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f2e8d6", letterSpacing: 1.5, lineHeight: 1 }}>
            理論家經濟辯論場
          </h1>
        </div>
        <div style={{ paddingTop: 6 }}>
          {currentRound > 0 ? (
            <div style={{
              fontSize: 11, color: "#8a7060",
              background: "#160f0c", border: "1px solid #2e2218",
              borderRadius: 20, padding: "4px 14px",
            }}>
              第 {currentRound} 回合
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#3e3028" }}>尚未開始</div>
          )}
        </div>
      </div>

      {/* ── 思想家圖例 ── */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #1f1a17",
        background: "#0e0b09",
      }}>
        {ORDER.map((key, i) => {
          const t = THEORISTS[key];
          return (
            <div key={key} style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "16px 8px 14px",
              borderRight: i < 2 ? "1px solid #1f1a17" : "none",
              gap: 7,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: `${t.color}15`,
                border: `2px solid ${t.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17, color: t.color, fontWeight: 700,
              }}>
                {t.initial}
              </div>
              <div style={{ fontSize: 12, color: t.color, fontWeight: 700, letterSpacing: 0.5 }}>
                {t.label}
              </div>
              <div style={{
                fontSize: 9.5, color: "#524540", textAlign: "center",
                lineHeight: 1.6, maxWidth: 130,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {t.concepts}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 主題選擇器 ── */}
      <div style={{
        padding: "14px 24px 12px",
        borderBottom: "1px solid #1f1a17",
        background: "#0d0b09",
      }}>
        <div style={{ fontSize: 10, color: "#524540", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
          辯論主題
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {TOPICS.map((t) => {
            const active = t === topic;
            return (
              <button
                key={t}
                onClick={() => handleTopicChange(t)}
                disabled={isGenerating}
                style={{
                  padding: "5px 13px",
                  borderRadius: 20,
                  fontSize: 11.5,
                  cursor: isGenerating ? "default" : "pointer",
                  border: `1px solid ${active ? "#b7950b99" : "#2e2218"}`,
                  background: active ? "rgba(183,149,11,0.13)" : "#140e0b",
                  color: active ? "#d4b840" : "#786858",
                  transition: "all .15s",
                  fontFamily: "'Noto Serif TC', Georgia, serif",
                  opacity: isGenerating ? 0.55 : 1,
                }}
              >
                {t}
              </button>
            );
          })}
          <button
            onClick={handleRandom}
            disabled={isGenerating}
            style={{
              padding: "5px 13px",
              borderRadius: 20,
              fontSize: 11.5,
              cursor: isGenerating ? "default" : "pointer",
              border: "1px solid #2e2218",
              background: "#140e0b",
              color: "#4e4038",
              fontFamily: "'Noto Serif TC', Georgia, serif",
              opacity: isGenerating ? 0.55 : 1,
            }}
          >
            🎲 隨機
          </button>
        </div>
      </div>

      {/* ── 辯論記錄區 ── */}
      <div
        ref={transcriptRef}
        style={{
          overflowY: "auto",
          height: "calc(100vh - 370px)",
          minHeight: 260,
          padding: "18px 26px 10px",
        }}
      >
        {/* 空狀態 */}
        {exchanges.length === 0 && !streamingExchange && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            height: "100%", gap: 14, color: "#3a3028",
          }}>
            <div style={{ fontSize: 36, opacity: 0.6 }}>⚖</div>
            <div style={{ fontSize: 13, letterSpacing: 1 }}>
              選擇主題後按下「開始辯論」
            </div>
            <div style={{ fontSize: 11, color: "#2a2018" }}>
              三位思想家將即時展開無止境的經濟學辯證
            </div>
          </div>
        )}

        {/* 回合逐一渲染 */}
        {allRounds.map((roundNum) => {
          const roundExchanges = exchanges.filter((e) => e.round === roundNum);
          const roundSummary = summaries.find((s) => s.round === roundNum);
          const isStreamingThisRound = streamingExchange?.round === roundNum;
          const isSummaryStreamingThisRound = streamingSummary?.round === roundNum;

          return (
            <Fragment key={roundNum}>
              {/* 回合分隔線 */}
              <div style={{
                textAlign: "center",
                fontSize: 10,
                color: "#322820",
                letterSpacing: 4,
                margin: "16px 0 18px",
                textTransform: "uppercase",
                userSelect: "none",
              }}>
                ── 第 {roundNum} 回合 ──
              </div>

              {roundExchanges.map((ex) => (
                <ExchangeBubble key={ex.id} exchange={ex} isStreaming={false} />
              ))}

              {isStreamingThisRound && streamingExchange && (
                <ExchangeBubble exchange={streamingExchange} isStreaming={true} />
              )}

              {roundSummary && (
                <SummaryBox summary={roundSummary} isStreaming={false} />
              )}

              {!roundSummary && isSummaryStreamingThisRound && streamingSummary && (
                <SummaryBox summary={streamingSummary} isStreaming={true} />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* ── 底部操作列 ── */}
      <div style={{
        position: "sticky",
        bottom: 0,
        background: "linear-gradient(to top, #0b0a09 70%, transparent)",
        borderTop: "1px solid #1f1a17",
        padding: "16px 24px 20px",
        display: "flex",
        justifyContent: "center",
        gap: 12,
      }}>
        {isGenerating ? (
          <button disabled style={{
            padding: "11px 36px",
            borderRadius: 26,
            border: "1px solid #2e2218",
            background: "#130e0b",
            color: "#5a4838",
            fontSize: 13,
            fontFamily: "'Noto Serif TC', Georgia, serif",
            cursor: "default",
            display: "flex", alignItems: "center", gap: 9,
          }}>
            <span style={{ animation: "pulse 1.3s ease-in-out infinite", fontSize: 10 }}>●</span>
            辯論生成中…
          </button>
        ) : currentRound === 0 ? (
          <button
            onClick={runRound}
            style={{
              padding: "12px 44px",
              borderRadius: 26,
              border: "1px solid #c8934a66",
              background: "linear-gradient(135deg, #c8934a, #ddb055)",
              color: "#1a0d06",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Noto Serif TC', Georgia, serif",
              letterSpacing: 1.5,
              boxShadow: "0 2px 16px rgba(200,147,74,0.28)",
            }}
          >
            開始辯論
          </button>
        ) : (
          <>
            <button
              onClick={runRound}
              style={{
                padding: "11px 34px",
                borderRadius: 26,
                border: "1px solid #c8934a55",
                background: "linear-gradient(135deg, #c8934a, #ddb055)",
                color: "#1a0d06",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Noto Serif TC', Georgia, serif",
                letterSpacing: 0.8,
                boxShadow: "0 2px 10px rgba(200,147,74,0.22)",
              }}
            >
              繼續辯論 →
            </button>
            <button
              onClick={resetDebate}
              style={{
                padding: "11px 22px",
                borderRadius: 26,
                border: "1px solid #2e2218",
                background: "#140e0b",
                color: "#786858",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'Noto Serif TC', Georgia, serif",
              }}
            >
              重置
            </button>
          </>
        )}
      </div>
    </div>
  );
}
