export default function MessageLog({ messages }) {
  // 新しいものを上に、最新6件を表示
  const recent = messages.slice(-6).reverse();
  return (
    <div className="log">
      {recent.map((m) => (
        <div key={m.id} className="log-line" style={{ color: m.color }}>
          {m.text}
        </div>
      ))}
    </div>
  );
}
