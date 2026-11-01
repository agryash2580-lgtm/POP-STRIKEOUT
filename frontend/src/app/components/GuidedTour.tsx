import React, { useState, useEffect, useRef, useCallback } from "react";
import { TourHighlightBox } from "./TourHighlightBox";

const SYS_FONT = "'Pixelify Sans', 'VT323', 'Segoe UI', Tahoma, sans-serif";
const RETRO_FONT = "'Pixelify Sans', 'VT323', monospace";

// Physical dimensions for Pop's full container (clippy box + triangle + sprite)
const POP_W = 295;
const POP_H = 285;
const TASKBAR_HEIGHT = 38; // 38px taskbar: absolute wall / border

const raised: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #ffffff, inset -1px -1px #0a0a0a, inset 2px 2px #dfdfdf, inset -2px -2px #808080",
};

const sunken: React.CSSProperties = {
  boxShadow:
    "inset 1px 1px #808080, inset -1px -1px #ffffff, inset 2px 2px #0a0a0a, inset -2px -2px #dfdfdf",
};

// ─── Clamping & Bounding Box Helpers ──────────────────────────────────────────
export function getBoundingBox(roamingArea: "quarter" | "corner" | "full" = "quarter") {
  if (typeof window === "undefined") {
    return { minX: 300, maxX: 400, minY: 200, maxY: 300 };
  }
  const W = window.innerWidth;
  const deskH = window.innerHeight - TASKBAR_HEIGHT;

  if (roamingArea === "corner") {
    // 1/16th bottom-right corner
    const minX = Math.max(10, Math.floor(W * 0.74));
    const maxX = Math.max(minX, W - POP_W - 14);
    const maxY = Math.max(10, deskH - POP_H - 10);
    const minY = Math.max(10, maxY - 75);
    return { minX, maxX, minY, maxY };
  } else if (roamingArea === "full") {
    // Full desktop above taskbar
    const minX = 10;
    const maxX = Math.max(minX, W - POP_W - 10);
    const minY = 10;
    const maxY = Math.max(minY, deskH - POP_H - 10);
    return { minX, maxX, minY, maxY };
  } else {
    // Default: "quarter" (bottom-right quarter of desktop)
    const minX = Math.max(10, Math.floor(W * 0.50));
    const maxX = Math.max(minX, W - POP_W - 12);
    const minY = Math.max(10, Math.floor(deskH * 0.50));
    const maxY = Math.max(minY, deskH - POP_H - 10);
    return { minX, maxX, minY, maxY };
  }
}

export function getRoamingPos(roamingArea: "quarter" | "corner" | "full" = "quarter") {
  const box = getBoundingBox(roamingArea);
  return {
    x: Math.floor(box.minX + Math.random() * (box.maxX - box.minX + 1)),
    y: Math.floor(box.minY + Math.random() * (box.maxY - box.minY + 1)),
  };
}

export function clampPosByArea(rawX: number, rawY: number, roamingArea: "quarter" | "corner" | "full" = "quarter") {
  const box = getBoundingBox(roamingArea);
  return {
    x: Math.min(Math.max(rawX, box.minX), box.maxX),
    y: Math.min(Math.max(rawY, box.minY), box.maxY),
  };
}

export function clampDeskPos(rawX: number, rawY: number) {
  if (typeof window === "undefined") return { x: rawX, y: rawY };
  const W = window.innerWidth;
  const deskH = window.innerHeight - TASKBAR_HEIGHT;
  const minX = 10;
  const maxX = Math.max(minX, W - POP_W - 10);
  const minY = 10;
  const maxY = Math.max(minY, deskH - POP_H - 10); // Absolute taskbar wall
  return {
    x: Math.min(Math.max(rawX, minX), maxX),
    y: Math.min(Math.max(rawY, minY), maxY),
  };
}

// ─── Tour Positioning Helper (Positions Pop on the right with natural horizontal & vertical variety) ───
export function getTourPosition(stepIndex: number, microOffsetX: number = 0) {
  if (typeof window === "undefined") return { x: 300, y: 200 };
  const W = window.innerWidth;
  const deskH = window.innerHeight - TASKBAR_HEIGHT;

  // Varied horizontal offsets so Pop doesn't feel pinned to a vertical rail.
  // Pop moves naturally forward to gesture at windows and backward for breathing room.
  const stepOffsetsX = [70, 140, 50, 120, 160, 45, 135, 80, 115, 60];
  const preferredOffsetX = (stepOffsetsX[stepIndex % stepOffsetsX.length] || 80) + microOffsetX;

  // Max X boundary keeps Pop comfortably within the right portion of the screen,
  // allowing up to ~220px of horizontal freedom without covering main windows.
  const maxX = Math.max(10, W - POP_W - 15);
  const minX = Math.max(10, W - POP_W - 220);
  const targetX = Math.min(Math.max(W - POP_W - preferredOffsetX, minX), maxX);

  // Stagger Y between steps while staying well above taskbar
  const stepOffsetsY = [50, 130, 200, 80, 160, 60, 180, 100, 150, 80];
  const preferredY = stepOffsetsY[stepIndex % stepOffsetsY.length] || 100;
  const targetY = Math.max(10, Math.min(deskH - POP_H - 10, preferredY));

  return clampDeskPos(targetX, targetY);
}

export function PopPet({
  isOpen,
  onClose,
  hasCatnip,
  onFeedCatnip,
  onOpenApp,
  onTourAction,
  roamingArea = "quarter",
  roamingSpeed = "calm",
  tourSpeed = "5s",
  tourType: propTourType = "desktop",
  onTourTypeChange,
  isTourActive,
  onTourActiveChange,
  titleBarGradient = "linear-gradient(90deg, #881337, #be123c)",
}: {
  isOpen: boolean;
  onClose: () => void;
  hasCatnip?: boolean;
  onFeedCatnip?: () => void;
  onOpenApp?: (id: string) => void;
  onTourAction?: (action: { app: string; tab?: string }) => void;
  roamingArea?: "quarter" | "corner" | "full";
  roamingSpeed?: "calm" | "active" | "still";
  tourSpeed?: "2s" | "5s" | "8s" | "fast" | "normal" | "relaxed";
  tourType?: "desktop" | "extension";
  onTourTypeChange?: (type: "desktop" | "extension") => void;
  isTourActive?: boolean;
  onTourActiveChange?: (active: boolean) => void;
  titleBarGradient?: string;
}) {
  // Modes: "pet" (desktop companion) vs "tutorial" (elaborate guided tour)
  const [mode, setMode] = useState<"pet" | "tutorial">("pet");
  const [activeTourType, setActiveTourType] = useState<"desktop" | "extension">(propTourType);

  // Sync prop tourType & isTourActive
  useEffect(() => {
    if (propTourType) {
      setActiveTourType(propTourType);
    }
  }, [propTourType]);

  useEffect(() => {
    if (isTourActive !== undefined) {
      if (isTourActive) {
        setMode("tutorial");
        setActiveStep(0);
      } else {
        setMode("pet");
      }
    }
  }, [isTourActive]);

  // Keep parent in sync with tutorial state so screensavers never roll in during tutorials
  useEffect(() => {
    onTourActiveChange?.(mode === "tutorial");
  }, [mode, onTourActiveChange]);

  // Step in tutorial or pet thoughts
  const [activeStep, setActiveStep] = useState<number>(0);
  const [timerProgress, setTimerProgress] = useState<number>(0);

  // Pop states
  const [isDragging, setIsDragging] = useState(false);
  const [isRoaming, setIsRoaming] = useState(roamingSpeed !== "still");
  const [isSleeping, setIsSleeping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [squish, setSquish] = useState(false);
  const [heartSparkle, setHeartSparkle] = useState(false);
  const [eating, setEating] = useState(false);
  const [customDialogue, setCustomDialogue] = useState<string | null>(null);

  // Typewriter state for pixel dialogue
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Position initialized safely within the configured roaming area
  const [pos, setPos] = useState<{ x: number; y: number }>(() => getRoamingPos(roamingArea));

  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // Re-clamp position whenever roamingArea, isOpen, or window resize occurs
  useEffect(() => {
    if (isOpen) {
      if (mode === "pet") {
        setPos(getRoamingPos(roamingArea));
      } else {
        setPos((prev) => clampDeskPos(prev.x, prev.y));
      }
    }
  }, [isOpen, roamingArea]);

  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        if (mode === "pet" && !hasCatnip) {
          return clampPosByArea(prev.x, prev.y, roamingArea);
        }
        return clampDeskPos(prev.x, prev.y);
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mode, hasCatnip, roamingArea]);

  // ─── Elaborate Multi-Step Guided Tour with Spotlights ─────────────────────────
  // Note: During the tour, Pop positions itself on the right edge so the window content is 100% visible!
  const tutorialSteps = [
    {
      title: "Welcome to Strikeout OS",
      action: null,
      targetPos: () => getTourPosition(0),
      facingLeft: true,
      highlightSelector: null,
      highlightLabel: null,
      text: "Welcome to Strikeout OS! I'm Pop, your cybersecurity companion. Let's explore your private cases vault, breach scanner, extension simulator, and settings.",
    },
    {
      title: "Cases & Reports - Vault",
      action: { app: "cases", tab: "cases" },
      targetPos: () => getTourPosition(1),
      facingLeft: true,
      highlightSelector: "#tour-cases-tab-mycases",
      highlightLabel: "My Cases Vault",
      text: "Cases & Reports is your private vault. When accounts are compromised or you face harassment, this app securely tracks evidence. Cases and attached evidence are stored privately in your signed-in STRIKEOUT account.",
    },
    {
      title: "Cases & Reports - Log Incident",
      action: { app: "cases", tab: "new" },
      targetPos: () => getTourPosition(2),
      facingLeft: true,
      highlightSelector: "#tour-cases-tab-new",
      highlightLabel: "+ New Incident Form",
      text: "Here in '+ New incident', document what happened. Select the platform (Instagram, Discord, etc.), specify the date, and describe facts. Unknowns can stay unknown.",
    },
    {
      title: "Cases & Reports - Support Desk",
      action: { app: "cases", tab: "help" },
      targetPos: () => getTourPosition(3),
      facingLeft: true,
      highlightSelector: "#tour-cases-tab-help",
      highlightLabel: "Support & Legal Portals",
      text: "Under 'Get help', access official account recovery links, reviewable complaint drafts, cybercrime portals, and emotional counselling resources.",
    },
    {
      title: "Check Exposure - Breach Search",
      action: { app: "exposure", tab: "email" },
      targetPos: () => getTourPosition(4),
      facingLeft: true,
      highlightSelector: "#tour-exposure-search-well",
      highlightLabel: "OSINT Live Scanner",
      text: "Check Exposure reviews supplied documents and public references. GitHub search covers public issues and pull requests. Password checks send only a hash prefix; they do not scan the dark web.",
    },
    {
      title: "Pop.exe Sim - Browser Sandbox",
      action: { app: "extsim", tab: "sim_browser" },
      targetPos: () => getTourPosition(5),
      facingLeft: true,
      highlightSelector: "#tour-sim-badge",
      highlightLabel: "Simulated Web Environment",
      text: "Notice the yellow banner: this is Pop's Simulated Browser Environment! It safely demonstrates how my unpacked extension defends you on live websites.",
    },
    {
      title: "Pop Extension Toolbar (panel.html)",
      action: { app: "extsim", tab: "sim_browser" },
      targetPos: () => getTourPosition(6),
      facingLeft: true,
      highlightSelector: "#tour-extension-popup",
      highlightLabel: "Pop.exe Toolbar Popup",
      text: "Look at the top right: this is Pop's 220px toolbar popup! From here, you can click Pet Pop, run in-page Scans, check active Drafts, or capture Evidence.",
    },
    {
      title: "Watchlist Studio (workspace.html)",
      action: { app: "extsim", tab: "sim_watchlist" },
      targetPos: () => getTourPosition(7),
      facingLeft: true,
      highlightSelector: "#tour-watchlist-studio",
      highlightLabel: "Private Watchlist Studio",
      text: "First step in defense: Your Watchlist! Add your private emails, phones, and handles here. Pop monitors web forms and alerts you if you accidentally paste them.",
    },
    {
      title: "Real-Time Sharing Guard",
      action: { app: "extsim", tab: "sim_guard" },
      targetPos: () => getTourPosition(8),
      facingLeft: true,
      highlightSelector: "#tour-sharing-guard",
      highlightLabel: "Sharing Guard Interceptor",
      text: "Watch what happens in this field: when watched info is typed or pasted, Sharing Guard immediately flags it and lets you slice it out with one click!",
    },
    {
      title: "In-Page Text Scanner",
      action: { app: "extsim", tab: "sim_scan" },
      targetPos: () => getTourPosition(9),
      facingLeft: true,
      highlightSelector: "#tour-scan-target",
      highlightLabel: "In-Page Scanner",
      text: "Clicking 'Scan' in the popup walks text nodes on the page and highlights occurrences of your watched handles, like @alex_target below!",
    },
    {
      title: "Review & Redaction Studio",
      action: { app: "extsim", tab: "sim_canvas" },
      targetPos: () => getTourPosition(1),
      facingLeft: true,
      highlightSelector: "#tour-canvas-studio",
      highlightLabel: "Evidence Redaction Canvas",
      text: "Clicking 'Capture' snapshots the incident. On this canvas, drag black redaction boxes over sensitive avatars or numbers to permanently bake in privacy before exporting!",
    },
    {
      title: "Evidence Dossiers to Cases",
      action: { app: "extsim", tab: "sim_evidence" },
      targetPos: () => getTourPosition(2),
      facingLeft: true,
      highlightSelector: "#tour-evidence-export",
      highlightLabel: "Export to Strikeout Vault",
      text: "Click 'Export to Strikeout Cases & Reports Desk' to hand off your timestamped, redacted evidence into a draft that you review before saving. Attach the exported screenshot separately.",
    },
    {
      title: "Get Pop - Extension Package",
      action: { app: "getpop", tab: "chrome" },
      targetPos: () => getTourPosition(3),
      facingLeft: true,
      highlightSelector: "#tour-getpop-downloads",
      highlightLabel: "Download Real Extension",
      text: "Ready for the real deal? Download my unpacked ZIP extension package for Chrome, Brave, Edge, and Firefox. It requires no store account and keeps its core checks and evidence local; optional chat uses STRIKEOUT and Gemini.",
    },
    {
      title: "Tour Complete!",
      action: null,
      targetPos: () => getRoamingPos(roamingArea),
      facingLeft: false,
      highlightSelector: null,
      highlightLabel: null,
      text: "Tour complete! Click my (!) badge anytime to feed me snacks, put me to sleep, or switch between Pet and Tutorial modes.",
    },
  ];

  // ─── Pop.exe Extension Simulator Guided Tour (16 Smooth, Interactive Steps) ───
  const extensionTourSteps = [
    {
      title: "1. The Scene — Browsing the Web",
      action: { app: "extsim", tab: "sim_scene" },
      targetPos: () => getTourPosition(0),
      facingLeft: true,
      highlightSelector: "#tour-sim-scene",
      highlightLabel: "🌐 Web Browser Simulation",
      text: "Imagine the scene: you're casually browsing the web—visiting forums, draft editors, and social networks (like this simulated browser window). Pop is installed in your browser to guard your privacy in the background.",
    },
    {
      title: "2. Pop on Your Browser Toolbar",
      action: { app: "extsim", tab: "sim_toolbar_icon" },
      targetPos: () => getTourPosition(1),
      facingLeft: true,
      highlightSelector: "#tour-popup-toggle",
      highlightLabel: "Pop Toolbar Icon (v2.2.0)",
      text: "Look up at your browser's extension toolbar: Pop's cat icon sits right next to the URL address bar! Whenever you are on any webpage, clicking Pop opens your personal 220px cybersecurity control panel.",
    },
    {
      title: "3. Inside Pop's Popup Panel (panel.html)",
      action: { app: "extsim", tab: "sim_popup_panel" },
      targetPos: () => getTourPosition(2),
      facingLeft: true,
      highlightSelector: "#tour-extension-popup",
      highlightLabel: "Pop Toolbar Popup (panel.html)",
      text: "Here is Pop's 220px toolbar popup! It gives you fast 1-click tools right on the active webpage: Pet Pop, Scan the page, verify Drafts, capture Evidence, or manage your Watchlist.",
    },
    {
      title: "4. Where is the Watchlist?",
      action: { app: "extsim", tab: "sim_popup_watchlist_link" },
      targetPos: () => getTourPosition(3),
      facingLeft: true,
      highlightSelector: "#tour-popup-link-watchlist",
      highlightLabel: "Watchlist Studio Link",
      text: "Where is your Watchlist? Right here at the bottom of Pop's popup! Clicking 'Watchlist' opens STRIKEOUT website settings for the real extension. This simulator demonstrates the same idea locally. Let's click it now to see what it does.",
    },
    {
      title: "5. What the Watchlist Does",
      action: { app: "extsim", tab: "sim_watchlist_studio" },
      targetPos: () => getTourPosition(4),
      facingLeft: true,
      highlightSelector: "#tour-watchlist-studio",
      highlightLabel: "Private Watchlist Manager",
      text: "The Watchlist holds the identifiers you want Pop to match. You list your sensitive emails, phone numbers, and private handles here. Pop remembers them strictly inside your local browser storage—never sent to any server.",
    },
    {
      title: "6. How to Use the Watchlist",
      action: { app: "extsim", tab: "sim_watchlist_form" },
      targetPos: () => getTourPosition(5),
      facingLeft: true,
      highlightSelector: "#tour-watchlist-add-form",
      highlightLabel: "Add Identifier Form",
      text: "How to use it: choose the type (Email, Phone, or Username), type in your private info (like demo@example.org), and click '+ Add Identifier'. After saving, Pop can warn about matches in supported fields on pages where you allow him.",
    },
    {
      title: "7. Returning to the Web Page Form",
      action: { app: "extsim", tab: "sim_guard_form" },
      targetPos: () => getTourPosition(6),
      facingLeft: true,
      highlightSelector: "#tour-sharing-guard",
      highlightLabel: "Webpage Form & Input Field",
      text: "Now you're back on a website, drafting a comment or updating a public bio. Accidental data leaks happen all the time when pasting notes. Watch what happens if you type or paste your watched email here...",
    },
    {
      title: "8. Sharing Guard Real-Time Alert",
      action: { app: "extsim", tab: "sim_guard_alert" },
      targetPos: () => getTourPosition(7),
      facingLeft: true,
      highlightSelector: "#tour-guard-alert-badge",
      highlightLabel: "Sharing Guard Interceptor Warning",
      text: "BOOM! Pop's Sharing Guard catches the leak instantly before you can hit submit! Pop pops up right under the field, flags the exact watched match, and prevents accidental leaks.",
    },
    {
      title: "9. One-Click 'Slice Out' Sanitization",
      action: { app: "extsim", tab: "sim_guard_slice" },
      targetPos: () => getTourPosition(8),
      facingLeft: true,
      highlightSelector: "#tour-guard-slice-btn",
      highlightLabel: "1-Click 'Remove Matched' Sanitizer",
      text: "Notice this red 'Remove Matched' button? Click it, and Pop surgically slices out your private email or phone while keeping the rest of your post draft intact. Always review the edited draft before sharing.",
    },
    {
      title: "10. In-Page Content Scanner (page-scan.js)",
      action: { app: "extsim", tab: "sim_scan_btn" },
      targetPos: () => getTourPosition(9),
      facingLeft: true,
      highlightSelector: "#tour-btn-scan",
      highlightLabel: "Popup 'Scan' Button",
      text: "What about finding mentions or impostors on pages you visit? In Pop's popup, click the 'Scan' button. Pop checks rendered text on allowed webpages for your watched identifiers. Matches do not establish impersonation or public accessibility.",
    },
    {
      title: "11. Highlighting Mentions on the Page",
      action: { app: "extsim", tab: "sim_scan_results" },
      targetPos: () => getTourPosition(0),
      facingLeft: true,
      highlightSelector: "#tour-scan-target",
      highlightLabel: "In-Page Highlight Result",
      text: "Look at the webpage text below: Pop highlighted @alex_target in bright yellow! Whether it's a doxxing thread or an impersonation account, Pop brings it to your attention immediately.",
    },
    {
      title: "12. Capturing Evidence (evidence.js)",
      action: { app: "extsim", tab: "sim_capture_btn" },
      targetPos: () => getTourPosition(1),
      facingLeft: true,
      highlightSelector: "#tour-btn-capture",
      highlightLabel: "Popup 'Capture' Button",
      text: "Need to document harassment or a fake account? Click 'Capture' in Pop's popup! Pop takes a clean, timestamped screenshot of the webpage and transports it into Pop's Canvas Redaction Studio.",
    },
    {
      title: "13. Redaction Studio — Protecting Bystanders",
      action: { app: "extsim", tab: "sim_redaction_canvas" },
      targetPos: () => getTourPosition(2),
      facingLeft: true,
      highlightSelector: "#tour-canvas-element",
      highlightLabel: "Interactive Redaction Canvas",
      text: "Here is the Redaction Studio! How to use it: click and drag black boxes over sensitive avatars, bystanders' handles, or private numbers. Redaction permanently burns black pixels into the image so secrets cannot be uncovered.",
    },
    {
      title: "14. Saving Evidence Dossier Locally",
      action: { app: "extsim", tab: "sim_save_evidence" },
      targetPos: () => getTourPosition(3),
      facingLeft: true,
      highlightSelector: "#tour-btn-save-evidence",
      highlightLabel: "Save Evidence Locally",
      text: "Click 'Save Evidence Locally' to store the redacted screenshot, timestamp, and target URL into your browser's private IndexedDB evidence locker.",
    },
    {
      title: "15. Exporting to Strikeout Cases Vault",
      action: { app: "extsim", tab: "sim_evidence_export" },
      targetPos: () => getTourPosition(4),
      facingLeft: true,
      highlightSelector: "#tour-evidence-export",
      highlightLabel: "Export to Cases Vault",
      text: "Ready to file a report? Click 'Export to Strikeout Cases & Reports Desk'! Pop seamlessly hands off your tamper-proof evidence dossier directly into your Strikeout desktop OS vault for police or platform reports.",
    },
    {
      title: "16. Downloading & Installing the Real Extension",
      action: { app: "getpop", tab: "chrome" },
      targetPos: () => getTourPosition(5),
      facingLeft: true,
      highlightSelector: "#tour-getpop-downloads",
      highlightLabel: "Download Unpacked Extension ZIP",
      text: "That's the entire workflow! In 'Get Pop', download your unpacked extension ZIP. Go to chrome://extensions or edge://extensions, turn on Developer Mode, click 'Load unpacked', and Pop will guard your real browser!",
    },
  ];

  // ─── Pet Mode Thoughts ────────────────────────────────────────────────────────
  const petThoughts = [
    {
      title: "Pop Guardian",
      text: "Everything is quiet. Your local case workspace is private and secured.",
    },
    {
      title: "Cyber Tip: Passwords",
      text: "Never reuse passwords across your email and social accounts. A leak on one compromises both.",
    },
    {
      title: "Cyber Tip: Phishing",
      text: "Suspicious DM asking for a login code? Legitimate services will never ask you to send your SMS codes.",
    },
    {
      title: "Desktop Tip: Catnip",
      text: "Double-click Cyber-Catnip on the desktop if you want to lead me around and give me a treat!",
    },
    {
      title: "Cyber Tip: Evidence",
      text: "Archive harassment posts immediately before attackers delete them. Timestamped screenshots matter.",
    },
    {
      title: "Pop Companion",
      text: "Need a short break from the screen? Take a five minute stretch—I will keep watch over your desktop.",
    },
  ];

  const currentTourSteps = activeTourType === "extension" ? extensionTourSteps : tutorialSteps;
  const currentSteps = mode === "tutorial" ? currentTourSteps : petThoughts;
  const currentStepData = currentSteps[activeStep] || currentSteps[0];
  const currentTextToType = isSleeping
    ? "Zzz... Pop is resting and recharging encryption keys... click (!) to wake me up."
    : mode === "pet" && customDialogue
    ? customDialogue
    : currentStepData.text;

  // ─── Typewriter Effect ────────────────────────────────────────────────────────
  useEffect(() => {
    setDisplayedText("");
    setIsTyping(true);
    let index = 0;
    const target = currentTextToType;

    const timer = setInterval(() => {
      index++;
      if (index <= target.length) {
        setDisplayedText(target.slice(0, index));
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 18);

    return () => clearInterval(timer);
  }, [currentTextToType]);

  const handleCompleteTyping = () => {
    if (isTyping) {
      setDisplayedText(currentTextToType);
      setIsTyping(false);
    }
  };

  // ─── Automatic Timer Bar & Next Step Progression (2s, 5s default, 8s) ────────
  useEffect(() => {
    if (isSleeping || isDragging || hasCatnip || customDialogue) {
      setTimerProgress(0);
      return;
    }

    const DURATION_MS =
      tourSpeed === "2s" || tourSpeed === "fast"
        ? 2000
        : tourSpeed === "8s" || tourSpeed === "relaxed"
        ? 8000
        : 5000; // 5 seconds default
    const TICK_INTERVAL_MS = 100;
    const stepIncrement = (TICK_INTERVAL_MS / DURATION_MS) * 100;

    const timer = setInterval(() => {
      setTimerProgress((prev) => {
        if (prev >= 100) {
          setActiveStep((s) => (s + 1) % currentSteps.length);
          return 0;
        }
        return prev + stepIncrement;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [mode, currentSteps.length, isSleeping, isDragging, hasCatnip, customDialogue, tourSpeed]);

  // ─── Handle Step Change Actions in Tutorial Mode ─────────────────────────────
  useEffect(() => {
    if (mode === "tutorial" && !isDragging && !hasCatnip) {
      const step = currentTourSteps[activeStep];
      if (step) {
        const target = step.targetPos();
        setFacingLeft(step.facingLeft);
        setPos(target);

        if (step.action) {
          if (onOpenApp) onOpenApp(step.action.app);
          if (onTourAction) onTourAction(step.action);
        }
      }
    }
  }, [mode, activeStep, activeTourType]);

  // ─── Dragging Pop: Locked to bounding box in pet mode; taskbar is absolute wall ─
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setSquish(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const rawX = dragStartRef.current.initX + dx;
      const rawY = dragStartRef.current.initY + dy;

      if (mode === "pet" && !hasCatnip) {
        setPos(clampPosByArea(rawX, rawY, roamingArea));
      } else {
        setPos(clampDeskPos(rawX, rawY));
      }
    };

    const onUp = () => {
      setIsDragging(false);
      setSquish(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, mode, hasCatnip, roamingArea]);

  // ─── Roaming in Pet Mode (Honors configured area, taskbar is absolute wall) ────
  useEffect(() => {
    if (mode !== "pet" || !isRoaming || isSleeping || isDragging || hasCatnip || roamingSpeed === "still") return;

    const intervalMs = roamingSpeed === "active" ? 6000 : 12000;
    const roamInterval = setInterval(() => {
      setPos((prev) => {
        const nextPos = getRoamingPos(roamingArea);
        setFacingLeft(nextPos.x < prev.x);
        return nextPos;
      });
    }, intervalMs);

    return () => clearInterval(roamInterval);
  }, [mode, isRoaming, isSleeping, isDragging, hasCatnip, roamingArea, roamingSpeed]);

  // ─── Tutorial Mode Micro-Pacing: Natural horizontal freedom so Pop doesn't feel stiff ───
  useEffect(() => {
    if (mode !== "tutorial" || isSleeping || isDragging || hasCatnip) return;

    // Every 3.5s, give Pop a gentle, lively step (+/- 40px horizontal) around the step anchor
    const paceInterval = setInterval(() => {
      setPos((prev) => {
        const base = tutorialSteps[activeStep]?.targetPos() || getTourPosition(activeStep);
        const microX = (Math.random() - 0.5) * 80; // +/- 40px natural sway
        const microY = (Math.random() - 0.5) * 20; // gentle vertical bob
        const nextX = base.x + microX;
        const nextY = base.y + microY;
        setFacingLeft(nextX < prev.x);
        return clampDeskPos(nextX, nextY);
      });
    }, 3500);

    return () => clearInterval(paceInterval);
  }, [mode, activeStep, isSleeping, isDragging, hasCatnip]);

  const posRef = useRef(pos);
  posRef.current = pos;

  // ─── Petting & Feeding Interaction ───────────────────────────────────────────
  const petQuotes = [
    "*purrs in binary* 01000001 01010111!",
    "BEEP! That tickles! Bodyguard mode active!",
    "Ow! Careful with the pixels, you'll smudge my firewall!",
    "Did you know? Taking deep breaths prevents rage-typing doxxes.",
    "Firewalls online, system clean. Good to have you here!",
  ];

  const handlePetPop = useCallback(() => {
    if (isSleeping) {
      setIsSleeping(false);
      if (mode === "pet") {
        setCustomDialogue("Yawn... I'm awake! Security monitors online.");
        setTimeout(() => setCustomDialogue(null), 3000);
      }
      return;
    }

    setSquish(true);
    setHeartSparkle(true);

    if (mode === "tutorial") {
      // In tutorial mode, all petting/feeding visual features stay, but dialog is kept intact
      if (hasCatnip && onFeedCatnip) {
        setEating(true);
        onFeedCatnip();
        setTimeout(() => setEating(false), 2400);
        setTimeout(() => {
          const target = tutorialSteps[activeStep]?.targetPos() || getTourPosition(activeStep);
          setFacingLeft(true);
          setPos(target);
        }, 2600);
      }
      setTimeout(() => setSquish(false), 250);
      setTimeout(() => setHeartSparkle(false), 1200);
      return;
    }

    // In Pet mode: cute quotes and roaming return
    if (hasCatnip && onFeedCatnip) {
      setEating(true);
      setCustomDialogue("OM NOM NOM! Cyber-Catnip received! Thank you!");
      onFeedCatnip();
      setTimeout(() => setEating(false), 2400);
      setTimeout(() => {
        setCustomDialogue(null);
        const home = getRoamingPos(roamingArea);
        setFacingLeft(true);
        setPos(home);
      }, 2600);
    } else {
      const q = petQuotes[Math.floor(Math.random() * petQuotes.length)];
      setCustomDialogue(q);
      setTimeout(() => setCustomDialogue(null), 3800);
    }

    setTimeout(() => setSquish(false), 250);
    setTimeout(() => setHeartSparkle(false), 1200);
  }, [hasCatnip, onFeedCatnip, isSleeping, roamingArea, mode, activeStep]);

  // ─── Cyber-Catnip Cursor Tracking (Taskbar remains an absolute border) ────────
  useEffect(() => {
    if (!hasCatnip || isDragging) return;

    if (mode === "pet") {
      setCustomDialogue("SNIFF SNIFF?! Is that Cyber-Catnip?! Gimme!");
    }

    const handleMouseMoveCatnip = (e: MouseEvent) => {
      const current = posRef.current;
      const popCenterX = current.x + 110;
      const popCenterY = current.y + 140;
      const dx = e.clientX - popCenterX;
      const dy = e.clientY - popCenterY;
      const dist = Math.hypot(dx, dy);

      if (dist > 160 && dist < 750) {
        const angle = Math.atan2(dy, dx);
        const rawTargetX = e.clientX - Math.cos(angle) * 110 - 110;
        const rawTargetY = e.clientY - Math.sin(angle) * 110 - 140;

        const clamped = clampDeskPos(rawTargetX, rawTargetY);
        setFacingLeft(dx < 0);
        setPos(clamped);
      } else if (dist <= 160) {
        setFacingLeft(dx < 0);
        if (mode === "pet") {
          setCustomDialogue("Click me to feed the catnip! OM NOM NOM!");
        }
      }
    };

    const handleWindowClickFeed = (e: MouseEvent) => {
      const current = posRef.current;
      const popCenterX = current.x + 110;
      const popCenterY = current.y + 140;
      const dist = Math.hypot(e.clientX - popCenterX, e.clientY - popCenterY);
      if (dist < 260) {
        handlePetPop();
      }
    };

    window.addEventListener("mousemove", handleMouseMoveCatnip);
    window.addEventListener("click", handleWindowClickFeed);
    return () => {
      window.removeEventListener("mousemove", handleMouseMoveCatnip);
      window.removeEventListener("click", handleWindowClickFeed);
    };
  }, [hasCatnip, isDragging, handlePetPop, mode]);

  const handleSnack = () => {
    setEating(true);
    setMenuOpen(false);
    if (mode === "pet") {
      setCustomDialogue("NOM NOM NOM! SSL cookie devoured!");
      setTimeout(() => setCustomDialogue(null), 3500);
    }
    setTimeout(() => setEating(false), 2000);
  };

  const handleToggleSleep = () => {
    setMenuOpen(false);
    setIsSleeping((s) => !s);
    setCustomDialogue(null);
  };

  const handleToggleRoaming = () => {
    setMenuOpen(false);
    setIsRoaming((r) => !r);
  };

  const handlePrev = () => {
    setCustomDialogue(null);
    setTimerProgress(0);
    setActiveStep((s) => (s > 0 ? s - 1 : currentSteps.length - 1));
  };

  const handleNext = () => {
    setCustomDialogue(null);
    setTimerProgress(0);
    setActiveStep((s) => (s + 1) % currentSteps.length);
  };

  const handleSwitchTour = (type: "desktop" | "extension") => {
    setActiveTourType(type);
    onTourTypeChange?.(type);
    setMode("tutorial");
    setActiveStep(0);
    setTimerProgress(0);
    setCustomDialogue(null);
    onTourActiveChange?.(true);
    if (type === "extension" && onOpenApp) {
      onOpenApp("extsim");
    }
  };

  const handleSwitchMode = (newMode: "pet" | "tutorial") => {
    setMode(newMode);
    setActiveStep(0);
    setTimerProgress(0);
    setCustomDialogue(null);
    if (newMode === "pet") {
      onTourActiveChange?.(false);
      setPos(getRoamingPos(roamingArea));
    } else {
      onTourActiveChange?.(true);
    }
  };

  if (!isOpen) return null;

  const currentTourStep = mode === "tutorial" ? currentTourSteps[activeStep] : null;

  return (
    <>
      {/* ─── HIGHLIGHT SPOTLIGHT BOX (In Tutorial Mode) ───────────────────── */}
      {mode === "tutorial" && currentTourStep?.highlightSelector && (
        <TourHighlightBox
          targetSelector={currentTourStep.highlightSelector}
          label={currentTourStep.highlightLabel || undefined}
          stepNumber={activeStep + 1}
        />
      )}

      <div
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
        zIndex: 99990,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        userSelect: "none",
        pointerEvents: "auto",
        transition: isDragging
          ? "none"
          : hasCatnip
          ? "left 0.8s cubic-bezier(0.2, 0.9, 0.3, 1), top 0.8s cubic-bezier(0.2, 0.9, 0.3, 1)"
          : "left 1.4s cubic-bezier(0.25, 1, 0.5, 1), top 1.4s cubic-bezier(0.25, 1, 0.5, 1)",
      }}
    >
      {/* ─── CLIPPY RETRO ASSISTANT DIALOGUE BOX ────────────────────────────── */}
      <div
        onClick={handleCompleteTyping}
        style={{
          width: "290px",
          background: "#ffffe6",
          border: "2px solid #000000",
          boxShadow: "3px 3px 0px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          marginBottom: "8px",
          position: "relative",
          cursor: isTyping ? "pointer" : "default",
          borderRadius: "3px",
        }}
      >
        {/* Top Header: Mode Selector [ 🐾 Pet ] [ 🎓 Tutorial ] & Close */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            background: "#ebebc7",
            borderBottom: "1px solid #737373",
            padding: "4px 6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "move",
          }}
        >
          {/* Mode Switching: Pet Companion vs Tutorial (General / Extension) */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSwitchMode("pet");
              }}
              style={{
                background: mode === "pet" ? "#000080" : "#d4d4aa",
                color: mode === "pet" ? "#ffffff" : "#000000",
                border: "1px solid #555",
                fontSize: "10px",
                fontFamily: RETRO_FONT,
                fontWeight: "bold",
                padding: "2px 5px",
                cursor: "pointer",
                borderRadius: "1px",
              }}
              title="Switch to Pet Companion mode"
            >
              🐾 Pet
            </button>

            {/* Tutorial Group: Tutorial label with General & Extension sub-options */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                background: mode === "tutorial" ? "#dcd6b2" : "transparent",
                padding: "1px 3px",
                borderRadius: "2px",
                border: mode === "tutorial" ? "1px solid #808080" : "1px solid transparent",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: RETRO_FONT,
                  fontWeight: "bold",
                  color: mode === "tutorial" ? "#000080" : "#555555",
                  marginRight: "2px",
                }}
              >
                Tutorial:
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchTour("desktop");
                }}
                style={{
                  background: mode === "tutorial" && activeTourType === "desktop" ? "#000080" : "#ebebc7",
                  color: mode === "tutorial" && activeTourType === "desktop" ? "#ffffff" : "#000000",
                  border: "1px solid #666",
                  fontSize: "10px",
                  fontFamily: RETRO_FONT,
                  fontWeight: mode === "tutorial" && activeTourType === "desktop" ? "bold" : "normal",
                  padding: "1px 5px",
                  cursor: "pointer",
                  borderRadius: "1px",
                }}
                title="General website and OS tour (14 steps)"
              >
                General
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchTour("extension");
                }}
                style={{
                  background: mode === "tutorial" && activeTourType === "extension" ? "#000080" : "#ebebc7",
                  color: mode === "tutorial" && activeTourType === "extension" ? "#ffffff" : "#000000",
                  border: "1px solid #666",
                  fontSize: "10px",
                  fontFamily: RETRO_FONT,
                  fontWeight: mode === "tutorial" && activeTourType === "extension" ? "bold" : "normal",
                  padding: "1px 5px",
                  cursor: "pointer",
                  borderRadius: "1px",
                }}
                title="Pop browser extension tutorial (16 steps)"
              >
                Extension
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                fontSize: "10px",
                fontFamily: RETRO_FONT,
                color: "#444",
                fontWeight: "bold",
              }}
            >
              {activeStep + 1}/{currentSteps.length}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{
                background: "#d4d4aa",
                border: "1px solid #555",
                fontSize: "9px",
                fontWeight: "bold",
                cursor: "pointer",
                padding: "0 4px",
                lineHeight: 1,
              }}
              title="Hide Pop"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Clippy Body: Clean Retro Text Box with Pixelated High-Contrast Font */}
        <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            style={{
              minHeight: "56px",
              fontSize: "14px",
              lineHeight: "1.35",
              color: "#0a0a0a",
              fontFamily: RETRO_FONT,
              fontWeight: "600",
              letterSpacing: "0.4px",
              position: "relative",
              wordBreak: "break-word",
            }}
          >
            <span>{displayedText}</span>
            {isTyping && <span style={{ color: "#000080", fontWeight: "bold", marginLeft: "2px" }}>▋</span>}
          </div>

          {/* Automatic Progression Timer Bar */}
          <div
            style={{
              ...sunken,
              height: "4px",
              background: "#dcd6b2",
              width: "100%",
              overflow: "hidden",
              position: "relative",
            }}
            title="Auto-advancing timer bar"
          >
            <div
              style={{
                height: "100%",
                background: "#000080",
                width: `${timerProgress}%`,
                transition: "width 0.1s linear",
              }}
            />
          </div>

          {/* Simple Navigation: Prev and Next buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "2px",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              style={{
                background: "#ebebc7",
                border: "1px solid #737373",
                ...raised,
                padding: "1px 8px",
                fontSize: "11px",
                fontFamily: RETRO_FONT,
                fontWeight: "bold",
                cursor: "pointer",
              }}
              title="Previous dialogue"
            >
              ◀ Prev
            </button>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
              <span style={{ fontSize: "10px", color: "#000080", fontFamily: RETRO_FONT, fontWeight: "bold" }}>
                {mode === "tutorial"
                  ? `${activeTourType === "extension" ? "Tutorial: Extension" : "Tutorial: General"} ${activeStep + 1}/${currentSteps.length}`
                  : "🐾 Desktop Pet"}
              </span>
              <span style={{ fontSize: "9px", color: "#777", fontFamily: RETRO_FONT }}>
                ⏱️ {tourSpeed === "2s" || tourSpeed === "fast" ? "2s" : tourSpeed === "8s" || tourSpeed === "relaxed" ? "8s" : "5s"} auto
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              style={{
                background: "#ebebc7",
                border: "1px solid #737373",
                ...raised,
                padding: "1px 8px",
                fontSize: "11px",
                fontFamily: RETRO_FONT,
                fontWeight: "bold",
                cursor: "pointer",
              }}
              title="Next dialogue"
            >
              Next ▶
            </button>
          </div>
        </div>

        {/* Triangle Speech Pointer */}
        <div
          style={{
            position: "absolute",
            bottom: "-8px",
            right: "32px",
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "8px solid #ffffe6",
            filter: "drop-shadow(0 2px 0 #000000)",
          }}
        />
      </div>

      {/* ─── POP THE DESKTOP PET CHARACTER SPRITE ──────────────────────────── */}
      <div
        className="pop-pet-cursor"
        onMouseDown={handleMouseDown}
        onClick={handlePetPop}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: isDragging ? "grabbing" : "url('/pet-hand-cursor.png') 16 16, pointer",
          position: "relative",
          marginRight: "20px",
          padding: hasCatnip ? "10px" : "2px",
          borderRadius: hasCatnip ? "16px" : "0px",
          background: hasCatnip ? "rgba(34, 197, 94, 0.22)" : "transparent",
          border: hasCatnip ? "2px dashed #16a34a" : "2px solid transparent",
          transition: "padding 0.2s, background 0.2s",
        }}
        title={
          hasCatnip
            ? "Click Pop to feed Cyber-Catnip!"
            : isSleeping
            ? "Pop is sleeping. Click to wake up!"
            : "Click to pet Pop, or click the (!) badge for actions!"
        }
      >
        {/* Floating Heart / Sparkle when petted or fed */}
        {heartSparkle && (
          <div
            style={{
              position: "absolute",
              top: "-16px",
              fontSize: "18px",
              animation: "popFloat 0.8s ease-out",
              zIndex: 10,
            }}
          >
            {hasCatnip ? "🌿💖✨" : "💖✨"}
          </div>
        )}

        {/* Sleeping Zzz Particles */}
        {isSleeping && (
          <div
            style={{
              position: "absolute",
              top: "-18px",
              right: "12px",
              fontSize: "16px",
              fontFamily: RETRO_FONT,
              fontWeight: "bold",
              color: "#3b82f6",
              animation: "popFloat 1.8s infinite ease-in-out",
              zIndex: 10,
              textShadow: "1px 1px 0px #000",
            }}
          >
            Zzz...
          </div>
        )}

        {/* ─── POP SPRITE WITH (!) EXCLAMATION BADGE ───────────────────────── */}
        <div
          style={{
            position: "relative",
            animation: isDragging || isSleeping ? "none" : "popFloat 2.8s infinite ease-in-out",
            transform: squish
              ? "scale(1.22, 0.78) translateY(6px)"
              : eating
              ? "scale(1.08, 0.94)"
              : isSleeping
              ? "scale(1.04, 0.90) translateY(4px)"
              : facingLeft
              ? "scaleX(-1)"
              : "scale(1, 1)",
            opacity: isSleeping ? 0.88 : 1,
            transition: "transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
        >
          <img
            src="/pop.png"
            alt="Pop Pet"
            style={{
              width: "114px",
              height: "114px",
              objectFit: "contain",
              imageRendering: "pixelated",
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.45))",
            }}
          />

          {/* Eating animation */}
          {eating && (
            <div
              style={{
                position: "absolute",
                top: "46px",
                right: "8px",
                fontSize: "22px",
                animation: "popSnack 0.35s infinite alternate",
              }}
            >
              {hasCatnip ? "🌿" : "🍪"}
            </div>
          )}
        </div>

        {/* ─── RETRO EXCLAMATION MARK BADGE (!) ────────────────────────────── */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((m) => !m);
          }}
          style={{
            position: "absolute",
            top: "2px",
            right: "-4px",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: menuOpen ? "#f59e0b" : "#fbbf24",
            border: "2px solid #000000",
            boxShadow: "1px 1px 0px #ffffff, 2px 2px 0px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "900",
            fontSize: "15px",
            fontFamily: RETRO_FONT,
            color: "#000000",
            cursor: "pointer",
            zIndex: 30,
            animation: menuOpen ? "none" : "bounce 1.5s infinite alternate",
          }}
          title="Click for Pop Pet Actions Menu"
        >
          !
        </button>

        {/* ─── WIN95 CONTEXT MENU TRIGGERED BY (!) BADGE ────────────────────── */}
        {menuOpen && (() => {
          const deskH = typeof window !== "undefined" ? window.innerHeight - TASKBAR_HEIGHT : 800;
          // Calculate if the ~165px menu would touch or cross the taskbar when opening downwards
          // Pop sprite wrapper starts around pos.y + 158. Downward menu reaches pos.y + 158 + 28 + 165 = pos.y + 351.
          // If that touches or crosses deskH, open ABOVE Pop!
          const openAbove = pos.y + 350 >= deskH;

          return (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: openAbove ? "auto" : "28px",
                bottom: openAbove ? "26px" : "auto",
                right: "-10px",
                width: "155px",
                background: "#c0c0c0",
                ...raised,
                border: "2px solid",
                borderColor: "#ffffff #404040 #404040 #ffffff",
                boxShadow: "3px 3px 6px rgba(0,0,0,0.4)",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                padding: "2px",
                fontFamily: SYS_FONT,
              }}
            >
              {/* Feed Snack Option */}
              <div
                onClick={handleSnack}
                style={{
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#000080";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#000000";
                }}
              >
                <span>🍪</span>
                <span>Feed Snack</span>
              </div>

              {/* Sit / Wander Option */}
              <div
                onClick={handleToggleRoaming}
                style={{
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#000080";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#000000";
                }}
              >
                <span>{isRoaming ? "🪑" : "🐾"}</span>
                <span>{isRoaming ? "Sit Down" : "Wander Around"}</span>
              </div>

              {/* Take a Nap / Sleep Option */}
              <div
                onClick={handleToggleSleep}
                style={{
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#000080";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#000000";
                }}
              >
                <span>{isSleeping ? "☀️" : "💤"}</span>
                <span>{isSleeping ? "Wake Up" : "Take a Nap"}</span>
              </div>

              <div style={{ height: "1px", background: "#808080", margin: "2px 0", borderBottom: "1px solid #fff" }} />

              {/* Mode Options: Pet / OS Tour / Extension Sim Tour */}
              <div
                onClick={() => {
                  setMenuOpen(false);
                  handleSwitchMode("pet");
                }}
                style={{
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#000080";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#000000";
                }}
              >
                <span>🐾</span>
                <span>Pet Companion Mode</span>
              </div>

              <div style={{ height: "1px", background: "#808080", margin: "2px 0", borderBottom: "1px solid #fff" }} />

              {/* Tutorial Sub-group */}
              <div style={{ padding: "3px 8px 1px 8px", fontSize: "10px", fontWeight: "bold", color: "#555555", fontFamily: SYS_FONT }}>
                Tutorial:
              </div>

              <div
                onClick={() => {
                  setMenuOpen(false);
                  handleSwitchTour("desktop");
                }}
                style={{
                  padding: "4px 8px 4px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#000080";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#000000";
                }}
              >
                <span>🌐</span>
                <span>General (14 Steps)</span>
              </div>

              <div
                onClick={() => {
                  setMenuOpen(false);
                  handleSwitchTour("extension");
                }}
                style={{
                  padding: "4px 8px 4px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#000080";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#000000";
                }}
              >
                <span>🛡️</span>
                <span>Extension (16 Steps)</span>
              </div>

              <div style={{ height: "1px", background: "#808080", margin: "2px 0", borderBottom: "1px solid #fff" }} />

              {/* Dismiss / Close Pop */}
              <div
                onClick={() => {
                  setMenuOpen(false);
                  onClose();
                }}
                style={{
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  color: "#991b1b",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#000080";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#991b1b";
                }}
              >
                <span>✕</span>
                <span>Hide Pop</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
    </>
  );
}
