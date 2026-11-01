import React, { useEffect, useRef, useState } from "react";
export function PopPet({
  isOpen,
  onClose,
  hasCatnip,
  onFeedCatnip,
  titleBarGradient = "linear-gradient(90deg,#881337,#be123c)",
}: any) {
  const [pos, setPos] = useState({
      x: Math.max(12, innerWidth - 105),
      y: Math.max(12, innerHeight - 125),
    }),
    [menu, setMenu] = useState(false),
    [quote, setQuote] = useState(""),
    [pat, setPat] = useState(false);
  const drag = useRef<any>(null),
    moved = useRef(false),
    count = useRef(0),
    timer = useRef<any>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    function move(e: PointerEvent) {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.mx,
        dy = e.clientY - drag.current.my;
      if (Math.abs(dx) + Math.abs(dy) > 5) moved.current = true;
      if (moved.current)
        setPos({
          x: Math.max(0, Math.min(innerWidth - 72, drag.current.x + dx)),
          y: Math.max(0, Math.min(innerHeight - 105, drag.current.y + dy)),
        });
    }
    function end() {
      drag.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, []);
  function pet() {
    if (moved.current) return;
    count.current++;
    setPat(true);
    setMenu(false);
    if (hasCatnip) {
      onFeedCatnip?.();
      setQuote("Payment received. Suspiciously leafy.");
    } else
      setQuote(
        count.current % 7 === 0
          ? "Seven pats. Your tabs remain a disaster."
          : [
              "Cybersecurity department accepting head pats.",
              "Finally. Competent management.",
              "This meeting could have been a head pat.",
            ][Math.floor(Math.random() * 3)],
      );
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setQuote("");
      setPat(false);
    }, 3000);
  }
  function open(section: string) {
    window.dispatchEvent(
      new CustomEvent("strikeout-open", { detail: { section } }),
    );
    setMenu(false);
  }
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: 72,
        height: 72,
        zIndex: 80000,
        font: "12px Tahoma,sans-serif",
      }}
    >
      {quote && (
        <div
          role="status"
          style={{
            position: "absolute",
            bottom: 78,
            right: 0,
            width: 180,
            background: "#ffffe1",
            border: "1px solid #111",
            padding: 9,
            color: "#111",
          }}
        >
          {quote}
        </div>
      )}
      {menu && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: 78,
            right: 0,
            width: 220,
            background: "#c0c0c0",
            padding: 4,
            boxShadow: "inset 1px 1px #fff,inset -1px -1px #111",
            color: "#111",
          }}
        >
          <strong
            style={{
              display: "block",
              background: titleBarGradient,
              color: "white",
              padding: 5,
            }}
          >
            Pop.exe / Tools
          </strong>
          {[
            ["cases", "Cases & reports"],
            ["new", "Log an incident"],
            ["settings", "Connect & download extension"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => open(id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 8,
                border: 0,
                background: "transparent",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              setMenu(false);
              setQuote("");
            }}
            style={{ padding: 7 }}
          >
            Minimise
          </button>
          <button onClick={onClose} style={{ padding: 7 }}>
            Hide Pop
          </button>
        </div>
      )}
      <button
        aria-label="Pet Pop; right-click for tools"
        title="Left-click to pet. Right-click for tools. Drag to move."
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          moved.current = false;
          drag.current = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y };
        }}
        onClick={pet}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(!menu);
          setQuote("");
        }}
        onKeyDown={(e) => {
          if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
            e.preventDefault();
            setMenu(!menu);
          }
        }}
        style={{
          background: "none",
          border: 0,
          width: 72,
          height: 72,
          padding: 0,
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <img
          alt="Pop the cat"
          src="/pop.png"
          style={{
            width: 72,
            height: 72,
            imageRendering: "pixelated",
            objectFit: "contain",
            transform: pat ? "scale(1.08,.92)" : "none",
          }}
        />
      </button>
    </div>
  );
}
