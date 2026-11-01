import React, { useState, useEffect, useRef, useCallback } from "react";
import { PopPet } from "./components/PopCompanion";
import { TerminalApp, IconTerminal } from "./components/ServiceConsole";
import { SystemMonitorApp, IconMonitor } from "./components/ServiceStatus";
import { SettingsApp, IconSettings } from "./components/SettingsApp";
import { IconCatnip } from "./components/CatnipApp";
import { ScreenSaver } from "./components/ScreenSaver";
import { RecoveryApp, IconCases } from "./components/RecoveryApp";
import { PopPet as PopTutorial } from "./components/GuidedTour";
import { ExposureApp, IconExposure } from "./components/ExposureApp";
import {
  ExtensionDemoApp,
  IconExtensionSim,
} from "./components/ExtensionDemoApp";
import { GetPopApp } from "./components/GetPopApp";
import { GuideChat } from "./components/GuideChat";

// ─── Font Constants ─────────────────────────────────────────────────────────
const SYS_FONT = "'Pixelify Sans', 'Arial', sans-serif";

// ─── Win95 Style Helpers ────────────────────────────────────────────────────
const raised: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #ffffff, inset -1px -1px #0a0a0a, inset 2px 2px #dfdfdf, inset -2px -2px #808080",
};

const sunken: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #808080, inset -1px -1px #ffffff, inset 2px 2px #0a0a0a, inset -2px -2px #dfdfdf",
};

const COLOR_MAP: Record<string, string> = {
  teal: "#008080",
  navy: "#0a192f",
  matrix: "#051a0d",
  vapor: "#2d114d",
  grey: "#555555",
  rose: "#831843",
  ocean: "#0f2b48",
  solar: "#3b2204",
};

const TITLEBAR_GRADIENTS: Record<string, string> = {
  charcoal: "linear-gradient(90deg, #2d3436, #4b4b4b)",
  classic_navy: "linear-gradient(90deg, #000080, #1084d0)",
  purple: "linear-gradient(90deg, #4c1d95, #6d28d9)",
  matrix: "linear-gradient(90deg, #052e16, #166534)",
  slate: "linear-gradient(90deg, #576574, #8395a7)",
  crimson: "linear-gradient(90deg, #881337, #be123c)",
};

// ─── Icon Component for Pop ─────────────────────────────────────────────────
export function IconPopExe({ size = 32 }: { size?: number }) {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <img
        src="/pop.png"
        alt="POP"
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          imageRendering: "pixelated",
          filter: "drop-shadow(1px 1px 0px rgba(0,0,0,0.4))",
        }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ imageRendering: "pixelated" }}
    >
      <path
        d="M4 6 L16 2 L28 6 L28 18 C28 25 16 30 16 30 C16 30 4 25 4 18 Z"
        fill="#14142b"
        stroke="#000000"
        strokeWidth="1"
      />
      <path
        d="M6 7 L16 4 L26 7 L26 18 C26 23 16 28 16 28 C16 28 6 23 6 18 Z"
        fill="#4c1d95"
        stroke="#a78bfa"
        strokeWidth="0.8"
      />
      <circle
        cx="16"
        cy="16"
        r="6"
        fill="none"
        stroke="#00f3ff"
        strokeWidth="1"
        strokeDasharray="2,2"
      />
      <circle cx="16" cy="16" r="2" fill="#00ff66" />
      <rect
        x="5"
        y="21"
        width="22"
        height="8"
        fill="#e11d48"
        stroke="#000"
        strokeWidth="0.8"
      />
      <text
        x="16"
        y="27.5"
        fill="#ffffff"
        fontSize="6"
        fontWeight="bold"
        fontFamily="monospace"
        textAnchor="middle"
      >
        POP
      </text>
    </svg>
  );
}

// ─── Win95 Button ───────────────────────────────────────────────────────────
function W95Btn({
  children,
  onClick,
  active,
  style = {},
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const down = pressed || active;

  return (
    <button
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      style={{
        background: "#c0c0c0",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        fontFamily: SYS_FONT,
        fontSize: "12px",
        padding: "3px 8px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        userSelect: "none",
        opacity: disabled ? 0.6 : 1,
        boxShadow: down
          ? "inset -1px -1px #ffffff, inset 1px 1px #0a0a0a, inset -2px -2px #dfdfdf, inset 2px 2px #808080"
          : "inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf",
        outline: "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Title Bar Button ───────────────────────────────────────────────────────
function TitleBtn({
  label,
  onClick,
  description,
}: {
  label: string;
  onClick?: () => void;
  description?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      aria-label={description || label}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      style={{
        width: "16px",
        height: "14px",
        background: "#c0c0c0",
        border: "none",
        fontSize: "9px",
        fontWeight: "bold",
        fontFamily: SYS_FONT,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 1,
        color: "black",
        userSelect: "none",
        boxShadow: pressed
          ? "inset 1px 1px #0a0a0a, inset -1px -1px #ffffff"
          : "inset -1px -1px #0a0a0a, inset 1px 1px #ffffff",
      }}
    >
      {label}
    </button>
  );
}

// ─── Window State Interface ─────────────────────────────────────────────────
type AppId =
  | "terminal"
  | "monitor"
  | "settings"
  | "about"
  | "cases"
  | "exposure"
  | "extsim"
  | "getpop";

interface WinState {
  isOpen: boolean;
  isMinimized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

// ─── Win95 Window Frame Component ───────────────────────────────────────────
function Win95Window({
  id,
  title,
  icon: Icon,
  titleBarGradient,
  state,
  isActive,
  children,
  onClose,
  onMinimize,
  onFocus,
  onDragStart,
  onResizeStart,
  isMobile,
}: {
  id: AppId;
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  titleBarGradient: string;
  state: WinState;
  isActive: boolean;
  children: React.ReactNode;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, dir: "r" | "b" | "se") => void;
  isMobile: boolean;
}) {
  if (!state.isOpen) return null;

  const windowStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: 4,
        top: 4,
        right: 4,
        bottom: 38,
        zIndex: state.zIndex,
        display: "flex",
        flexDirection: "column",
        background: "#c0c0c0",
        boxShadow:
          "inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf, 3px 3px 0 #000000",
      }
    : {
        position: "absolute",
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
        zIndex: state.zIndex,
        display: "flex",
        flexDirection: "column",
        background: "#c0c0c0",
        boxShadow:
          "inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf, 3px 3px 0 #000000",
      };

  return (
    <div
      style={{ ...windowStyle, display: state.isMinimized ? "none" : "flex" }}
      onPointerDownCapture={isActive ? undefined : onFocus}
    >
      {/* Title Bar */}
      <div
        onMouseDown={!isMobile ? onDragStart : undefined}
        style={{
          background: isActive
            ? titleBarGradient
            : "linear-gradient(to right, #808080, #b5b5b5)",
          padding: "3px 4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          cursor: isMobile ? "default" : "move",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            overflow: "hidden",
          }}
        >
          <Icon size={16} />
          <span
            style={{
              color: "white",
              fontSize: "12px",
              fontWeight: "bold",
              fontFamily: SYS_FONT,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </span>
        </div>
        <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
          <TitleBtn
            label="─"
            description={"Minimize " + title}
            onClick={onMinimize}
          />
          <TitleBtn
            label="✕"
            description={"Close " + title}
            onClick={onClose}
          />
        </div>
      </div>

      {/* Window Body */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>

      {/* Resize Handle for Desktop */}
      {!isMobile && (
        <>
          <div
            onMouseDown={(e) => onResizeStart(e, "r")}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 8,
              width: 4,
              cursor: "ew-resize",
            }}
          />
          <div
            onMouseDown={(e) => onResizeStart(e, "b")}
            style={{
              position: "absolute",
              left: 0,
              right: 8,
              bottom: 0,
              height: 4,
              cursor: "ns-resize",
            }}
          />
          <div
            onMouseDown={(e) => onResizeStart(e, "se")}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 12,
              height: 12,
              cursor: "nwse-resize",
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Desktop Icon Component ─────────────────────────────────────────────────
function DesktopIcon({
  icon: Icon,
  label,
  selected,
  size = "medium",
  customIconSize,
  onClick,
  onDoubleClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  selected: boolean;
  size?: "small" | "medium" | "large";
  customIconSize?: number;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  const baseIconPx = size === "small" ? 28 : size === "large" ? 48 : 38;
  const iconPx = customIconSize || baseIconPx;
  const containerW =
    size === "small" ? "68px" : size === "large" ? "98px" : "82px";
  const fontPx = size === "small" ? "11px" : size === "large" ? "13px" : "12px";

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 6px",
        cursor: "pointer",
        userSelect: "none",
        width: containerW,
        outline: selected ? "1px dotted #ffffff" : "none",
      }}
    >
      <div style={{ position: "relative" }}>
        <Icon size={iconPx} />
      </div>
      <div
        style={{
          marginTop: "4px",
          color: "#ffffff",
          fontFamily: SYS_FONT,
          fontSize: fontPx,
          textAlign: "center",
          textShadow: "1px 1px 1px #000000",
          background: selected ? "#000080" : "transparent",
          padding: "1px 4px",
          wordBreak: "break-word",
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── About Strikeout Dialog ─────────────────────────────────────────────────
function AboutApp({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        height: "100%",
        boxSizing: "border-box",
        background: "#c0c0c0",
      }}
    >
      <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
        <IconPopExe size={48} />
        <div>
          <div
            style={{ fontSize: "16px", fontWeight: "bold", color: "#000080" }}
          >
            Strikeout OS
          </div>
          <div style={{ fontSize: "11px", color: "#333" }}>
            Featuring Pop the Browser Assistant
          </div>
        </div>
      </div>

      <div
        style={{
          ...sunken,
          background: "#ffffff",
          padding: "10px",
          fontSize: "11px",
          lineHeight: "1.5",
          color: "#000",
        }}
      >
        Double click <strong>Pop</strong> to summon Pop! Pop is your browser
        extension assistant that floats around, warns you before typing
        sensitive data, and captures instant evidence.
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "auto",
        }}
      >
        <W95Btn
          onClick={onClose}
          style={{ minWidth: "70px", fontWeight: "bold" }}
        >
          OK
        </W95Btn>
      </div>
    </div>
  );
}

// ─── Taskbar Component ──────────────────────────────────────────────────────
function Taskbar({
  windows,
  activeId,
  startOpen,
  onStartClick,
  onWindowClick,
  popPetOpen,
  onTogglePopPet,
}: {
  windows: Record<AppId, WinState>;
  activeId: AppId | null;
  startOpen: boolean;
  onStartClick: () => void;
  onWindowClick: (id: AppId) => void;
  popPetOpen: boolean;
  onTogglePopPet: () => void;
}) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getAppTitle = (id: AppId) => {
    switch (id) {
      case "terminal":
        return "Shell";
      case "monitor":
        return "System Monitor";
      case "settings":
        return "Settings";
      case "about":
        return "About Strikeout";
      case "cases":
        return "Cases & Reports";
      case "exposure":
        return "Check Exposure";
      case "extsim":
        return "Extension Simulator";
      case "getpop":
        return "Pop";
    }
  };

  const getAppIcon = (id: AppId) => {
    switch (id) {
      case "terminal":
        return IconTerminal;
      case "monitor":
        return IconMonitor;
      case "settings":
        return IconSettings;
      case "about":
        return IconPopExe;
      case "cases":
        return IconCases;
      case "exposure":
        return IconExposure;
      case "extsim":
        return IconExtensionSim;
      case "getpop":
        return IconPopExe;
    }
  };

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "32px",
        background: "#c0c0c0",
        boxShadow: "inset 0 1px 0 #ffffff, inset 0 2px 0 #dfdfdf",
        borderTop: "1px solid #ffffff",
        display: "flex",
        alignItems: "center",
        padding: "2px 4px",
        gap: "4px",
        zIndex: 99999,
        userSelect: "none",
      }}
    >
      {/* Start Button */}
      <W95Btn
        active={startOpen}
        onClick={onStartClick}
        style={{
          fontWeight: "bold",
          fontSize: "12px",
          height: "24px",
          padding: "2px 8px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "6px 6px",
            gap: "1px",
          }}
        >
          <div style={{ width: "6px", height: "6px", background: "#ff0000" }} />
          <div style={{ width: "6px", height: "6px", background: "#00aa00" }} />
          <div style={{ width: "6px", height: "6px", background: "#0000ff" }} />
          <div style={{ width: "6px", height: "6px", background: "#ffaa00" }} />
        </div>
        <span>Start</span>
      </W95Btn>

      {/* Pop Button on Taskbar (Clean 'pop.exe' label, no 'Pet' text) */}
      <button
        onClick={onTogglePopPet}
        style={{
          background: popPetOpen ? "#e6e6e6" : "#c0c0c0",
          border: "none",
          cursor: "pointer",
          fontFamily: SYS_FONT,
          fontSize: "11px",
          height: "24px",
          padding: "2px 8px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          fontWeight: popPetOpen ? "bold" : "normal",
          minWidth: "80px",
          maxWidth: "130px",
          boxShadow: popPetOpen
            ? "inset 1px 1px #0a0a0a, inset -1px -1px #ffffff, inset 2px 2px #808080, inset -2px -2px #dfdfdf"
            : "inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf",
        }}
        title="Toggle Pop Assistant"
      >
        <IconPopExe size={14} />
        <span>Pop</span>
      </button>

      {/* Running window taskbar pills */}
      <div style={{ flex: 1, display: "flex", gap: "3px", overflowX: "auto" }}>
        {(Object.entries(windows) as [AppId, WinState][]).map(([id, state]) => {
          if (!state.isOpen) return null;
          const isCurrentActive = activeId === id && !state.isMinimized;
          const Icon = getAppIcon(id);
          const title = getAppTitle(id);
          return (
            <button
              key={id}
              onClick={() => onWindowClick(id)}
              style={{
                background: isCurrentActive ? "#e6e6e6" : "#c0c0c0",
                border: "none",
                cursor: "pointer",
                fontFamily: SYS_FONT,
                fontSize: "11px",
                height: "24px",
                padding: "2px 8px",
                minWidth: "90px",
                maxWidth: "150px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                boxShadow: isCurrentActive
                  ? "inset 1px 1px #0a0a0a, inset -1px -1px #ffffff, inset 2px 2px #808080, inset -2px -2px #dfdfdf"
                  : "inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf",
              }}
            >
              <Icon size={14} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {title}
              </span>
            </button>
          );
        })}
      </div>

      {/* System Tray */}
      <div
        style={{
          ...sunken,
          background: "#c0c0c0",
          height: "22px",
          padding: "2px 8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "11px",
          fontFamily: SYS_FONT,
        }}
      >
        <span title="System Volume">🔊</span>
        <span>{timeStr}</span>
      </div>
    </div>
  );
}

// ─── Start Menu ─────────────────────────────────────────────────────────────
function StartMenu({
  onOpenApp,
  onOpenPopPet,
  onGrabCatnip,
  onClose,
}: {
  onOpenApp: (id: AppId) => void;
  onOpenPopPet: () => void;
  onGrabCatnip: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        bottom: "32px",
        left: 0,
        width: "240px",
        background: "#c0c0c0",
        ...raised,
        boxShadow: "2px -2px 6px rgba(0,0,0,0.4)",
        display: "flex",
        zIndex: 100000,
        fontFamily: SYS_FONT,
      }}
    >
      {/* Blue Sidebar Banner */}
      <div
        style={{
          background: "linear-gradient(to top, #000080, #1084d0)",
          width: "26px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "6px 0",
        }}
      >
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: "13px",
            letterSpacing: "2px",
          }}
        >
          STRIKEOUT 98
        </span>
      </div>

      {/* Menu Items */}
      <div
        style={{
          flex: 1,
          padding: "3px 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Pop Pet launcher */}
        <div
          onClick={() => {
            onOpenPopPet();
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "bold",
            background: "#eff6ff",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000080";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#eff6ff";
            e.currentTarget.style.color = "#000";
          }}
        >
          <IconPopExe size={22} />
          <span>Pop</span>
        </div>

        <div
          style={{
            height: "1px",
            background: "#808080",
            borderBottom: "1px solid #fff",
            margin: "3px 2px",
          }}
        />

        {/* catnip - equips catnip directly into hand! */}
        <div
          onClick={() => {
            onGrabCatnip();
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: "bold",
            color: "#166534",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000080";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#166534";
          }}
        >
          <IconCatnip size={18} />
          <span>Cyber-Catnip</span>
        </div>

        <div
          onClick={() => {
            onOpenApp("terminal");
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "11px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000080";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#000";
          }}
        >
          <IconTerminal size={18} />
          <span>Shell (Terminal)</span>
        </div>

        <div
          onClick={() => {
            onOpenApp("monitor");
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "11px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000080";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#000";
          }}
        >
          <IconMonitor size={18} />
          <span>System Monitor</span>
        </div>

        <div
          onClick={() => {
            onOpenApp("settings");
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "11px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000080";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#000";
          }}
        >
          <IconSettings size={18} />
          <span>Settings</span>
        </div>

        <div
          style={{
            height: "1px",
            background: "#808080",
            borderBottom: "1px solid #fff",
            margin: "3px 2px",
          }}
        />

        <div
          onClick={() => {
            onOpenApp("about");
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "11px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000080";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#000";
          }}
        >
          <span>ℹ️</span>
          <span>About Strikeout...</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Strikeout OS Desktop Application ──────────────────────────────────
export default function App() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768,
  );
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [activeId, setActiveId] = useState<AppId | null>("cases");
  const nextZ = useRef(20);

  // Pop Pet assistant state: closed by default on loading
  const [popPetOpen, setPopPetOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  useEffect(() => {
    const show = () => {
      setTutorialOpen(false);
      setPopPetOpen(true);
    };
    window.addEventListener("strikeout-show-pet", show);
    window.addEventListener("strikeout-pet-pop", show);
    return () => {
      window.removeEventListener("strikeout-show-pet", show);
      window.removeEventListener("strikeout-pet-pop", show);
    };
  }, []);
  const [simTab, setSimTab] = useState<"demo_browser" | "workspace">(
    "demo_browser",
  );
  const [simSection, setSimSection] = useState<
    "watchlist" | "evidence" | "capture" | "chat"
  >("watchlist");
  const [simAction, setSimAction] = useState<string | null>(null);
  useEffect(() => {
    const show = () => setTutorialOpen(true);
    window.addEventListener("strikeout-tutorial", show);
    return () => window.removeEventListener("strikeout-tutorial", show);
  }, []);

  // 🌿 Catnip food interaction states
  const [hasCatnip, setHasCatnip] = useState(false);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [treatsFed, setTreatsFed] = useState(() => {
    return Number(localStorage.getItem("strikeout_treats") || 0);
  });

  // Desktop Icon Size & Screensaver settings from original app
  const [iconSize, setIconSize] = useState<"small" | "medium" | "large">(() => {
    return (
      (localStorage.getItem("strikeout_iconsize") as
        "small" | "medium" | "large") || "medium"
    );
  });
  const [screenSaver, setScreenSaver] = useState<string>(() => {
    return localStorage.getItem("strikeout_screensaver") || "starfield";
  });
  const [screenSaverActive, setScreenSaverActive] = useState(false);

  useEffect(() => {
    localStorage.setItem("strikeout_iconsize", iconSize);
  }, [iconSize]);

  useEffect(() => {
    localStorage.setItem("strikeout_screensaver", screenSaver);
  }, [screenSaver]);

  // Screensaver idle timer (auto-activates after 60s of inactivity if not 'none')
  useEffect(() => {
    if (screenSaver === "none" || screenSaverActive) return;
    let timer: any;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setScreenSaverActive(true);
      }, 60000);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [screenSaver, screenSaverActive]);

  // Track cursor and toggle body class when holding catnip
  useEffect(() => {
    if (hasCatnip) {
      document.body.classList.add("holding-catnip");
    } else {
      document.body.classList.remove("holding-catnip");
    }
    return () => {
      document.body.classList.remove("holding-catnip");
    };
  }, [hasCatnip]);

  useEffect(() => {
    if (!hasCatnip) return;
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [hasCatnip]);

  // Desktop customization settings (Defaults: Cyber Midnight Navy, CRT Scanlines, Hot Crimson Red)
  const [desktopColor, setDesktopColor] = useState(() => {
    if (!localStorage.getItem("strikeout_defaults_v2")) return "navy";
    return localStorage.getItem("strikeout_color") || "navy";
  });
  const [desktopText, setDesktopText] = useState(
    () => localStorage.getItem("strikeout_text") || "STRIKEOUT",
  );
  const [desktopTexture, setDesktopTexture] = useState<
    "none" | "dither" | "scanlines" | "grid"
  >(() => {
    if (!localStorage.getItem("strikeout_defaults_v2")) return "scanlines";
    return (
      (localStorage.getItem("strikeout_texture") as
        "none" | "dither" | "scanlines" | "grid") || "scanlines"
    );
  });
  const [titleBarTheme, setTitleBarTheme] = useState(() => {
    if (!localStorage.getItem("strikeout_defaults_v2")) return "crimson";
    return localStorage.getItem("strikeout_titlebar") || "crimson";
  });
  // Wallpaper mode: classic retro pattern or supersecretwallpaper
  const [wallpaperMode, setWallpaperMode] = useState<"default" | "supersecret">(
    () => {
      return (
        (localStorage.getItem("strikeout_wallpaper") as
          "default" | "supersecret") || "default"
      );
    },
  );

  // Ensure new defaults are active
  useEffect(() => {
    if (!localStorage.getItem("strikeout_defaults_v2")) {
      localStorage.setItem("strikeout_defaults_v2", "1");
      localStorage.setItem("strikeout_color", "navy");
      localStorage.setItem("strikeout_texture", "scanlines");
      localStorage.setItem("strikeout_titlebar", "crimson");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("strikeout_color", desktopColor);
  }, [desktopColor]);

  useEffect(() => {
    localStorage.setItem("strikeout_text", desktopText);
  }, [desktopText]);

  useEffect(() => {
    localStorage.setItem("strikeout_texture", desktopTexture);
  }, [desktopTexture]);

  useEffect(() => {
    localStorage.setItem("strikeout_titlebar", titleBarTheme);
  }, [titleBarTheme]);

  useEffect(() => {
    localStorage.setItem("strikeout_wallpaper", wallpaperMode);
  }, [wallpaperMode]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Window states for tools
  const [windows, setWindows] = useState<Record<AppId, WinState>>({
    extsim: {
      isOpen: false,
      isMinimized: false,
      x: 120,
      y: 35,
      width: Math.min(960, innerWidth - 40),
      height: Math.min(730, innerHeight - 80),
      zIndex: 13,
    },
    getpop: {
      isOpen: false,
      isMinimized: false,
      x: 180,
      y: 55,
      width: Math.min(750, innerWidth - 40),
      height: Math.min(650, innerHeight - 80),
      zIndex: 14,
    },
    exposure: {
      isOpen:
        location.pathname === "/exposure" ||
        location.hash.startsWith("#pop-review="),
      isMinimized: false,
      x: 100,
      y: 48,
      width: Math.min(780, innerWidth - 36),
      height: Math.min(720, innerHeight - 85),
      zIndex: 12,
    },
    cases: {
      isOpen: true,
      isMinimized: false,
      x: Math.min(140, innerWidth / 8),
      y: 28,
      width: Math.min(1050, innerWidth - 165),
      height: Math.min(740, innerHeight - 80),
      zIndex: 10,
    },
    terminal: {
      isOpen: false,
      isMinimized: false,
      x: 80,
      y: 50,
      width: 660,
      height: 420,
      zIndex: 8,
    },
    monitor: {
      isOpen: false,
      isMinimized: false,
      x: 120,
      y: 70,
      width: 500,
      height: 400,
      zIndex: 6,
    },
    settings: {
      isOpen: false,
      isMinimized: false,
      x: 160,
      y: 90,
      width: 440,
      height: 360,
      zIndex: 7,
    },
    about: {
      isOpen: false,
      isMinimized: false,
      x: 140,
      y: 110,
      width: 360,
      height: 240,
      zIndex: 5,
    },
  });

  const dragRef = useRef<{
    active: boolean;
    winId: AppId | null;
    startMX: number;
    startMY: number;
    startWX: number;
    startWY: number;
  }>({
    active: false,
    winId: null,
    startMX: 0,
    startMY: 0,
    startWX: 0,
    startWY: 0,
  });

  const resizeRef = useRef<{
    active: boolean;
    winId: AppId | null;
    dir: "r" | "b" | "se";
    startMX: number;
    startMY: number;
    startWidth: number;
    startHeight: number;
  }>({
    active: false,
    winId: null,
    dir: "se",
    startMX: 0,
    startMY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current.active && dragRef.current.winId) {
        const dx = e.clientX - dragRef.current.startMX;
        const dy = e.clientY - dragRef.current.startMY;
        const id = dragRef.current.winId;
        setWindows((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            x: Math.max(0, dragRef.current.startWX + dx),
            y: Math.max(0, dragRef.current.startWY + dy),
          },
        }));
      } else if (resizeRef.current.active && resizeRef.current.winId) {
        const dx = e.clientX - resizeRef.current.startMX;
        const dy = e.clientY - resizeRef.current.startMY;
        const id = resizeRef.current.winId;
        const dir = resizeRef.current.dir;

        setWindows((prev) => {
          const win = prev[id];
          let nextWidth = win.width;
          let nextHeight = win.height;

          if (dir === "r" || dir === "se") {
            nextWidth = Math.max(300, resizeRef.current.startWidth + dx);
          }
          if (dir === "b" || dir === "se") {
            nextHeight = Math.max(220, resizeRef.current.startHeight + dy);
          }

          return {
            ...prev,
            [id]: {
              ...win,
              width: nextWidth,
              height: nextHeight,
            },
          };
        });
      }
    };

    const onUp = () => {
      dragRef.current.active = false;
      resizeRef.current.active = false;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const bringToFront = useCallback((id: AppId) => {
    const zIndex = ++nextZ.current;
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], zIndex } }));
    setActiveId(id);
  }, []);

  const openWindow = useCallback(
    (id: AppId) => {
      setWindows((prev) => ({
        ...prev,
        [id]: { ...prev[id], isOpen: true, isMinimized: false },
      }));
      bringToFront(id);
    },
    [bringToFront],
  );

  useEffect(() => {
    const handle = (event: any) => {
      openWindow(event.detail?.section === "exposure" ? "exposure" : "cases");
      setTimeout(
        () =>
          window.dispatchEvent(
            new CustomEvent("strikeout-workspace", { detail: event.detail }),
          ),
        50,
      );
    };
    window.addEventListener("strikeout-open", handle);
    return () => window.removeEventListener("strikeout-open", handle);
  }, [openWindow]);

  const closeWindow = (id: AppId) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], isOpen: false } }));
    if (activeId === id) setActiveId(null);
  };

  const minimizeWindow = (id: AppId) => {
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: true },
    }));
    if (activeId === id) setActiveId(null);
  };

  const handleDragStart = (e: React.MouseEvent, id: AppId) => {
    e.preventDefault();
    dragRef.current = {
      active: true,
      winId: id,
      startMX: e.clientX,
      startMY: e.clientY,
      startWX: windows[id].x,
      startWY: windows[id].y,
    };
    bringToFront(id);
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    id: AppId,
    dir: "r" | "b" | "se",
  ) => {
    e.preventDefault();
    resizeRef.current = {
      active: true,
      winId: id,
      dir,
      startMX: e.clientX,
      startMY: e.clientY,
      startWidth: windows[id].width,
      startHeight: windows[id].height,
    };
    bringToFront(id);
  };

  const handleTaskbarClick = (id: AppId) => {
    if (windows[id].isMinimized) {
      setWindows((prev) => ({
        ...prev,
        [id]: { ...prev[id], isMinimized: false },
      }));
      bringToFront(id);
    } else if (activeId === id) {
      minimizeWindow(id);
    } else {
      bringToFront(id);
    }
  };

  const handleResetAllSettings = () => {
    setDesktopColor("navy");
    setDesktopText("STRIKEOUT");
    setDesktopTexture("scanlines");
    setTitleBarTheme("crimson");
    setWallpaperMode("default");
    setIconSize("medium");
    setScreenSaver("starfield");
    localStorage.setItem("strikeout_defaults_v2", "1");
    localStorage.setItem("strikeout_color", "navy");
    localStorage.setItem("strikeout_text", "STRIKEOUT");
    localStorage.setItem("strikeout_texture", "scanlines");
    localStorage.setItem("strikeout_titlebar", "crimson");
    localStorage.setItem("strikeout_iconsize", "medium");
    localStorage.setItem("strikeout_screensaver", "starfield");
    localStorage.removeItem("strikeout_wallpaper");
  };

  const currentTitleBarGradient =
    TITLEBAR_GRADIENTS[titleBarTheme] || TITLEBAR_GRADIENTS.crimson;

  const textureStyle = () => {
    if (desktopTexture === "dither") {
      return {
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'><rect width='2' height='2' fill='rgba(0,0,0,0.07)'/><rect x='2' y='2' width='2' height='2' fill='rgba(0,0,0,0.07)'/><rect x='2' width='2' height='2' fill='rgba(255,255,255,0.02)'/><rect y='2' width='2' height='2' fill='rgba(255,255,255,0.02)'/></svg>\")",
        backgroundSize: "auto",
      };
    }
    if (desktopTexture === "scanlines") {
      return {
        backgroundImage:
          "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.16) 50%)",
        backgroundSize: "100% 4px",
      };
    }
    if (desktopTexture === "grid") {
      return {
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M 32 0 L 0 0 0 32' fill='none' stroke='rgba(255,255,255,0.07)' stroke-width='1'/></svg>\")",
        backgroundSize: "32px 32px",
      };
    }
    return { backgroundImage: "none" };
  };

  return (
    <div
      onClick={() => {
        setStartOpen(false);
        setSelectedIcon(null);
      }}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        fontFamily: SYS_FONT,
        userSelect: "none",
        backgroundColor: COLOR_MAP[desktopColor] || "#008080",
        ...textureStyle(),
      }}
    >
      {/* 🌿 Catnip Holding Indicator Banner (Non-dismissible: must feed Pop to discard) */}
      {hasCatnip && (
        <div
          style={{
            position: "fixed",
            top: "8px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#15803d",
            border: "2px solid #4ade80",
            padding: "4px 16px",
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: "12px",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          }}
        >
          <span>🌿 Cyber-Catnip in hand!</span>
          <span style={{ fontSize: "11px", color: "#dcfce7" }}>
            Lure Pop near your cursor and click Pop to feed him! (Feeding Pop is
            the only way to discard)
          </span>
        </div>
      )}

      {/* Floating Catnip Cursor Follower */}
      {hasCatnip && (
        <div
          style={{
            position: "fixed",
            left: mousePos.x + 14,
            top: mousePos.y + 14,
            pointerEvents: "none",
            zIndex: 9999999,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "rgba(22, 101, 52, 0.95)",
            color: "#ffffff",
            border: "1px solid #4ade80",
            boxShadow: "2px 2px 6px rgba(0,0,0,0.45)",
            padding: "2px 7px",
            borderRadius: "3px",
            fontSize: "11px",
            fontFamily: SYS_FONT,
            fontWeight: "bold",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          <span>🌿 Cyber-Catnip</span>
          <span
            style={{ fontSize: "9px", opacity: 0.85, fontWeight: "normal" }}
          >
            (Feed Pop to discard)
          </span>
        </div>
      )}

      {/* ─── Super Secret Wallpaper (Original Aspect Ratio, Uncropped) ──── */}
      {wallpaperMode === "supersecret" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 1,
            padding: "8px 8px 36px 8px", // Room above taskbar
            boxSizing: "border-box",
          }}
        >
          <img
            src="/supersecret.png"
            alt="supersecretwallpaper"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              imageRendering: "auto",
              filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.5))",
            }}
          />
        </div>
      )}

      {/* ─── Centered Wallpaper Watermark (Only shown on classic mode) ─────── */}
      {wallpaperMode === "default" && desktopText && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: isMobile ? "44px" : "80px",
            fontWeight: "bold",
            fontFamily: SYS_FONT,
            letterSpacing: "6px",
            color: "rgba(0, 0, 0, 0.20)",
            textShadow: "2px 2px 0 rgba(255, 255, 255, 0.10)",
            pointerEvents: "none",
            userSelect: "none",
            textAlign: "center",
            zIndex: 1,
            maxWidth: "92vw",
            wordBreak: "break-word",
          }}
        >
          {desktopText}
        </div>
      )}

      {/* ─── Desktop Icons Grid ────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          display: "flex",
          flexDirection: "column",
          flexWrap: "wrap",
          height: "calc(100vh - 70px)",
          alignContent: "flex-start",
          gap: "12px",
          zIndex: 5,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <DesktopIcon
          icon={IconPopExe}
          label="Pop"
          size={iconSize}
          selected={selectedIcon === "getpop"}
          onClick={() => openWindow("getpop")}
          onDoubleClick={() => openWindow("getpop")}
        />
        <DesktopIcon
          icon={IconExposure}
          label="Check Exposure"
          size={iconSize}
          selected={selectedIcon === "exposure"}
          onClick={() => {
            setSelectedIcon("exposure");
            openWindow("exposure");
          }}
          onDoubleClick={() => openWindow("exposure")}
        />
        <DesktopIcon
          icon={IconCases}
          label="Cases & Reports"
          size={iconSize}
          selected={selectedIcon === "cases"}
          onClick={() => {
            setSelectedIcon("cases");
            openWindow("cases");
          }}
          onDoubleClick={() => openWindow("cases")}
        />
        {/* Cyber-Catnip - Instant in-hand food! No window opens */}
        <DesktopIcon
          icon={IconCatnip}
          label="Cyber-Catnip"
          size={iconSize}
          selected={selectedIcon === "catnip"}
          onClick={() => {
            if (isMobile) {
              setHasCatnip(true);
              setPopPetOpen(true);
            } else {
              setSelectedIcon("catnip");
            }
          }}
          onDoubleClick={() => {
            setHasCatnip(true);
            setPopPetOpen(true);
          }}
        />

        <DesktopIcon
          icon={IconTerminal}
          label="Shell"
          size={iconSize}
          selected={selectedIcon === "terminal"}
          onClick={() => {
            if (isMobile) {
              openWindow("terminal");
            } else {
              setSelectedIcon("terminal");
            }
          }}
          onDoubleClick={() => openWindow("terminal")}
        />

        <DesktopIcon
          icon={IconMonitor}
          label="System Monitor"
          size={iconSize}
          selected={selectedIcon === "monitor"}
          onClick={() => {
            if (isMobile) {
              openWindow("monitor");
            } else {
              setSelectedIcon("monitor");
            }
          }}
          onDoubleClick={() => openWindow("monitor")}
        />

        <DesktopIcon
          icon={IconSettings}
          label="Settings"
          size={iconSize}
          selected={selectedIcon === "settings"}
          onClick={() => {
            if (isMobile) {
              openWindow("settings");
            } else {
              setSelectedIcon("settings");
            }
          }}
          onDoubleClick={() => openWindow("settings")}
        />
      </div>

      {/* ─── POP THE DESKTOP PET ───────────────────────────────────────────── */}
      <PopTutorial
        isOpen={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        roamingSpeed="still"
        isTourActive={tutorialOpen}
        onOpenApp={(id) =>
          openWindow(
            ([
              "cases",
              "exposure",
              "extsim",
              "getpop",
              "settings",
              "terminal",
              "monitor",
              "about",
            ].includes(id)
              ? id
              : "cases") as AppId,
          )
        }
        onTourAction={(action) => {
          if (action.app === "extsim") {
            setSimAction(action.tab || null);
            setSimTab(
              [
                "sim_watchlist_studio",
                "sim_watchlist_form",
                "sim_canvas",
                "sim_capture",
                "sim_save_evidence",
                "sim_evidence",
                "sim_chat",
              ].includes(action.tab || "")
                ? "workspace"
                : "demo_browser",
            );
            setSimSection(
              action.tab?.includes("evidence")
                ? "evidence"
                : action.tab?.includes("canvas") ||
                    action.tab?.includes("capture")
                  ? "capture"
                  : action.tab?.includes("chat")
                    ? "chat"
                    : "watchlist",
            );
          }
          if (action.app === "cases")
            window.dispatchEvent(
              new CustomEvent("strikeout-open", {
                detail: {
                  section:
                    action.tab === "new"
                      ? "new"
                      : action.tab === "help"
                        ? "services"
                        : "cases",
                },
              }),
            );
        }}
        titleBarGradient={currentTitleBarGradient}
      />
      <GuideChat />
      <PopPet
        isOpen={popPetOpen && !tutorialOpen}
        onClose={() => setPopPetOpen(false)}
        hasCatnip={hasCatnip}
        onFeedCatnip={() => {
          setHasCatnip(false);
          setTreatsFed((c) => {
            const next = c + 1;
            localStorage.setItem("strikeout_treats", String(next));
            return next;
          });
        }}
        titleBarGradient={currentTitleBarGradient}
      />

      {/* ─── Windows ──────────────────────────────────────────────────────── */}
      <Win95Window
        id="extsim"
        title="STRIKEOUT / Extension Simulator"
        icon={IconExtensionSim}
        titleBarGradient={currentTitleBarGradient}
        state={windows.extsim}
        isActive={activeId === "extsim"}
        onClose={() => closeWindow("extsim")}
        onMinimize={() => minimizeWindow("extsim")}
        onFocus={() => bringToFront("extsim")}
        onDragStart={(e) => handleDragStart(e, "extsim")}
        onResizeStart={(e, dir) => handleResizeStart(e, "extsim", dir)}
        isMobile={isMobile}
      >
        <ExtensionDemoApp
          simTab={simTab}
          simSection={simSection}
          onTabChange={setSimTab}
          onSectionChange={setSimSection}
          highlightTarget={simAction}
          onStartExtensionTour={() => setTutorialOpen(true)}
          onExportToCases={(title, description, platform) =>
            window.dispatchEvent(
              new CustomEvent("strikeout-open", {
                detail: {
                  section: "new",
                  draft: { title, description, platform },
                },
              }),
            )
          }
        />
      </Win95Window>
      <Win95Window
        id="getpop"
        title="STRIKEOUT / Pop"
        icon={IconPopExe}
        titleBarGradient={currentTitleBarGradient}
        state={windows.getpop}
        isActive={activeId === "getpop"}
        onClose={() => closeWindow("getpop")}
        onMinimize={() => minimizeWindow("getpop")}
        onFocus={() => bringToFront("getpop")}
        onDragStart={(e) => handleDragStart(e, "getpop")}
        onResizeStart={(e, dir) => handleResizeStart(e, "getpop", dir)}
        isMobile={isMobile}
      >
        <GetPopApp
          onSummonPet={() => setPopPetOpen(true)}
          onStartTutorial={() => setTutorialOpen(true)}
          onOpenSimulator={() => openWindow("extsim")}
        />
      </Win95Window>
      <Win95Window
        id="exposure"
        title="STRIKEOUT / Check Exposure"
        icon={IconExposure}
        titleBarGradient={currentTitleBarGradient}
        state={windows.exposure}
        isActive={activeId === "exposure"}
        onClose={() => closeWindow("exposure")}
        onMinimize={() => minimizeWindow("exposure")}
        onFocus={() => bringToFront("exposure")}
        onDragStart={(e) => handleDragStart(e, "exposure")}
        onResizeStart={(e, dir) => handleResizeStart(e, "exposure", dir)}
        isMobile={isMobile}
      >
        <div className="recovery exposure-window">
          <header className="desk-bar">
            <strong>CHECK EXPOSURE</strong>
            <span>Tools / Public references / Supplied content</span>
          </header>
          <main className="desk-main">
            <ExposureApp />
          </main>
          <footer className="desk-footer">
            Consented checks · No automatic account access
          </footer>
        </div>
      </Win95Window>
      <Win95Window
        id="cases"
        title="STRIKEOUT / Cases & Reports"
        icon={IconCases}
        titleBarGradient={currentTitleBarGradient}
        state={windows.cases}
        isActive={activeId === "cases"}
        onClose={() => closeWindow("cases")}
        onMinimize={() => minimizeWindow("cases")}
        onFocus={() => bringToFront("cases")}
        onDragStart={(e) => handleDragStart(e, "cases")}
        onResizeStart={(e, dir) => handleResizeStart(e, "cases", dir)}
        isMobile={isMobile}
      >
        <RecoveryApp />
      </Win95Window>
      {/* 1. shell.exe */}
      <Win95Window
        id="terminal"
        title="sShell — Strikeout Defense Console v2.4"
        icon={IconTerminal}
        titleBarGradient={currentTitleBarGradient}
        state={windows.terminal}
        isActive={activeId === "terminal"}
        onClose={() => closeWindow("terminal")}
        onMinimize={() => minimizeWindow("terminal")}
        onFocus={() => bringToFront("terminal")}
        onDragStart={(e) => handleDragStart(e, "terminal")}
        onResizeStart={(e, dir) => handleResizeStart(e, "terminal", dir)}
        isMobile={isMobile}
      >
        <TerminalApp
          onClose={() => closeWindow("terminal")}
          onOpenPop={() => setPopPetOpen(true)}
        />
      </Win95Window>

      {/* 3. monitor.exe */}
      <Win95Window
        id="monitor"
        title="Threat & Security Monitor"
        icon={IconMonitor}
        titleBarGradient={currentTitleBarGradient}
        state={windows.monitor}
        isActive={activeId === "monitor"}
        onClose={() => closeWindow("monitor")}
        onMinimize={() => minimizeWindow("monitor")}
        onFocus={() => bringToFront("monitor")}
        onDragStart={(e) => handleDragStart(e, "monitor")}
        onResizeStart={(e, dir) => handleResizeStart(e, "monitor", dir)}
        isMobile={isMobile}
      >
        <SystemMonitorApp />
      </Win95Window>

      {/* 4. settings.exe */}
      <Win95Window
        id="settings"
        title="Strikeout Themes, Titlebars & Wallpapers"
        icon={IconSettings}
        titleBarGradient={currentTitleBarGradient}
        state={windows.settings}
        isActive={activeId === "settings"}
        onClose={() => closeWindow("settings")}
        onMinimize={() => minimizeWindow("settings")}
        onFocus={() => bringToFront("settings")}
        onDragStart={(e) => handleDragStart(e, "settings")}
        onResizeStart={(e, dir) => handleResizeStart(e, "settings", dir)}
        isMobile={isMobile}
      >
        <SettingsApp
          desktopColor={desktopColor}
          setDesktopColor={setDesktopColor}
          desktopText={desktopText}
          setDesktopText={setDesktopText}
          desktopTexture={desktopTexture}
          setDesktopTexture={setDesktopTexture}
          wallpaperMode={wallpaperMode}
          setWallpaperMode={setWallpaperMode}
          titleBarTheme={titleBarTheme}
          setTitleBarTheme={setTitleBarTheme}
          iconSize={iconSize}
          setIconSize={setIconSize}
          screenSaver={screenSaver}
          setScreenSaver={setScreenSaver}
          onPreviewScreenSaver={() => setScreenSaverActive(true)}
          onResetAllSettings={handleResetAllSettings}
          onClose={() => closeWindow("settings")}
        />
      </Win95Window>

      {/* 5. About */}
      <Win95Window
        id="about"
        title="About Strikeout OS"
        icon={IconPopExe}
        titleBarGradient={currentTitleBarGradient}
        state={windows.about}
        isActive={activeId === "about"}
        onClose={() => closeWindow("about")}
        onMinimize={() => minimizeWindow("about")}
        onFocus={() => bringToFront("about")}
        onDragStart={(e) => handleDragStart(e, "about")}
        onResizeStart={(e, dir) => handleResizeStart(e, "about", dir)}
        isMobile={isMobile}
      >
        <AboutApp onClose={() => closeWindow("about")} />
      </Win95Window>

      {/* ─── Start Menu ───────────────────────────────────────────────────── */}
      {startOpen && (
        <StartMenu
          onOpenApp={(id) => openWindow(id)}
          onOpenPopPet={() => openWindow("getpop")}
          onGrabCatnip={() => {
            setHasCatnip(true);
            setPopPetOpen(true);
          }}
          onClose={() => setStartOpen(false)}
        />
      )}

      {/* ─── Taskbar ──────────────────────────────────────────────────────── */}
      <Taskbar
        windows={windows}
        activeId={activeId}
        startOpen={startOpen}
        onStartClick={() => setStartOpen((s) => !s)}
        onWindowClick={handleTaskbarClick}
        popPetOpen={popPetOpen}
        onTogglePopPet={() => setPopPetOpen((p) => !p)}
      />
      {/* ─── ScreenSaver Overlay ──────────────────────────────────────────── */}
      {screenSaverActive && screenSaver !== "none" && (
        <ScreenSaver
          type={screenSaver}
          onExit={() => setScreenSaverActive(false)}
        />
      )}
    </div>
  );
}
