import { useEffect, useRef } from 'react';

/*
  PixelGrid — the hero's living grid. Invisible at rest (no lines, nothing drawn).
  Tiny sharp deep-pink pixels: a few pop on their own each second, and while the
  cursor is over the hero they keep popping around it (continuous emission, not a
  one-shot that disappears). White-bg only.
*/

const CELL = 10;            // px per cell — small + sharp
const GAP = 2;              // thin gap (integer offset keeps squares crisp)
const PINK = [219, 39, 119]; // deep pink (#DB2777)
const DECAY = 0.94;         // per-frame fade
const HOVER_RADIUS = 40;    // px around the cursor
const SCATTER_P = 0.12;     // per-frame spawn probability near the cursor
const AUTO_PER_SEC = 12;    // ambient pops per second
const MAX_ALPHA = 0.85;

export function PixelGrid({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const el = canvas;
    const g = ctx;
    const parent = el.parentElement!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cols = 0, rows = 0, cssW = 0, cssH = 0;
    let intensity = new Float32Array(0);
    const mouse = { x: -999, y: -999, present: false };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = Math.max(1, parent.clientWidth);
      cssH = Math.max(1, parent.clientHeight);
      cols = Math.ceil(cssW / CELL) + 1;
      rows = Math.ceil(cssH / CELL) + 1;
      el.width = Math.round(cssW * dpr);
      el.height = Math.round(cssH * dpr);
      el.style.width = cssW + 'px';
      el.style.height = cssH + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      intensity = new Float32Array(cols * rows);
    }

    function scatterAt(px: number, py: number) {
      const ccx = Math.floor(px / CELL);
      const ccy = Math.floor(py / CELL);
      const R = Math.ceil(HOVER_RADIUS / CELL);
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = ccx + dx, y = ccy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const dist = Math.hypot(dx * CELL, dy * CELL);
          if (dist > HOVER_RADIUS) continue;
          if (Math.random() < SCATTER_P * (1 - dist / HOVER_RADIUS)) {
            intensity[y * cols + x] = 0.7 + Math.random() * 0.3;
          }
        }
      }
    }

    function onMove(e: PointerEvent) {
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      mouse.x = px;
      mouse.y = py;
      mouse.present = px >= 0 && py >= 0 && px <= cssW && py <= cssH;
    }
    const onLeave = () => { mouse.present = false; };

    let raf = 0;
    let last = performance.now();
    function frame(t: number) {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      // ambient pops
      let pops = AUTO_PER_SEC * dt;
      let n = Math.floor(pops) + (Math.random() < pops % 1 ? 1 : 0);
      while (n-- > 0) intensity[(Math.random() * intensity.length) | 0] = 0.8 + Math.random() * 0.2;

      // keep popping around the cursor while it's present
      if (mouse.present) scatterAt(mouse.x, mouse.y);

      g.clearRect(0, 0, cssW, cssH);
      const size = CELL - GAP;
      const off = GAP / 2;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x;
          const v = intensity[idx];
          if (v <= 0.02) continue;
          intensity[idx] = v * DECAY;
          g.fillStyle = `rgba(${PINK[0]},${PINK[1]},${PINK[2]},${v * MAX_ALPHA})`;
          g.fillRect(x * CELL + off, y * CELL + off, size, size);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('blur', onLeave);

    if (reduce) {
      for (let i = 0; i < 30; i++) intensity[(Math.random() * intensity.length) | 0] = 0.7;
      const size = CELL - GAP, off = GAP / 2;
      g.clearRect(0, 0, cssW, cssH);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = intensity[y * cols + x];
        if (v <= 0.02) continue;
        g.fillStyle = `rgba(${PINK[0]},${PINK[1]},${PINK[2]},${v * MAX_ALPHA})`;
        g.fillRect(x * CELL + off, y * CELL + off, size, size);
      }
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
