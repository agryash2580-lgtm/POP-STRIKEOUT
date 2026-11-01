import React, { useEffect, useRef, useState } from "react";
type Message = { role: "user" | "assistant"; text: string };
function BotChat({ kind, title }: { kind: string; title: string }) {
  const [messages, setMessages] = useState<Message[]>([]), [input, setInput] = useState(""), [approved, setApproved] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null), epoch = useRef(0);
  function clear() { epoch.current++; request.current?.abort(); setMessages([]); setInput(""); setApproved(false); setBusy(false); setError(""); }
  useEffect(() => { window.addEventListener("strikeout-auth-changed", clear); return () => { epoch.current++; request.current?.abort(); window.removeEventListener("strikeout-auth-changed", clear); }; }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!approved || busy || !input.trim()) return;
    const currentEpoch = epoch.current, message = input.trim(), controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/assistants/${kind}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ message, history: messages.slice(-8), approved }) });
      const value = await r.json(); if (!r.ok) throw Error(value.error || "Chat unavailable.");
      if (currentEpoch !== epoch.current) return;
      setMessages(previous => [...previous, { role: "user", text: message }, { role: "assistant", text: value.text }]); setInput("");
    } catch (e: any) { if (currentEpoch === epoch.current && e.name !== "AbortError") setError(e.message); }
    finally { if (currentEpoch === epoch.current) setBusy(false); }
  }
  return <section aria-label={title} className="step-card">
    <h2>{title}</h2>
    <p>{kind === "emotional_support" ? "AI emotional support for coping with stressful online incidents." : "Guidance for account recovery, phishing, evidence preservation and online safety."}</p>
    <p>Your messages are shared with Google after approval. Each chat stays separate and clears when you leave this screen.</p>
    <div role="log" aria-label={`${title} conversation`} aria-live="polite">{messages.map((m, i) => <p key={i} style={{ whiteSpace: "pre-wrap" }}><strong>{m.role === "user" ? "You" : title}: </strong>{m.text}</p>)}</div>
    <form onSubmit={send}>
      <label className="check"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} disabled={busy} />I approve sharing this chat with Google.</label>
      <label>Message {title}<textarea value={input} onChange={e => setInput(e.target.value)} maxLength={3000} required disabled={busy} /></label>
      <button type="submit" disabled={!approved || busy || !input.trim()}>{busy ? "Replying…" : `Send to ${title}`}</button>
      <button type="button" onClick={clear}>Clear {title} chat</button>
      {error && <p role="alert" className="error">{error}</p>}
    </form>
    {kind === "cybersecurity" && <p><a href="tel:1930">Call cybercrime helpline 1930</a><br /><small>India · Report online financial fraud.</small></p>}
    {kind === "cybersecurity" && <p><a href="https://cybercrime.gov.in/" target="_blank" rel="noopener noreferrer">Open National Cyber Crime Reporting Portal ↗</a><br /><small>Opens the government portal in a new tab.</small></p>}
    {kind === "emotional_support" && <p><a href="https://www.uplife.in/" target="_blank" rel="noopener noreferrer">Explore UpLife counselling ↗</a></p>}
    {kind === "emotional_support" && <p><a href="https://trytherabot.com/" target="_blank" rel="noopener noreferrer">Open Therabot ↗</a><br /><small>External support · Opens in a new tab.</small></p>}
  </section>;
}
export function SpecialistBots() { return <div><BotChat kind="cybersecurity" title="Cybersecurity assistant" /><BotChat kind="emotional_support" title="Emotional-support assistant" /></div>; }
