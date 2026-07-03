import { useEffect, useRef } from 'react';

/*
  PixelHero — the live, finely-pixelated blue sky.

  Fixes over v1: small crisp pixels (DPR-aware nearest-neighbour upscale, never
  blurry), a clearly visible flowing shimmer, and a strong cursor glow that
  reacts as the pointer moves. Cheap: a low-res buffer (~a few thousand cells)
  drawn once per frame, upscaled with smoothing OFF.
*/

const PIXEL = 5; // on-screen size of one pixel cell (CSS px)

const TOP = [21, 70, 200];
const MID = [47, 123, 240];
const LOW = [125, 182, 255];
const BOT = [214, 233, 255];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function sky(ny: number, out: number[]) {
  const t = Math.pow(ny, 0.9);
  if (t < 0.5) {
    const k = t / 0.5;
    out[0] = lerp(TOP[0], MID[0], k); out[1] = lerp(TOP[1], MID[1], k); out[2] = lerp(TOP[2], MID[2], k);
  } else if (t < 0.82) {
    const k = (t - 0.5) / 0.32;
    out[0] = lerp(MID[0], LOW[0], k); out[1] = lerp(MID[1], LOW[1], k); out[2] = lerp(MID[2], LOW[2], k);
  } else {
    const k = (t - 0.82) / 0.18;
    out[0] = lerp(LOW[0], BOT[0], k); out[1] = lerp(LOW[1], BOT[1], k); out[2] = lerp(LOW[2], BOT[2], k);
  }
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function PixelHero({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const el = canvas;
    const g = ctx;
    const parent = el.parentElement!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const buffer = document.createElement('canvas');
    const bctx = buffer.getContext('2d')!;

    let cols = 0, rows = 0, image: ImageData, dpr = 1;
    let twinkle = new Float32Array(0); // stable per-cell phase so it shimmers, not flickers

    // pointer in cell coords + eased strengths
    const m = { x: -999, y: -999, here: 0, hereT: 0 };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, parent.clientWidth);
      const h = Math.max(1, parent.clientHeight);
      cols = Math.ceil(w / PIXEL);
      rows = Math.ceil(h / PIXEL);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      buffer.width = cols;
      buffer.height = rows;
      image = bctx.createImageData(cols, rows);
      twinkle = new Float32Array(cols * rows);
      for (let i = 0; i < twinkle.length; i++) twinkle[i] = Math.random() * Math.PI * 2;
      g.imageSmoothingEnabled = false;
    }

    function onMove(e: PointerEvent) {
      const r = el.getBoundingClientRect();
      m.x = (e.clientX - r.left) / PIXEL;
      m.y = (e.clientY - r.top) / PIXEL;
      m.hereT = 1;
    }
    function onLeave() { m.hereT = 0; }

    const rgb = [0, 0, 0];

    function draw(time: number) {
      const t = time * 0.001;
      m.here += (m.hereT - m.here) * 0.08;
      m.hereT *= 0.96;

      const sig = Math.max(10, cols * 0.09); // glow radius in cells
      const two = 2 * sig * sig;
      const data = image.data;

      for (let cy = 0; cy < rows; cy++) {
        const ny = cy / (rows - 1 || 1);
        for (let cx = 0; cx < cols; cx++) {
          const idx = cy * cols + cx;
          sky(ny, rgb);

          // Flowing light — clearly visible diagonal bands drifting over time.
          const flow =
            Math.sin(cx * 0.06 + cy * 0.03 + t * 0.6) * 16 +
            Math.sin(cx * 0.018 - t * 0.35) * 12 +
            Math.sin(cy * 0.05 + t * 0.25) * 8;

          // Per-pixel shimmer so individual pixels feel alive.
          const tw = Math.sin(t * 1.6 + twinkle[idx]) * 6;

          // Cursor glow + bright core.
          let glow = 0;
          if (m.here > 0.001) {
            const dx = cx - m.x, dy = cy - m.y;
            glow = Math.exp(-(dx * dx + dy * dy) / two) * m.here * 120;
          }

          const lift = flow + tw + glow;
          const o = idx * 4;
          // quantise to ~5-step bands so the pixels read crisp, not as a smooth gradient
          data[o] = clamp(Math.round((rgb[0] + lift) / 5) * 5);
          data[o + 1] = clamp(Math.round((rgb[1] + lift + glow * 0.3) / 5) * 5);
          data[o + 2] = clamp(Math.round((rgb[2] + lift * 0.8 + glow * 0.6) / 5) * 5);
          data[o + 3] = 255;
        }
      }

      bctx.putImageData(image, 0, 0);
      g.drawImage(buffer, 0, 0, cols, rows, 0, 0, el.width, el.height);
    }

    let raf = 0;
    const loop = (time: number) => { draw(time); raf = requestAnimationFrame(loop); };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);

    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
