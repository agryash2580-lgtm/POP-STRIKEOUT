import React, { useState } from "react";
import { IconPopExe } from "../App";

const SYS_FONT = "'Pixelify Sans', 'Arial', sans-serif";
const BODY_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const raised: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #ffffff, inset -1px -1px #0a0a0a, inset 2px 2px #dfdfdf, inset -2px -2px #808080",
};

const sunken: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #808080, inset -1px -1px #ffffff, inset 2px 2px #0a0a0a, inset -2px -2px #dfdfdf",
};

export function GetPopApp({
  onSummonPet,
  onOpenSimulator,
  activeBrowserTab: controlledTab,
  onTabChange,
}: {
  onSummonPet?: () => void;
  onOpenSimulator?: () => void;
  activeBrowserTab?: "chrome" | "firefox";
  onTabChange?: (tab: "chrome" | "firefox") => void;
}) {
  const [internalTab, setInternalTab] = useState<"chrome" | "firefox">("chrome");
  const activeBrowserTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveBrowserTab = (tab: "chrome" | "firefox") => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#f5f2ea",
        color: "#1c1917",
        fontFamily: BODY_FONT,
        overflowY: "auto",
        padding: "24px 32px",
      }}
    >
      {/* ─── Hero Header ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "24px", alignItems: "center", marginBottom: "24px" }}>
        <div
          style={{
            ...raised,
            background: "#ffffff",
            padding: "16px",
            border: "1px solid #d4cebe",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <img
            src="/pop.png"
            alt="Pop Pet"
            style={{
              width: "88px",
              height: "88px",
              objectFit: "contain",
              imageRendering: "pixelated",
            }}
          />
          <button
            onClick={onSummonPet}
            style={{
              ...raised,
              background: "#c0c0c0",
              border: "none",
              padding: "4px 10px",
              fontFamily: SYS_FONT,
              fontSize: "11px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            🐾 Summon Desktop Pop
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: "bold",
              color: "#78716c",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            SECURITY ASSISTANT & EXTENSION
          </div>
          <h2
            style={{
              fontFamily: SYS_FONT,
              fontSize: "28px",
              fontWeight: "bold",
              color: "#1c1917",
              margin: "0 0 6px 0",
              letterSpacing: "-0.5px",
            }}
          >
            Meet Pop: Your Everyday Guardian
          </h2>
          <div style={{ fontSize: "13px", color: "#57534e", lineHeight: "1.45", maxWidth: "480px" }}>
            Pop floats gently in your browser and desktop, intercepts sensitive credential leaks before they happen, captures cryptographic evidence, and keeps you grounded.
          </div>

          {/* Direct Download Action Grid */}
          <div id="tour-getpop-downloads" style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <a
              href="/pop-chromium-2.2.0.zip"
              download="pop-chromium-2.2.0.zip"
              style={{
                ...raised,
                background: "#166534",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "12px",
                fontFamily: SYS_FONT,
                padding: "8px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>🌐</span>
              <span>Download Chrome / Brave (v2.2.0)</span>
            </a>

            <a
              href="/pop-firefox-2.2.0.zip"
              download="pop-firefox-2.2.0.zip"
              style={{
                ...raised,
                background: "#c2410c",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "12px",
                fontFamily: SYS_FONT,
                padding: "8px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>🦊</span>
              <span>Download Firefox / Zen (v2.2.0)</span>
            </a>

            {onOpenSimulator && (
              <button
                onClick={onOpenSimulator}
                style={{
                  ...raised,
                  background: "#000080",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: "bold",
                  fontSize: "12px",
                  fontFamily: SYS_FONT,
                  padding: "8px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <span>⚡</span>
                <span>Launch Pop.exe Live Simulator</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Feature Highlights Grid ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "24px" }}>
        
        <div
          style={{
            ...raised,
            background: "#ffffff",
            border: "1px solid #d4cebe",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ fontFamily: SYS_FONT, fontSize: "15px", fontWeight: "bold", color: "#1c1917" }}>
            🛡️ Sensitive Data Radar
          </div>
          <div style={{ fontSize: "12px", color: "#57534e", lineHeight: "1.4" }}>
            Checks supported pasted or edited text for identifiers in your local watchlist. Warnings appear after the edit; a site may already have received the text. Password fields are ignored.
          </div>
        </div>

        <div
          style={{
            ...raised,
            background: "#ffffff",
            border: "1px solid #d4cebe",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ fontFamily: SYS_FONT, fontSize: "15px", fontWeight: "bold", color: "#1c1917" }}>
            📸 Cryptographic Evidence Snapshots
          </div>
          <div style={{ fontSize: "12px", color: "#57534e", lineHeight: "1.4" }}>
            Take high-fidelity incident captures with UTC timestamp, URL, and SHA-256 fingerprint, seamlessly ready to import into your Strikeout Recovery Desk dossier.
          </div>
        </div>

        <div
          style={{
            ...raised,
            background: "#ffffff",
            border: "1px solid #d4cebe",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ fontFamily: SYS_FONT, fontSize: "15px", fontWeight: "bold", color: "#1c1917" }}>
            🛑 Anti-Impulsive Posting Check
          </div>
          <div style={{ fontSize: "12px", color: "#57534e", lineHeight: "1.4" }}>
            Pop senses rapid keystrokes during heated interactions and suggests a quick 10-second breath, preventing emotional leaks or regretful social posts.
          </div>
        </div>

        <div
          style={{
            ...raised,
            background: "#ffffff",
            border: "1px solid #d4cebe",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ fontFamily: SYS_FONT, fontSize: "15px", fontWeight: "bold", color: "#1c1917" }}>
            🌿 Cyber-Catnip & Companion
          </div>
          <div style={{ fontSize: "12px", color: "#57534e", lineHeight: "1.4" }}>
            A comforting digital friend. Pop stays near you in the bottom right corner, purrs when petted, and enthusiastically chases Cyber-Catnip when fed.
          </div>
        </div>
      </div>

      {/* ─── Installation Walkthrough ─────────────────────────────────────── */}
      <div
        style={{
          ...raised,
          background: "#ffffff",
          border: "1px solid #d4cebe",
          padding: "18px 20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontFamily: SYS_FONT, fontSize: "16px", fontWeight: "bold", color: "#1c1917" }}>
            Quick 60-Second Setup Guide
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setActiveBrowserTab("chrome")}
              style={{
                fontFamily: SYS_FONT,
                fontSize: "11px",
                padding: "3px 10px",
                background: activeBrowserTab === "chrome" ? "#000080" : "#c0c0c0",
                color: activeBrowserTab === "chrome" ? "#ffffff" : "#000000",
                border: "none",
                cursor: "pointer",
                ...(activeBrowserTab === "chrome" ? sunken : raised),
              }}
            >
              Chrome / Brave / Edge
            </button>

            <button
              onClick={() => setActiveBrowserTab("firefox")}
              style={{
                fontFamily: SYS_FONT,
                fontSize: "11px",
                padding: "3px 10px",
                background: activeBrowserTab === "firefox" ? "#000080" : "#c0c0c0",
                color: activeBrowserTab === "firefox" ? "#ffffff" : "#000000",
                border: "none",
                cursor: "pointer",
                ...(activeBrowserTab === "firefox" ? sunken : raised),
              }}
            >
              Firefox / Zen
            </button>
          </div>
        </div>

        {activeBrowserTab === "chrome" ? (
          <ol style={{ fontSize: "13px", color: "#44403c", lineHeight: "1.6", margin: "0", paddingLeft: "20px" }}>
            <li>Download <strong>pop-chromium-2.2.0.zip</strong> and unzip the folder to your disk.</li>
            <li>In Chrome or Brave, navigate to <code>chrome://extensions</code> in your address bar.</li>
            <li>Toggle <strong>Developer mode</strong> ON in the top right corner.</li>
            <li>Click <strong>Load unpacked</strong> and select the unzipped Pop extension folder.</li>
            <li>Pin Pop to your browser toolbar to activate real-time field defense!</li>
          </ol>
        ) : (
          <ol style={{ fontSize: "13px", color: "#44403c", lineHeight: "1.6", margin: "0", paddingLeft: "20px" }}>
            <li>Download <strong>pop-firefox-2.2.0.zip</strong> and unzip the folder.</li>
            <li>In Firefox or Zen, navigate to <code>about:debugging#/runtime/this-firefox</code>.</li>
            <li>Click <strong>Load Temporary Add-on...</strong></li>
            <li>Select <code>manifest.json</code> from the unzipped folder.</li>
            <li>Pop is active and guarding your Firefox session!</li>
          </ol>
        )}
      </div>
    </div>
  );
}
