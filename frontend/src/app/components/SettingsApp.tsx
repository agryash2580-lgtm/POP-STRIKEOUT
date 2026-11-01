import React, { useState } from "react";

const SYS_FONT = "'Pixelify Sans', 'Arial', sans-serif";

const raised: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #ffffff, inset -1px -1px #0a0a0a, inset 2px 2px #dfdfdf, inset -2px -2px #808080",
};

const sunken: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #808080, inset -1px -1px #ffffff, inset 2px 2px #0a0a0a, inset -2px -2px #dfdfdf",
};

export function IconSettings({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ imageRendering: "pixelated" }}>
      <rect x="3" y="5" width="26" height="22" rx="2" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
      <rect x="3" y="5" width="26" height="5" fill="#000080" stroke="#000" strokeWidth="1" rx="2" />
      <rect x="3" y="8" width="26" height="2" fill="#000080" />
      <circle cx="7" cy="8" r="1" fill="#fff" />
      <circle cx="10" cy="8" r="1" fill="#fff" />
      <rect x="7" y="14" width="12" height="2" fill="#808080" rx="1" />
      <rect x="14" y="12" width="4" height="6" fill="#dfdfdf" stroke="#000" strokeWidth="0.5" rx="1" />
      <rect x="7" y="21" width="12" height="2" fill="#808080" rx="1" />
      <rect x="10" y="19" width="4" height="6" fill="#dfdfdf" stroke="#000" strokeWidth="0.5" rx="1" />
    </svg>
  );
}

export function SettingsApp({
  desktopColor,
  setDesktopColor,
  desktopText,
  setDesktopText,
  desktopTexture,
  setDesktopTexture,
  wallpaperMode = "default",
  setWallpaperMode,
  titleBarTheme,
  setTitleBarTheme,
  iconSize = "medium",
  setIconSize,
  screenSaver = "starfield",
  setScreenSaver,
  onPreviewScreenSaver,
  onResetAllSettings,
  onClose,
}: {
  desktopColor: string;
  setDesktopColor: (c: string) => void;
  desktopText: string;
  setDesktopText: (t: string) => void;
  desktopTexture: "none" | "dither" | "scanlines" | "grid";
  setDesktopTexture: (t: "none" | "dither" | "scanlines" | "grid") => void;
  wallpaperMode?: "default" | "supersecret";
  setWallpaperMode?: (m: "default" | "supersecret") => void;
  titleBarTheme: string;
  setTitleBarTheme: (t: string) => void;
  iconSize?: "small" | "medium" | "large";
  setIconSize?: (s: "small" | "medium" | "large") => void;
  screenSaver?: string;
  setScreenSaver?: (s: string) => void;
  onPreviewScreenSaver?: () => void;
  onResetAllSettings: () => void;
  onClose?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"desktop" | "themes" | "titlebar" | "screensaver">("desktop");

  const desktopThemes = [
    { key: "teal", label: "Classic Win95 Teal", hex: "#008080" },
    { key: "navy", label: "Cyber Midnight Navy", hex: "#0a192f" },
    { key: "matrix", label: "Matrix Terminal Green", hex: "#051a0d" },
    { key: "vapor", label: "Synthwave Violet", hex: "#2d114d" },
    { key: "grey", label: "Battleship Industrial Grey", hex: "#555555" },
    { key: "rose", label: "Cyber Hot Rose", hex: "#831843" },
    { key: "ocean", label: "Deep Ocean Abyss", hex: "#0f2b48" },
    { key: "solar", label: "Solar Amber CRT", hex: "#3b2204" },
  ];

  const titleBarThemes = [
    { key: "charcoal", label: "Dark Slate / Charcoal (Retro Modern)", gradient: "linear-gradient(90deg, #2d3436, #4b4b4b)" },
    { key: "classic_navy", label: "Classic Windows Navy Gradient", gradient: "linear-gradient(90deg, #000080, #1084d0)" },
    { key: "purple", label: "Cyberpunk Violet / Indigo", gradient: "linear-gradient(90deg, #4c1d95, #6d28d9)" },
    { key: "matrix", label: "Matrix Phosphor Dark Green", gradient: "linear-gradient(90deg, #052e16, #166534)" },
    { key: "slate", label: "Battleship Steel Grey", gradient: "linear-gradient(90deg, #576574, #8395a7)" },
    { key: "crimson", label: "Hot Crimson Red", gradient: "linear-gradient(90deg, #881337, #be123c)" },
  ];

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
        overflow: "hidden",
      }}
    >
      {/* Tab Switcher */}
      <div
        style={{
          display: "flex",
          background: "#d4d0c8",
          borderBottom: "2px solid #808080",
          padding: "4px 8px 0",
          gap: "4px",
        }}
      >
        <button
          onClick={() => setActiveTab("desktop")}
          style={{
            fontFamily: SYS_FONT,
            fontSize: "11px",
            fontWeight: activeTab === "desktop" ? "bold" : "normal",
            padding: "3px 10px",
            background: activeTab === "desktop" ? "#c0c0c0" : "#b0b0b0",
            border: "none",
            cursor: "pointer",
            borderTop: "2px solid #fff",
            borderLeft: "2px solid #fff",
            borderRight: "2px solid #404040",
            marginBottom: activeTab === "desktop" ? "-2px" : "0",
            zIndex: activeTab === "desktop" ? 2 : 1,
          }}
        >
          🖥️ Wallpaper & Texture
        </button>
        <button
          onClick={() => setActiveTab("themes")}
          style={{
            fontFamily: SYS_FONT,
            fontSize: "11px",
            fontWeight: activeTab === "themes" ? "bold" : "normal",
            padding: "3px 10px",
            background: activeTab === "themes" ? "#c0c0c0" : "#b0b0b0",
            border: "none",
            cursor: "pointer",
            borderTop: "2px solid #fff",
            borderLeft: "2px solid #fff",
            borderRight: "2px solid #404040",
            marginBottom: activeTab === "themes" ? "-2px" : "0",
            zIndex: activeTab === "themes" ? 2 : 1,
          }}
        >
          🎨 Color Themes
        </button>
        <button
          onClick={() => setActiveTab("titlebar")}
          style={{
            fontFamily: SYS_FONT,
            fontSize: "11px",
            fontWeight: activeTab === "titlebar" ? "bold" : "normal",
            padding: "3px 10px",
            background: activeTab === "titlebar" ? "#c0c0c0" : "#b0b0b0",
            border: "none",
            cursor: "pointer",
            borderTop: "2px solid #fff",
            borderLeft: "2px solid #fff",
            borderRight: "2px solid #404040",
            marginBottom: activeTab === "titlebar" ? "-2px" : "0",
            zIndex: activeTab === "titlebar" ? 2 : 1,
          }}
        >
          🏷️ Title Bar Style
        </button>
        <button
          onClick={() => setActiveTab("screensaver")}
          style={{
            fontFamily: SYS_FONT,
            fontSize: "11px",
            fontWeight: activeTab === "screensaver" ? "bold" : "normal",
            padding: "3px 10px",
            background: activeTab === "screensaver" ? "#c0c0c0" : "#b0b0b0",
            border: "none",
            cursor: "pointer",
            borderTop: "2px solid #fff",
            borderLeft: "2px solid #fff",
            borderRight: "2px solid #404040",
            marginBottom: activeTab === "screensaver" ? "-2px" : "0",
            zIndex: activeTab === "screensaver" ? 2 : 1,
          }}
        >
          🕹️ FX & Screensaver
        </button>
      </div>

      {/* Main Settings Body */}
      <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {activeTab === "desktop" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Wallpaper Selection (including supersecretwallpaper) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold" }}>Wallpaper Mode:</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {/* Default Retro Pattern */}
                <div
                  onClick={() => setWallpaperMode && setWallpaperMode("default")}
                  style={{
                    ...raised,
                    padding: "6px 8px",
                    background: wallpaperMode === "default" ? "#ffffff" : "#f1f2f6",
                    border: wallpaperMode === "default" ? "2px solid #000080" : "1px solid #ced6e0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "18px" }}>🖥️</div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: wallpaperMode === "default" ? "bold" : "normal" }}>
                      Classic Pattern
                    </div>
                    <div style={{ fontSize: "9px", color: "#666" }}>Color & Texture</div>
                  </div>
                </div>

                {/* Super Secret Wallpaper */}
                <div
                  onClick={() => setWallpaperMode && setWallpaperMode("supersecret")}
                  style={{
                    ...raised,
                    padding: "6px 8px",
                    background: wallpaperMode === "supersecret" ? "#ffffff" : "#f1f2f6",
                    border: wallpaperMode === "supersecret" ? "2px solid #000080" : "1px solid #ced6e0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src="/supersecret.png"
                    alt="Secret"
                    style={{
                      width: "24px",
                      height: "32px",
                      objectFit: "contain",
                      border: "1px solid #000",
                      background: "#fff",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: wallpaperMode === "supersecret" ? "bold" : "normal", color: "#1e3a8a" }}>
                      🕶️ supersecretwallpaper
                    </div>
                    <div style={{ fontSize: "9px", color: "#666" }}>100% Uncropped</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "#808080", borderBottom: "1px solid #fff" }} />

            {/* Desktop Texture */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ width: "110px", fontSize: "11px" }}>Texture Effect:</label>
              <select
                value={desktopTexture}
                onChange={(e) => setDesktopTexture(e.target.value as any)}
                style={{ ...sunken, padding: "3px 6px", background: "#ffffff", flex: 1, fontSize: "11px" }}
              >
                <option value="dither">Win95 Pixel Dither (Matte)</option>
                <option value="scanlines">CRT Phosphor Scanlines</option>
                <option value="grid">Cyberpunk Blueprint Grid</option>
                <option value="none">Flat Solid Clean</option>
              </select>
            </div>

            {/* Centered Wallpaper Text */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ width: "110px", fontSize: "11px" }}>Watermark Text:</label>
              <input
                type="text"
                value={desktopText}
                onChange={(e) => setDesktopText(e.target.value)}
                placeholder="STRIKEOUT"
                style={{ ...sunken, padding: "3px 6px", background: "#ffffff", flex: 1, fontSize: "11px" }}
              />
            </div>

            {/* Quick preset watermark buttons */}
            <div style={{ display: "flex", gap: "6px", marginLeft: "120px", flexWrap: "wrap" }}>
              {["STRIKEOUT", "POP", "DEFCON 3", "NO TEXT"].map((t) => (
                <button
                  key={t}
                  onClick={() => setDesktopText(t === "NO TEXT" ? "" : t)}
                  style={{ ...raised, fontSize: "10px", padding: "1px 6px", cursor: "pointer" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "themes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "11px", color: "#444" }}>
              Click any color swatch below to test the desktop palette instantly:
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {desktopThemes.map((th) => {
                const isSelected = desktopColor === th.key;
                return (
                  <div
                    key={th.key}
                    onClick={() => setDesktopColor(th.key)}
                    style={{
                      ...raised,
                      padding: "6px 8px",
                      background: isSelected ? "#ffffff" : "#f1f2f6",
                      border: isSelected ? "2px solid #000080" : "1px solid #ced6e0",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        background: th.hex,
                        border: "1px solid #000",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ fontSize: "11px", fontWeight: isSelected ? "bold" : "normal" }}>
                      {th.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "titlebar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "11px", color: "#444" }}>
              Customize the title bar color gradient across Pop's dialog and system windows:
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {titleBarThemes.map((tb) => {
                const isSelected = titleBarTheme === tb.key;
                return (
                  <div
                    key={tb.key}
                    onClick={() => setTitleBarTheme(tb.key)}
                    style={{
                      ...raised,
                      padding: "6px 10px",
                      background: isSelected ? "#ffffff" : "#f8f9fa",
                      border: isSelected ? "2px solid #000080" : "1px solid #ced6e0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: isSelected ? "bold" : "normal", fontSize: "11px" }}>
                      {tb.label}
                    </div>
                    <div
                      style={{
                        width: "70px",
                        height: "14px",
                        background: tb.gradient,
                        border: "1px solid #000",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "screensaver" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Screensaver selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold" }}>Screen Saver:</label>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <select
                  value={screenSaver}
                  onChange={(e) => setScreenSaver && setScreenSaver(e.target.value)}
                  style={{ ...sunken, padding: "3px 6px", background: "#ffffff", flex: 1, fontSize: "11px" }}
                >
                  <option value="none">None</option>
                  <option value="starfield">Starfield Simulation '98</option>
                  <option value="windows">Flying Windows 95</option>
                  <option value="mystify">Mystify Your Mind</option>
                </select>
                <button
                  disabled={screenSaver === "none"}
                  onClick={onPreviewScreenSaver}
                  style={{
                    ...raised,
                    padding: "3px 10px",
                    fontWeight: "bold",
                    fontSize: "11px",
                    cursor: screenSaver === "none" ? "default" : "pointer",
                    opacity: screenSaver === "none" ? 0.5 : 1,
                  }}
                >
                  Preview
                </button>
              </div>
              <span style={{ fontSize: "10px", color: "#666" }}>
                Auto-activates after 60s of inactivity or test immediately with Preview.
              </span>
            </div>

            <div style={{ height: "1px", background: "#808080", borderBottom: "1px solid #fff" }} />

            {/* Desktop Icon Size */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold" }}>Desktop Icon Size:</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { key: "small", label: "Small (32px)" },
                  { key: "medium", label: "Normal (38px)" },
                  { key: "large", label: "Large (48px)" },
                ].map((s) => {
                  const isSelected = iconSize === s.key;
                  return (
                    <div
                      key={s.key}
                      onClick={() => setIconSize && setIconSize(s.key as any)}
                      style={{
                        ...raised,
                        padding: "6px 10px",
                        background: isSelected ? "#ffffff" : "#f1f2f6",
                        border: isSelected ? "2px solid #000080" : "1px solid #ced6e0",
                        cursor: "pointer",
                        flex: 1,
                        textAlign: "center",
                        fontSize: "11px",
                        fontWeight: isSelected ? "bold" : "normal",
                      }}
                    >
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Reset settings button */}
        <div style={{ marginTop: "auto", borderTop: "1px solid #999", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
          <button
            onClick={onResetAllSettings}
            style={{ ...raised, padding: "3px 10px", fontSize: "11px", cursor: "pointer" }}
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            style={{ ...raised, padding: "3px 14px", fontWeight: "bold", fontSize: "11px", cursor: "pointer" }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
