import React, { useEffect, useRef, useState } from "react";
export function GuideChat() {
  const [open, setOpen] = useState(false),
    [messages, setMessages] = useState<any[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [context, setContext] = useState<any>(null),
    [include, setInclude] = useState(false),
    [sharedContext, setSharedContext] = useState<any>(null);
  const log = useRef<HTMLDivElement>(null),
    accountEpoch = useRef(0),
    revision = useRef(-1),
    synced = useRef(false),
    busyRef = useRef(false),
    contextChoice = useRef(false),
    selectedContext = useRef<any>(null);
  busyRef.current = busy;
  async function loadHistory() {
    const epoch = accountEpoch.current;
    try {
      const r = await fetch("/api/guide/conversation");
      if (!r.ok) {
        synced.current = false;
        return;
      }
      const x = await r.json();
      if (epoch !== accountEpoch.current || busyRef.current) return;
      synced.current = true;
      setSharedContext(x.context);
      if (
        !contextChoice.current &&
        (!selectedContext.current ||
          selectedContext.current.caseId === x.context?.caseId)
      ) {
        setInclude(!!x.context);
        if (!selectedContext.current) setContext(x.context);
      }
      if (revision.current !== x.revision) {
        revision.current = x.revision;
        setMessages(x.messages || []);
      }
    } catch {}
  }
  useEffect(() => {
    function update(e: any) {
      selectedContext.current = e.detail;
      setContext(e.detail);
      setInclude(false);
      contextChoice.current = false;
    }
    function show() {
      setOpen(true);
    }
    function reset() {
      accountEpoch.current++;
      revision.current = -1;
      synced.current = false;
      selectedContext.current = null;
      setMessages([]);
      setContext(null);
      setSharedContext(null);
      setInclude(false);
      setInput("");
      setError("");
      setBusy(false);
      loadHistory();
    }
    window.addEventListener("strikeout-auth-changed", reset);
    window.addEventListener("strikeout-case-context", update);
    window.addEventListener("strikeout-chat", show);
    return () => {
      window.removeEventListener("strikeout-auth-changed", reset);
      window.removeEventListener("strikeout-case-context", update);
      window.removeEventListener("strikeout-chat", show);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    loadHistory();
    const focus = () => loadHistory();
    window.addEventListener("focus", focus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && synced.current)
        loadHistory();
    }, 5000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [open]);
  useEffect(() => {
    log.current?.scrollTo(0, log.current.scrollHeight);
  }, [messages, busy]);
  async function clearChat() {
    try {
      const r = await fetch("/api/guide/conversation", { method: "DELETE" });
      if (!r.ok && r.status !== 401) {
        const x = await r.json();
        throw Error(x.error);
      }
      setMessages([]);
      setSharedContext(null);
      setInclude(false);
      revision.current = -1;
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function send(e: any) {
    e.preventDefault();
    if (busy || !input.trim()) return;
    const text = input.trim(),
      epoch = accountEpoch.current,
      id = crypto.randomUUID();
    const history = messages
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 6000) }));
    setBusy(true);
    setInput("");
    setError("");
    setMessages((v) => [...v, { id, role: "user", text }]);
    try {
      const r = await fetch("/api/guide/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          approved: true,
          ...(contextChoice.current
            ? {
                caseId: include && context?.caseId ? context.caseId : null,
                ...(include && context?.reportId
                  ? { reportId: context.reportId }
                  : {}),
              }
            : {}),
        }),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error || "Chat unavailable");
      if (epoch === accountEpoch.current) {
        if (x.messages) {
          setMessages(x.messages);
          setSharedContext(x.context);
          revision.current = x.revision;
          synced.current = true;
        } else setMessages((v) => [...v, { role: "assistant", text: x.text }]);
        contextChoice.current = false;
      }
    } catch (e: any) {
      if (epoch === accountEpoch.current) {
        setMessages((v) => v.filter((m) => m.id !== id));
        setError(e.message);
        setInput(text);
      }
    } finally {
      if (epoch === accountEpoch.current) setBusy(false);
    }
  }
  const btn: any = {
    background: "#c0c0c0",
    color: "#111",
    border: 0,
    boxShadow: "inset 1px 1px #fff,inset -1px -1px #111",
    padding: "6px 10px",
    cursor: "pointer",
    font: "12px Tahoma,sans-serif",
  };
  return (
    <div
      style={{
        position: "fixed",
        left: 14,
        bottom: 42,
        zIndex: 99998,
        font: "13px/1.5 Tahoma,sans-serif",
      }}
    >
      {!open ? (
        <button
          aria-label="Chat with Pop"
          onClick={() => setOpen(true)}
          style={{
            ...btn,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: "bold",
            padding: "9px 14px",
          }}
        >
          <img
            src="/pop.png"
            alt=""
            style={{
              width: 30,
              height: 30,
              imageRendering: "pixelated",
              objectFit: "contain",
            }}
          />
          Ask Pop / Chat
        </button>
      ) : (
        <section
          aria-label="Pop guidance chat"
          style={{
            width: "min(380px,calc(100vw - 28px))",
            height: "min(560px,calc(100dvh - 90px))",
            background: "#c0c0c0",
            padding: 4,
            boxShadow: "inset 1px 1px white,inset -1px -1px #111,3px 4px #0004",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <header
            style={{
              background: "linear-gradient(90deg,#881337,#be123c)",
              color: "white",
              padding: "5px 7px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Pop / Your next step</strong>
            <button
              aria-label="Minimise chat"
              onClick={() => setOpen(false)}
              style={btn}
            >
              _
            </button>
          </header>
          <div style={{ padding: 8, display: "flex", gap: 8 }}>
            <button
              style={btn}
              onClick={() =>
                window.dispatchEvent(new Event("strikeout-tutorial"))
              }
            >
              Pop tutorial
            </button>
            <button style={btn} disabled={busy} onClick={clearChat}>
              Clear chat
            </button>
          </div>
          <div
            ref={log}
            role="log"
            aria-live="polite"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              background: "#f8f6ef",
              border: "1px solid #888",
              padding: 12,
            }}
          >
            {!messages.length && (
              <>
                <strong>Hi. I'm Pop.</strong>
                <p style={{ margin: "8px 0" }}>
                  Tell me what happened or ask how to use STRIKEOUT. We'll pick
                  one useful next step.
                </p>
                <p style={{ fontSize: 11, color: "#555" }}>
                  I can't access a private case unless you choose to include it.
                  Never send passwords or recovery codes.
                </p>
              </>
            )}
            {messages.map((m, i) => (
              <article
                key={i}
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  padding: 10,
                  margin: "8px 0",
                  background: m.role === "user" ? "#e7edf5" : "white",
                  borderLeft:
                    m.role === "user"
                      ? "3px solid #000080"
                      : "3px solid #008080",
                }}
              >
                <strong style={{ fontSize: 11 }}>
                  {m.role === "user" ? "You" : "Pop"}
                </strong>
                <p style={{ margin: "5px 0" }}>{m.text}</p>
              </article>
            ))}
            {busy && <p role="status">Pop is thinking...</p>}
            {error && (
              <p role="alert" style={{ color: "#951818" }}>
                {error}
              </p>
            )}
          </div>
          <form onSubmit={send} style={{ padding: 8 }}>
            <small>
              Signed-in history and approved context are shared with the paired
              extension.{" "}
              {sharedContext
                ? "Shared case: " + sharedContext.title
                : "No case shared."}
            </small>
            {context?.caseId && (
              <label
                style={{
                  display: "flex",
                  gap: 6,
                  fontSize: 11,
                  marginBottom: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={include}
                  onChange={(e) => {
                    contextChoice.current = true;
                    setInclude(e.target.checked);
                  }}
                />
                Include selected case: {context.title}
              </label>
            )}
            <label style={{ display: "block", fontSize: 11 }}>
              Message Pop
              <textarea
                aria-label="Message Pop"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                required
                maxLength={3000}
                rows={3}
                style={{
                  width: "100%",
                  padding: 8,
                  background: "white",
                  color: "#111",
                  border: "1px solid #888",
                  resize: "none",
                  font: "13px Tahoma,sans-serif",
                }}
              />
            </label>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginTop: 5,
              }}
            >
              <small style={{ fontSize: 10, color: "#444", flex: 1 }}>
                Sending shares your message and recent chat with Gemini. AI can
                make mistakes.
              </small>
              <button disabled={busy} style={btn}>
                {busy ? "Thinking..." : "Send"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
