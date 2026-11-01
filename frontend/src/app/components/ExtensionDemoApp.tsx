import React, { useState, useRef, useEffect } from "react";

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

// ─── Authentic Extension Simulator Icon ─────────────────────────────────────
export function IconExtensionSim({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ imageRendering: "pixelated", shapeRendering: "crispEdges" }}>
      {/* Browser Window Background */}
      <rect x="2" y="3" width="28" height="26" fill="#c0c0c0" stroke="#000000" strokeWidth="1" />
      <rect x="3" y="4" width="26" height="5" fill="#000080" />
      <rect x="5" y="6" width="8" height="1.5" fill="#ffffff" />
      {/* Browser Content */}
      <rect x="4" y="10" width="24" height="17" fill="#ffffff" stroke="#808080" strokeWidth="1" />
      {/* Extension Toolbar popup */}
      <rect x="15" y="10" width="13" height="15" fill="#c0c0c0" stroke="#000000" strokeWidth="1" />
      <rect x="16" y="11" width="11" height="3" fill="#000080" />
      {/* Cat face in mini popup */}
      <rect x="18" y="16" width="3" height="3" fill="#14142b" />
      <rect x="23" y="16" width="3" height="3" fill="#14142b" />
      {/* Redaction Shield Badge */}
      <circle cx="9" cy="21" r="5" fill="#166534" stroke="#ffffff" strokeWidth="1" />
      <path d="M7 21 L8.5 23 L11.5 19.5" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ExtensionDemoApp({
  onExportToCases,
  simTab,
  simSection,
  onTabChange,
  onSectionChange,
  onStartExtensionTour,
  highlightTarget = null,
}: {
  onExportToCases?: (title: string, desc: string, platform: string) => void;
  simTab?: "demo_browser" | "workspace";
  simSection?: "watchlist" | "evidence" | "capture" | "chat";
  onTabChange?: (tab: "demo_browser" | "workspace") => void;
  onSectionChange?: (sec: "watchlist" | "evidence" | "capture" | "chat") => void;
  onStartExtensionTour?: () => void;
  highlightTarget?: string | null;
}) {
  // Simulator State
  const [internalTab, setInternalTab] = useState<"demo_browser" | "workspace">(simTab || "demo_browser");
  const activeTab = simTab !== undefined ? simTab : internalTab;
  const setActiveTab = (t: "demo_browser" | "workspace") => {
    setInternalTab(t);
    onTabChange?.(t);
  };

  const [internalSection, setInternalSection] = useState<"watchlist" | "evidence" | "capture" | "chat">(simSection || "watchlist");
  const workspaceSection = simSection !== undefined ? simSection : internalSection;
  const setWorkspaceSection = (s: "watchlist" | "evidence" | "capture" | "chat") => {
    setInternalSection(s);
    onSectionChange?.(s);
  };

  // Extension Watchlist
  const [watchlist, setWatchlist] = useState<Array<{ id: string; kind: string; value: string }>>([
    { id: "1", kind: "email", value: "demo@example.org" },
    { id: "2", kind: "phone", value: "+1 202 555 0147" },
    { id: "3", kind: "username", value: "@alex_target" },
  ]);
  const [newKind, setNewKind] = useState<"email" | "phone" | "username">("email");
  const [newValue, setNewValue] = useState("");

  // Toolbar Popup State
  const [showPopup, setShowPopup] = useState(true);
  const [popupStatus, setPopupStatus] = useState("Pop is on duty. Type or paste below to test Sharing Guard.");

  // Demo Page Content & Sharing Guard
  const [bioInput, setBioInput] = useState("");
  const [sharingAlert, setSharingAlert] = useState<{ matches: string[]; offset: number } | null>(null);
  const [scannedHighlights, setScannedHighlights] = useState<boolean>(false);

  // Evidence Redaction Studio
  const [capturedImage, setCapturedImage] = useState<boolean>(false);
  const [redactions, setRedactions] = useState<Array<{ x: number; y: number; w: number; h: number }>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Evidence Records in IndexedDB Simulator
  const [savedEvidence, setSavedEvidence] = useState<Array<{ id: string; title: string; date: string; url: string; note: string }>>([
    {
      id: "ev-01",
      title: "Suspicious DM & Impersonation Account",
      date: "Nov 01, 2026 - 00:45 UTC",
      url: "https://social-platform.test/profile/alex_target_fake",
      note: "Fake profile using my bio and demanding crypto recovery fee.",
    },
  ]);

  // Synchronize interactive demo states when Guided Tour steps switch sections
  useEffect(() => {
    if (simSection === ("guard" as any)) {
      setShowPopup(true);
      const testVal = "Accidentally entering my email: demo@example.org in this form!";
      setBioInput(testVal);
      setSharingAlert({ matches: ["demo@example.org"], offset: 0 });
      setPopupStatus("⚠️ Sharing Guard: Watched email detected in input field!");
    } else if (simSection === ("guard_clean" as any)) {
      setShowPopup(true);
      setBioInput("Accidentally entering my email:  in this form!");
      setSharingAlert(null);
      setPopupStatus("✅ Cleaned! Watched sensitive info removed while leaving surrounding draft intact.");
    } else if (simSection === ("scan" as any)) {
      setShowPopup(true);
      setScannedHighlights(true);
      setPopupStatus("🔍 Scan Complete: 1 watched identifier (@alex_target) highlighted on page.");
    } else if (simSection === ("capture" as any)) {
      setCapturedImage(true);
      if (redactions.length === 0) {
        setRedactions([{ x: 260, y: 140, w: 90, h: 40 }]);
      }
    } else if (simSection === ("popup" as any)) {
      setShowPopup(true);
      setPopupStatus("Pop is on duty. Type or paste below to test Sharing Guard.");
    }
  }, [simSection]);

  // Handle Input Changes with Real Sharing Guard Check
  const handleInputChange = (val: string) => {
    setBioInput(val);

    // Look for matches against watchlist
    const foundMatches: string[] = [];
    watchlist.forEach((w) => {
      if (val.toLowerCase().includes(w.value.toLowerCase())) {
        foundMatches.push(w.value);
      }
    });

    if (foundMatches.length > 0) {
      setSharingAlert({ matches: foundMatches, offset: 0 });
      setPopupStatus(`⚠️ Sharing Guard: ${foundMatches.length} watched item(s) detected in the active input!`);
    } else {
      setSharingAlert(null);
    }
  };

  // Instant Clean Removal
  const handleRemoveMatched = () => {
    if (!sharingAlert) return;
    let clean = bioInput;
    sharingAlert.matches.forEach((m) => {
      const reg = new RegExp(m, "gi");
      clean = clean.replace(reg, "");
    });
    setBioInput(clean);
    setSharingAlert(null);
    setPopupStatus("✅ Cleaned! Watched sensitive info removed while leaving surrounding draft intact.");
  };

  // Draw on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setIsDrawing(true);
    setDrawStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    const newBox = {
      x: Math.min(drawStart.x, curX),
      y: Math.min(drawStart.y, curY),
      w: Math.abs(curX - drawStart.x),
      h: Math.abs(curY - drawStart.y),
    };

    if (newBox.w > 4 && newBox.h > 4) {
      setRedactions((prev) => [...prev, newBox]);
    }
    setIsDrawing(false);
    setDrawStart(null);
  };

  // Re-draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw fake website screenshot
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px sans-serif";
    ctx.fillText("https://social-platform.test/profile/scammer_99", 10, 18);

    // Profile card
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(20, 45, 340, 130);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(20, 45, 340, 130);

    // Avatar
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(35, 60, 40, 40);

    // Text lines
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("Impersonator (@alex_target_fake)", 85, 75);
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Bio: Contact me at demo@example.org or +1 202 555 0147", 85, 95);
    ctx.fillText("DMs are open for recovery services. Send $500.", 85, 115);

    // Draw user redaction boxes
    ctx.fillStyle = "#000000";
    redactions.forEach((r) => {
      ctx.fillRect(r.x, r.y, r.w, r.h);
    });
  }, [capturedImage, redactions]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#008080", // Classic Windows teal backdrop like the real extension
        fontFamily: BODY_FONT,
        overflow: "hidden",
      }}
    >
      {/* ─── Simulated Environment Badge ───────────────────────────────────── */}
      <div
        id="tour-sim-badge"
        style={{
          background: "#fef08a",
          borderBottom: "1px solid #ca8a04",
          color: "#854d0e",
          padding: "4px 12px",
          fontSize: "11px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: SYS_FONT,
          fontWeight: "bold",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>🧪 SIMULATED EXTENSION ENVIRONMENT</span>
          <span style={{ fontWeight: "normal", color: "#713f12" }}>
            — This sandbox demonstrates how the Pop browser extension operates on real websites.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onStartExtensionTour && (
            <button
              id="tour-btn-start-ext-tour"
              onClick={onStartExtensionTour}
              style={{
                ...raised,
                background: "#000080",
                color: "#ffffff",
                border: "none",
                padding: "2px 8px",
                fontFamily: SYS_FONT,
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              title="Have Pop guide you through this simulated extension step-by-step"
            >
              <span>🧭</span>
              <span>Tutorial: Extension (16 Steps)</span>
            </button>
          )}
          <span style={{ fontSize: "10px", color: "#a16207" }}>Version 2.1.1</span>
        </div>
      </div>

      {/* ─── Top Browser Navigation Simulator Bar ─────────────────────────── */}
      <div
        id="tour-sim-scene"
        style={{
          ...raised,
          background: "#c0c0c0",
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #000000",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px" }}>🌐</span>
          <span style={{ fontFamily: SYS_FONT, fontSize: "12px", fontWeight: "bold" }}>
            Browser URL:
          </span>
          <div
            style={{
              ...sunken,
              background: "#ffffff",
              padding: "2px 8px",
              fontSize: "11px",
              fontFamily: "monospace",
              width: "260px",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            https://social-platform.test/draft-post
          </div>
        </div>

        {/* Browser Extension Toolbar Icon */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            id="tour-popup-toggle"
            onClick={() => setShowPopup((p) => !p)}
            style={{
              ...raised,
              background: showPopup ? "#000080" : "#c0c0c0",
              color: showPopup ? "#ffffff" : "#000000",
              border: "none",
              padding: "2px 8px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              fontFamily: SYS_FONT,
              fontSize: "11px",
              fontWeight: "bold",
            }}
          >
            <img src="/pop.png" alt="" style={{ width: "16px", height: "16px", imageRendering: "pixelated" }} />
            Pop Toolbar (v2.1.3)
          </button>

          <button
            id="tour-workspace-toggle"
            onClick={() => setActiveTab(activeTab === "demo_browser" ? "workspace" : "demo_browser")}
            style={{
              ...raised,
              background: "#c0c0c0",
              border: "none",
              padding: "2px 8px",
              fontSize: "11px",
              fontFamily: SYS_FONT,
              cursor: "pointer",
            }}
          >
            {activeTab === "demo_browser" ? "📂 Open Extension Studio" : "🌐 Return to Browser Tab"}
          </button>
        </div>
      </div>

      {/* ─── Main Interactive Content ──────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>
        
        {/* VIEW 1: Simulated Webpage */}
        {activeTab === "demo_browser" && (
          <div
            style={{
              flex: 1,
              background: "#f8fafc",
              overflowY: "auto",
              padding: "20px 28px",
              position: "relative",
            }}
          >
            <div style={{ maxWidth: "600px", margin: "0 auto" }}>
              <div
                style={{
                  ...raised,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  padding: "14px 18px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Interactive Webpage Simulation
                </div>
                <h3 style={{ margin: "4px 0 8px 0", color: "#0f172a", fontFamily: SYS_FONT, fontSize: "17px" }}>
                  Public Forum & Social Bio Editor
                </h3>
                <p style={{ fontSize: "12px", color: "#475569", lineHeight: "1.5", margin: 0 }}>
                  This simulates an ordinary website where sensitive information is often accidentally leaked.
                  Try pasting or typing your watched email (<code style={{ color: "#000080" }}>demo@example.org</code>) below!
                </p>
              </div>

              {/* Editable Field (Watched by Sharing Guard) */}
              <div
                id="tour-sharing-guard"
                style={{
                  ...raised,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  padding: "16px",
                  position: "relative",
                  marginBottom: "18px",
                }}
              >
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                  Your Public Bio / Message Draft:
                </label>
                <textarea
                  value={bioInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  rows={3}
                  placeholder="Type or paste text here (e.g. 'Reach me at demo@example.org for updates!')..."
                  style={{
                    ...sunken,
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    fontSize: "13px",
                    fontFamily: BODY_FONT,
                    background: "#ffffff",
                    outline: "none",
                  }}
                />

                {/* Pop's In-Page Sharing Guard Warning Bubble */}
                {sharingAlert && (
                  <div
                    id="tour-guard-alert-badge"
                    style={{
                      ...raised,
                      background: "#ffffe1",
                      border: "2px solid #000000",
                      padding: "8px 12px",
                      marginTop: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: "3px 3px 0px rgba(0,0,0,0.4)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img src="/pop.png" alt="" style={{ width: "22px", height: "22px", imageRendering: "pixelated" }} />
                      <div>
                        <div style={{ fontFamily: SYS_FONT, fontSize: "12px", fontWeight: "bold", color: "#b91c1c" }}>
                          ⚠️ Pop Sharing Guard Warning!
                        </div>
                        <div style={{ fontSize: "11px", color: "#333333" }}>
                          Watched item found: <strong>"{sharingAlert.matches.join(", ")}"</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        id="tour-guard-slice-btn"
                        onClick={handleRemoveMatched}
                        style={{
                          ...raised,
                          background: "#dc2626",
                          color: "#ffffff",
                          border: "none",
                          padding: "3px 8px",
                          fontFamily: SYS_FONT,
                          fontSize: "11px",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        ✂️ Remove Matched
                      </button>
                      <button
                        onClick={() => setSharingAlert(null)}
                        style={{
                          ...raised,
                          background: "#c0c0c0",
                          border: "none",
                          padding: "3px 8px",
                          fontFamily: SYS_FONT,
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                )}

                {/* Pre-fill Quick Test Buttons */}
                <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Quick Paste Test:</span>
                  <button
                    onClick={() => handleInputChange("Hello world! Reach me at demo@example.org for inquiries.")}
                    style={{
                      ...raised,
                      background: "#e2e8f0",
                      border: "none",
                      padding: "3px 8px",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    Paste Watched Email
                  </button>
                  <button
                    onClick={() => handleInputChange("Call my desk at +1 202 555 0147 anytime.")}
                    style={{
                      ...raised,
                      background: "#e2e8f0",
                      border: "none",
                      padding: "3px 8px",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    Paste Watched Phone
                  </button>
                </div>
              </div>

              {/* Sample Webpage Comments with Scanner Target */}
              <div id="tour-scan-target">
                <div style={{ fontSize: "12px", fontWeight: "bold", color: "#475569", marginBottom: "6px" }}>
                  Webpage Comments (Target for In-Page Scanner):
                </div>

                <div style={{ ...raised, background: "#ffffff", padding: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "12px" }}>
                    <strong>User_771:</strong> For details, check with <span style={{ background: scannedHighlights ? "#fef08a" : "transparent", padding: scannedHighlights ? "1px 4px" : "0", border: scannedHighlights ? "1px dashed #ca8a04" : "none", fontWeight: scannedHighlights ? "bold" : "normal" }}>@alex_target</span> on the forum.
                  </div>
                  <div style={{ fontSize: "12px" }}>
                    <strong>Mod_Safety:</strong> Pop can scan visible text nodes on any open webpage for watchlist matches.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Extension Workspace Studio (Evidence & Watchlist) */}
        {activeTab === "workspace" && (
          <div
            style={{
              flex: 1,
              background: "#d4d0c8",
              overflowY: "auto",
              padding: "18px 24px",
            }}
          >
            <div style={{ ...raised, background: "#c0c0c0", padding: "4px", maxWidth: "800px", margin: "0 auto" }}>
              {/* Header */}
              <div style={{ background: "linear-gradient(90deg, #000080, #1084d0)", padding: "4px 8px", color: "#ffffff", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: SYS_FONT, fontSize: "13px", fontWeight: "bold" }}>Pop.exe - Evidence & Safety Studio</span>
                <span style={{ fontSize: "11px" }}>STRIKEOUT EXTENSION</span>
              </div>

              {/* Workspace Tabs */}
              <div style={{ display: "flex", gap: "2px", padding: "6px 8px 0", borderBottom: "1px solid #808080" }}>
                {[
                  { id: "watchlist", label: "My Watchlist" },
                  { id: "evidence", label: "Saved Evidence" },
                  { id: "capture", label: "Redaction Canvas" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setWorkspaceSection(s.id as any)}
                    style={{
                      fontFamily: SYS_FONT,
                      fontSize: "11px",
                      padding: "5px 12px",
                      background: workspaceSection === s.id ? "#d4d0c8" : "#c0c0c0",
                      color: "#000000",
                      border: "none",
                      borderTop: "1px solid #ffffff",
                      borderLeft: "1px solid #ffffff",
                      borderRight: "1px solid #808080",
                      cursor: "pointer",
                      marginBottom: workspaceSection === s.id ? "-1px" : "0",
                      fontWeight: workspaceSection === s.id ? "bold" : "normal",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Workspace Content */}
              <div style={{ background: "#d4d0c8", padding: "16px" }}>
                {workspaceSection === "watchlist" && (
                  <div id="tour-watchlist-studio">
                    <h3 style={{ margin: "0 0 6px 0", fontFamily: SYS_FONT, fontSize: "16px" }}>What should Pop watch out for?</h3>
                    <p style={{ fontSize: "12px", color: "#444444", margin: "0 0 14px 0" }}>
                      Your watchlist stays strictly on this device. Pop alerts you if any of these are pasted or appear on web forms.
                    </p>

                    {/* Add Item Form */}
                    <form
                      id="tour-watchlist-add-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newValue.trim()) return;
                        setWatchlist((prev) => [...prev, { id: String(Date.now()), kind: newKind, value: newValue.trim() }]);
                        setNewValue("");
                      }}
                      style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
                    >
                      <select
                        value={newKind}
                        onChange={(e) => setNewKind(e.target.value as any)}
                        style={{ ...sunken, padding: "4px 8px", fontFamily: SYS_FONT, fontSize: "12px", background: "#ffffff" }}
                      >
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="username">Username</option>
                      </select>

                      <input
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="Add new identifier to watch..."
                        style={{ ...sunken, flex: 1, padding: "4px 8px", fontSize: "12px", background: "#ffffff" }}
                      />

                      <button
                        type="submit"
                        style={{ ...raised, background: "#c0c0c0", border: "none", padding: "4px 14px", fontFamily: SYS_FONT, fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        + Add Identifier
                      </button>
                    </form>

                    {/* Watchlist Table */}
                    <div id="tour-watchlist-table" style={{ ...sunken, background: "#ffffff", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {watchlist.map((item) => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px", borderBottom: "1px solid #f1f5f9", fontSize: "12px" }}>
                          <div>
                            <span style={{ color: "#000080", fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", marginRight: "8px" }}>
                              [{item.kind}]
                            </span>
                            <code>{item.value}</code>
                          </div>
                          <button
                            onClick={() => setWatchlist((prev) => prev.filter((w) => w.id !== item.id))}
                            style={{ ...raised, background: "#c0c0c0", border: "none", padding: "2px 6px", fontSize: "10px", cursor: "pointer" }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceSection === "evidence" && (
                  <div id="tour-evidence-export">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <h3 style={{ margin: 0, fontFamily: SYS_FONT, fontSize: "16px" }}>Reviewed Evidence & Dossiers</h3>
                      <button
                        onClick={() => {
                          if (onExportToCases && savedEvidence[0]) {
                            onExportToCases(
                              savedEvidence[0].title,
                              `Imported from Pop Extension: ${savedEvidence[0].url}\nTimestamp: ${savedEvidence[0].date}\nNote: ${savedEvidence[0].note}`,
                              "Browser Extension Capture"
                            );
                          }
                        }}
                        style={{ ...raised, background: "#000080", color: "#ffffff", border: "none", padding: "4px 12px", fontFamily: SYS_FONT, fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        📁 Export to Strikeout Cases & Reports Desk
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {savedEvidence.map((ev) => (
                        <div key={ev.id} style={{ ...raised, background: "#ffffff", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontFamily: SYS_FONT, fontSize: "14px", color: "#0f172a" }}>{ev.title}</strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{ev.date}</span>
                          </div>
                          <div style={{ fontSize: "11px", color: "#000080" }}>{ev.url}</div>
                          <div style={{ fontSize: "12px", color: "#334155" }}>{ev.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceSection === "capture" && (
                  <div id="tour-canvas-studio">
                    <h3 style={{ margin: "0 0 6px 0", fontFamily: SYS_FONT, fontSize: "16px" }}>Review & Redaction Studio</h3>
                    <p style={{ fontSize: "11px", color: "#444444", margin: "0 0 10px 0" }}>
                      Drag your mouse over sensitive phone numbers, avatar images, or addresses to bake permanent black redaction blocks into the image.
                    </p>

                    <canvas
                      id="tour-canvas-element"
                      ref={canvasRef}
                      width={400}
                      height={200}
                      onMouseDown={handleMouseDown}
                      onMouseUp={handleMouseUp}
                      style={{
                        ...sunken,
                        display: "block",
                        background: "#ffffff",
                        cursor: "crosshair",
                        marginBottom: "10px",
                      }}
                    />

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setRedactions((prev) => prev.slice(0, -1))}
                        style={{ ...raised, background: "#c0c0c0", border: "none", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}
                      >
                        Undo Redaction
                      </button>
                      <button
                        id="tour-btn-save-evidence"
                        onClick={() => {
                          setSavedEvidence((prev) => [
                            {
                              id: String(Date.now()),
                              title: "Redacted Impersonation Capture",
                              date: new Date().toUTCString(),
                              url: "https://social-platform.test/profile/scammer_99",
                              note: "Evidence captured and redacted via Pop Extension Simulator.",
                            },
                            ...prev,
                          ]);
                          setWorkspaceSection("evidence");
                        }}
                        style={{ ...raised, background: "#166534", color: "#ffffff", border: "none", padding: "4px 14px", fontFamily: SYS_FONT, fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        💾 Save Evidence Locally
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Authentic Win98 220px Extension Popup Panel (panel.html) ─────── */}
        {showPopup && activeTab === "demo_browser" && (
          <div
            id="tour-extension-popup"
            style={{
              position: "absolute",
              top: "10px",
              right: "14px",
              width: "220px",
              ...raised,
              background: "#c0c0c0",
              padding: "3px",
              boxShadow: "4px 4px 10px rgba(0,0,0,0.5)",
              zIndex: 100,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "2px 4px",
                background: "linear-gradient(90deg, #000080, #1084d0)",
                color: "#ffffff",
                minHeight: "19px",
              }}
            >
              <img src="/pop.png" alt="" style={{ width: "12px", height: "12px", imageRendering: "pixelated" }} />
              <strong style={{ fontSize: "11px", fontFamily: SYS_FONT }}>Pop.exe</strong>
              <small style={{ marginLeft: "auto", fontSize: "9px" }}>2.1.1</small>
            </div>

            {/* Popup Body */}
            <div style={{ padding: "5px" }}>
              {/* Pet Desk */}
              <div style={{ display: "flex", gap: "4px", marginBottom: "5px" }}>
                <button
                  id="tour-popup-pet"
                  onClick={() => setPopupStatus("Pop purrs in binary: 01000001 01010111! Cybersecurity department accepts head pats.")}
                  style={{
                    ...raised,
                    background: "#c0c0c0",
                    border: "none",
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 6px",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: SYS_FONT,
                  }}
                >
                  <img src="/pop.png" alt="" style={{ width: "20px", height: "20px", imageRendering: "pixelated" }} />
                  Pet Pop
                </button>
                <button
                  onClick={() => setPopupStatus("Pop is stationed in the bottom corner of this page.")}
                  style={{ ...raised, background: "#c0c0c0", border: "none", padding: "3px 8px", fontSize: "11px", cursor: "pointer", fontFamily: SYS_FONT }}
                >
                  Show
                </button>
                <button
                  onClick={() => setShowPopup(false)}
                  style={{ ...raised, background: "#c0c0c0", border: "none", width: "22px", fontSize: "11px", cursor: "pointer", fontFamily: SYS_FONT }}
                >
                  _
                </button>
              </div>

              {/* Quick Tools */}
              <div style={{ display: "flex", gap: "4px", marginBottom: "5px" }}>
                <button
                  id="tour-btn-scan"
                  onClick={() => {
                    setScannedHighlights(true);
                    setPopupStatus("🔍 Scan complete! 1 watched identifier (@alex_target) highlighted on the page.");
                  }}
                  style={{ ...raised, background: "#c0c0c0", border: "none", flex: 1, padding: "3px 4px", fontSize: "11px", cursor: "pointer", fontFamily: SYS_FONT, fontWeight: "bold" }}
                >
                  Scan
                </button>
                <button
                  id="tour-btn-draft"
                  onClick={() => {
                    handleInputChange(bioInput);
                    setPopupStatus("Checked active draft. Sharing guard verified.");
                  }}
                  style={{ ...raised, background: "#c0c0c0", border: "none", flex: 1, padding: "3px 4px", fontSize: "11px", cursor: "pointer", fontFamily: SYS_FONT }}
                >
                  Draft
                </button>
                <button
                  id="tour-btn-capture"
                  onClick={() => {
                    setActiveTab("workspace");
                    setWorkspaceSection("capture");
                    setCapturedImage(true);
                  }}
                  style={{ ...raised, background: "#c0c0c0", border: "none", flex: 1, padding: "3px 4px", fontSize: "11px", cursor: "pointer", fontFamily: SYS_FONT }}
                >
                  Capture
                </button>
              </div>

              {/* Links */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 2px", fontSize: "11px" }}>
                <button
                  id="tour-popup-link-watchlist"
                  onClick={() => {
                    setActiveTab("workspace");
                    setWorkspaceSection("watchlist");
                  }}
                  style={{ background: "none", border: "none", color: "#000080", textDecoration: "underline", cursor: "pointer", fontSize: "11px", padding: 0 }}
                >
                  Watchlist
                </button>
                <button
                  id="tour-popup-link-evidence"
                  onClick={() => {
                    setActiveTab("workspace");
                    setWorkspaceSection("evidence");
                  }}
                  style={{ background: "none", border: "none", color: "#000080", textDecoration: "underline", cursor: "pointer", fontSize: "11px", padding: 0 }}
                >
                  Evidence Files
                </button>
              </div>

              {/* Status Note Box */}
              <div
                style={{
                  ...sunken,
                  background: "#ffffe1",
                  padding: "6px",
                  fontSize: "10px",
                  color: "#333333",
                  minHeight: "45px",
                  maxHeight: "75px",
                  overflowY: "auto",
                  lineHeight: "1.35",
                  marginTop: "4px",
                }}
              >
                {popupStatus}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
