import React, { useEffect, useRef } from "react";

export function ScreenSaver({
  type,
  onExit,
}: {
  type: string;
  onExit?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    if (type === "starfield") {
      const numStars = 250;
      const stars: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * width - width / 2,
          y: Math.random() * height - height / 2,
          z: Math.random() * width,
        });
      }

      const draw = () => {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "white";
        for (let i = 0; i < numStars; i++) {
          const s = stars[i];
          s.z -= 4;
          if (s.z <= 0) {
            s.z = width;
            s.x = Math.random() * width - width / 2;
            s.y = Math.random() * height - height / 2;
          }

          const k = 128.0 / s.z;
          const px = s.x * k + width / 2;
          const py = s.y * k + height / 2;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const size = Math.max(1, (1 - s.z / width) * 4);
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        animFrame = requestAnimationFrame(draw);
      };
      draw();
    } else if (type === "mystify") {
      const numPoints = 4;
      const points: { x: number; y: number; vx: number; vy: number }[] = [];
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
        });
      }

      const history: { x: number; y: number }[][] = [];
      const maxHistory = 15;
      let hue = 0;

      const draw = () => {
        ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
        ctx.fillRect(0, 0, width, height);

        const currentPoints: { x: number; y: number }[] = [];
        points.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x <= 0 || p.x >= width) p.vx *= -1;
          if (p.y <= 0 || p.y >= height) p.vy *= -1;

          currentPoints.push({ x: p.x, y: p.y });
        });

        history.push(currentPoints);
        if (history.length > maxHistory) {
          history.shift();
        }

        hue = (hue + 1) % 360;
        ctx.lineWidth = 2;

        history.forEach((pts, step) => {
          ctx.strokeStyle = `hsla(${(hue + step * 8) % 360}, 100%, 50%, ${step / maxHistory})`;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.lineTo(pts[0].x, pts[0].y);
          ctx.stroke();
        });

        animFrame = requestAnimationFrame(draw);
      };
      draw();
    } else if (type === "windows") {
      const numWindows = 25;
      const items: { x: number; y: number; z: number; color: string; rot: number; rotSpeed: number }[] = [];
      const colors = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4"];
      for (let i = 0; i < numWindows; i++) {
        items.push({
          x: Math.random() * width - width / 2,
          y: Math.random() * height - height / 2,
          z: Math.random() * width,
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.04,
        });
      }

      const draw = () => {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        items.forEach((item) => {
          item.z -= 3;
          item.rot += item.rotSpeed;
          if (item.z <= 0) {
            item.z = width;
            item.x = Math.random() * width - width / 2;
            item.y = Math.random() * height - height / 2;
          }

          const k = 128.0 / item.z;
          const px = item.x * k + width / 2;
          const py = item.y * k + height / 2;
          const size = (1 - item.z / width) * 28;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(item.rot);
            ctx.fillStyle = item.color;
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.strokeRect(-size / 2, -size / 2, size, size);
            ctx.restore();
          }
        });

        animFrame = requestAnimationFrame(draw);
      };
      draw();
    }

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, [type]);

  // Dismiss on any keyboard or click event
  useEffect(() => {
    const handleDismiss = () => {
      if (onExit) onExit();
    };

    const timer = setTimeout(() => {
      window.addEventListener("keydown", handleDismiss);
      window.addEventListener("mousedown", handleDismiss);
      window.addEventListener("mousemove", handleDismiss);
    }, 400);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleDismiss);
      window.removeEventListener("mousedown", handleDismiss);
      window.removeEventListener("mousemove", handleDismiss);
    };
  }, [onExit]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000",
        zIndex: 9999999,
        cursor: "none",
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <div
        style={{
          position: "fixed",
          bottom: "16px",
          right: "20px",
          color: "rgba(255, 255, 255, 0.4)",
          fontFamily: "'Pixelify Sans', monospace",
          fontSize: "12px",
          pointerEvents: "none",
        }}
      >
        Press any key to exit screen saver
      </div>
    </div>
  );
}
