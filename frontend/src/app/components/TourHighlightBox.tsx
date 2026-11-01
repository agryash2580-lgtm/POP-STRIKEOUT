import React, { useState, useEffect } from "react";

export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  label?: string;
}

export function TourHighlightBox({
  targetSelector,
  label,
  stepNumber,
}: {
  targetSelector?: string | null;
  label?: string;
  stepNumber?: number;
}) {
  const [rect, setRect] = useState<HighlightRect | null>(null);

  useEffect(() => {
    if (!targetSelector) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(targetSelector);
      if (el) {
        const b = el.getBoundingClientRect();
        // Add a slight 4px padding around highlighted target
        setRect({
          top: Math.max(0, b.top - 4),
          left: Math.max(0, b.left - 4),
          width: b.width + 8,
          height: b.height + 8,
          label,
        });
      } else {
        setRect(null);
      }
    };

    updateRect();
    const interval = setInterval(updateRect, 300);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [targetSelector, label]);

  if (!rect) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: "2px solid #ef4444",
        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.35), 0 0 12px #ef4444",
        borderRadius: "4px",
        pointerEvents: "none",
        zIndex: 99980, // Sits directly below Pop and above all application windows
        animation: "pulse-border 1.8s infinite ease-in-out",
        transition: "all 0.4s cubic-bezier(0.2, 0.9, 0.3, 1)",
      }}
    >
      <style>{`
        @keyframes pulse-border {
          0%, 100% { outline: 2px solid rgba(239, 68, 68, 0.8); outline-offset: 2px; }
          50% { outline: 2px solid rgba(239, 68, 68, 0.2); outline-offset: 6px; }
        }
      `}</style>

      {/* Floating Spotlight Label Tag */}
      {rect.label && (
        <div
          style={{
            position: "absolute",
            top: "-26px",
            left: "0",
            background: "#ef4444",
            color: "#ffffff",
            padding: "2px 8px",
            fontSize: "11px",
            fontFamily: "'Pixelify Sans', 'VT323', monospace",
            fontWeight: "bold",
            borderRadius: "2px",
            whiteSpace: "nowrap",
            boxShadow: "2px 2px 0px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          {stepNumber !== undefined && (
            <span
              style={{
                background: "#ffffff",
                color: "#b91c1c",
                borderRadius: "50%",
                width: "14px",
                height: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
              }}
            >
              {stepNumber}
            </span>
          )}
          <span>{rect.label}</span>
        </div>
      )}
    </div>
  );
}
