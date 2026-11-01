import React from "react";

const SYS_FONT = "'Pixelify Sans', 'Arial', sans-serif";
const RETRO_FONT = "'Courier New', Courier, monospace";

const raised: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #ffffff, inset -1px -1px #0a0a0a, inset 2px 2px #dfdfdf, inset -2px -2px #808080",
};

const sunken: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #808080, inset -1px -1px #ffffff, inset 2px 2px #0a0a0a, inset -2px -2px #dfdfdf",
};

export function IconCatnip({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ imageRendering: "pixelated" }}>
      {/* Jar outer glass */}
      <rect x="7" y="9" width="18" height="19" rx="2" fill="#e0f2fe" stroke="#000000" strokeWidth="1" />
      <rect x="9" y="11" width="14" height="15" fill="#f0f9ff" />
      {/* Jar lid */}
      <rect x="9" y="5" width="14" height="4" fill="#d97706" stroke="#000000" strokeWidth="1" />
      <rect x="8" y="8" width="16" height="2" fill="#b45309" />
      {/* Catnip leaves inside */}
      <path d="M11 20 Q16 12 21 20 Q16 25 11 20 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.8" />
      <path d="M14 16 L18 22" stroke="#166534" strokeWidth="0.8" />
      <circle cx="13" cy="22" r="1.5" fill="#4ade80" />
      <circle cx="19" cy="18" r="1.5" fill="#4ade80" />
      {/* Label on jar */}
      <rect x="9" y="16" width="14" height="6" fill="#fef3c7" stroke="#000000" strokeWidth="0.5" />
      <text x="16" y="20.5" fill="#78350f" fontSize="4.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
        NIP
      </text>
    </svg>
  );
}

export function CatnipApp({
  hasCatnip,
  onGrabCatnip,
  onPutBackCatnip,
  treatsFed,
  onClose,
}: {
  hasCatnip: boolean;
  onGrabCatnip: () => void;
  onPutBackCatnip: () => void;
  treatsFed: number;
  onClose?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#c0c0c0",
        fontFamily: SYS_FONT,
        fontSize: "12px",
        padding: "10px",
        boxSizing: "border-box",
        gap: "10px",
        userSelect: "none",
      }}
    >
      {/* Header Info */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <IconCatnip size={44} />
        <div>
          <div style={{ fontSize: "14px", fontWeight: "bold", color: "#166534" }}>
            Cyber-Catnip Dispenser '98
          </div>
          <div style={{ fontSize: "11px", color: "#444" }}>
            Hand-harvested organic digital treats for Pop.
          </div>
        </div>
      </div>

      {/* Main Dispenser Stage */}
      <div
        style={{
          ...sunken,
          background: "#ffffff",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "36px", margin: "4px 0" }}>
          {hasCatnip ? "🌿✨" : "🫙"}
        </div>

        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#15803d" }}>
          {hasCatnip ? "You are holding Cyber-Catnip!" : "Jar is Full & Fresh"}
        </div>

        <div style={{ fontSize: "11px", color: "#555", lineHeight: "1.4", fontFamily: RETRO_FONT }}>
          {hasCatnip ? (
            <span style={{ color: "#166534" }}>
              Move your cursor near Pop on the desktop! Pop will smell the catnip, follow your cursor everywhere, and eat it when you click him!
            </span>
          ) : (
            <span>
              Click below to grab a pinch of catnip. Pop can smell it from across the desktop!
            </span>
          )}
        </div>

        <div style={{ marginTop: "6px", display: "flex", justifyContent: "center", gap: "8px" }}>
          {!hasCatnip ? (
            <button
              onClick={onGrabCatnip}
              style={{
                ...raised,
                background: "#22c55e",
                color: "#ffffff",
                fontWeight: "bold",
                padding: "6px 16px",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>🌿</span>
              <span>Grab Cyber-Catnip</span>
            </button>
          ) : (
            <button
              onClick={onPutBackCatnip}
              style={{
                ...raised,
                background: "#f59e0b",
                color: "#ffffff",
                fontWeight: "bold",
                padding: "6px 16px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              ↩ Put Catnip Back in Jar
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#333", ...raised, background: "#e2e8f0", padding: "4px 8px" }}>
        <span>Treats Fed to Pop: <strong>{treatsFed}</strong></span>
        <span>Pop Happiness: <strong>{Math.min(100, 50 + treatsFed * 15)}%</strong></span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
        <button
          onClick={onClose}
          style={{
            ...raised,
            padding: "3px 12px",
            fontSize: "11px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
