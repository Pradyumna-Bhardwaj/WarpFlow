import { useEffect, useRef } from "react";

const GRID_SPACING = 50;
const SEGMENTS_PER_LINE = 32;
const INFLUENCE_RADIUS = 280;
const DIP_STRENGTH = -115;
const SMOOTH = 0.15;
const STAR_COUNT = 520;

const PURPLE_HUE = 268;

const EVENT_HORIZON_RADIUS = 13;
const PHOTON_RING_RADIUS = 16;
const ACCRETION_RADIUS = 78;

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  hue: number;
}

function generateStars(w: number, h: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const isBright = Math.random() < 0.15;
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: isBright ? 1.2 + Math.random() * 1.3 : 0.4 + Math.random() * 0.8,
      brightness: isBright ? 0.6 + Math.random() * 0.4 : 0.15 + Math.random() * 0.3,
      hue: PURPLE_HUE + (Math.random() - 0.5) * 40,
    });
  }
  return stars;
}

export function WarpGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const target = { x: -9999, y: -9999, active: 0 };
    const current = { x: -9999, y: -9999, active: 0 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    let stars = generateStars(width, height);

    const onResize = () => {
      resize();
      stars = generateStars(width, height);
    };

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      target.active = 1;
    };
    const onLeave = () => {
      target.active = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("resize", onResize);

    let raf = 0;

    const draw = () => {
      current.x += (target.x - current.x) * SMOOTH;
      current.y += (target.y - current.y) * SMOOTH;
      current.active += (target.active - current.active) * 0.15;

      ctx.clearRect(0, 0, width, height);

      const radius = INFLUENCE_RADIUS;
      const radiusSq = radius * radius;
      const dipStrength = DIP_STRENGTH * current.active;

      const displace = (x: number, y: number): { x: number; y: number; weight: number } => {
        const dx = x - current.x;
        const dy = y - current.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > radiusSq) return { x, y, weight: 0 };
        const dist = Math.sqrt(distSq);
        const t = 1 - dist / radius;
        const falloff = t * t * t * (t * (t * 6 - 15) + 10);
        const normalizedDist = dist / radius;
        const warpCurve = Math.sin(normalizedDist * Math.PI * 0.5);
        const pull = dipStrength * falloff * warpCurve;
        const angle = Math.atan2(dy, dx);
        return {
          x: x + Math.cos(angle) * pull,
          y: y + Math.sin(angle) * pull,
          weight: falloff,
        };
      };

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]!;
        const p = displace(star.x, star.y);
        const dimming = 1 - p.weight * 0.7;
        const alpha = star.brightness * dimming;
        if (alpha < 0.02) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, star.size * (1 - p.weight * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, 60%, 80%, ${alpha})`;
        ctx.fill();
      }

      const cols = Math.ceil(width / GRID_SPACING) + 2;
      const rows = Math.ceil(height / GRID_SPACING) + 2;

      const offsetX = -GRID_SPACING;
      const offsetY = -GRID_SPACING;

      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const strokeSmooth = (pts: { x: number; y: number }[]) => {
        const first = pts[0];
        if (!first || pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        if (pts.length === 2) {
          const second = pts[1]!;
          ctx.lineTo(second.x, second.y);
        } else {
          for (let i = 1; i < pts.length - 1; i++) {
            const a = pts[i]!;
            const b = pts[i + 1]!;
            const mx = (a.x + b.x) * 0.5;
            const my = (a.y + b.y) * 0.5;
            ctx.quadraticCurveTo(a.x, a.y, mx, my);
          }
          const last = pts[pts.length - 1]!;
          ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();
      };

      const points: { x: number; y: number }[] = new Array(SEGMENTS_PER_LINE + 1);

      const pad = INFLUENCE_RADIUS;

      for (let r = 0; r < rows; r++) {
        const y0 = offsetY + r * GRID_SPACING;
        let maxWeight = 0;
        for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
          const x0 = -pad + (s / SEGMENTS_PER_LINE) * (width + pad * 2);
          const p = displace(x0, y0);
          points[s] = { x: p.x, y: p.y };
          if (p.weight > maxWeight) maxWeight = p.weight;
        }
        const baseAlpha = 0.08;
        const litAlpha = Math.min(0.6, baseAlpha + maxWeight * 0.55);
        const lightness = 70 - maxWeight * 15;
        ctx.strokeStyle = `hsla(${PURPLE_HUE}, 75%, ${lightness}%, ${litAlpha})`;
        ctx.lineWidth = Math.max(0.25, 1 - maxWeight * 0.55);
        strokeSmooth(points);
      }

      for (let c = 0; c < cols; c++) {
        const x0 = offsetX + c * GRID_SPACING;
        let maxWeight = 0;
        for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
          const y0 = -pad + (s / SEGMENTS_PER_LINE) * (height + pad * 2);
          const p = displace(x0, y0);
          points[s] = { x: p.x, y: p.y };
          if (p.weight > maxWeight) maxWeight = p.weight;
        }
        const baseAlpha = 0.08;
        const litAlpha = Math.min(0.6, baseAlpha + maxWeight * 0.55);
        const lightness = 70 - maxWeight * 15;
        ctx.strokeStyle = `hsla(${PURPLE_HUE}, 75%, ${lightness}%, ${litAlpha})`;
        ctx.lineWidth = Math.max(0.25, 1 - maxWeight * 0.55);
        strokeSmooth(points);
      }

      if (current.active > 0.01) {
        const cx = current.x;
        const cy = current.y;
        const a = current.active;

        // Outer gravitational halo — soft purple lensing aura that fades into space
        const haloRadius = INFLUENCE_RADIUS * 0.95;
        const halo = ctx.createRadialGradient(
          cx, cy, INFLUENCE_RADIUS * 0.25,
          cx, cy, haloRadius
        );
        halo.addColorStop(0, `hsla(${PURPLE_HUE}, 85%, 55%, ${0.10 * a})`);
        halo.addColorStop(0.55, `hsla(${PURPLE_HUE}, 80%, 50%, ${0.04 * a})`);
        halo.addColorStop(1, `hsla(${PURPLE_HUE}, 80%, 50%, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Depression shadow — sells the "weight pressing down" feel beyond the halo
        const shadowRadius = INFLUENCE_RADIUS * 0.55;
        const shadow = ctx.createRadialGradient(cx, cy, 0, cx, cy, shadowRadius);
        shadow.addColorStop(0, `rgba(0, 0, 0, ${0.45 * a})`);
        shadow.addColorStop(0.55, `rgba(0, 0, 0, ${0.18 * a})`);
        shadow.addColorStop(1, `rgba(0, 0, 0, 0)`);
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.arc(cx, cy, shadowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Accretion disk glow — hot inner ring of light orbiting the singularity
        const accretion = ctx.createRadialGradient(
          cx, cy, PHOTON_RING_RADIUS,
          cx, cy, ACCRETION_RADIUS
        );
        accretion.addColorStop(0, `hsla(${PURPLE_HUE + 25}, 100%, 78%, ${0.55 * a})`);
        accretion.addColorStop(0.35, `hsla(${PURPLE_HUE + 5}, 95%, 60%, ${0.30 * a})`);
        accretion.addColorStop(1, `hsla(${PURPLE_HUE}, 80%, 45%, 0)`);
        ctx.fillStyle = accretion;
        ctx.beginPath();
        ctx.arc(cx, cy, ACCRETION_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Photon ring — thin bright edge of light bending around the event horizon
        ctx.beginPath();
        ctx.arc(cx, cy, PHOTON_RING_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${PURPLE_HUE + 35}, 100%, 90%, ${0.9 * a})`;
        ctx.lineWidth = 1.4;
        ctx.shadowColor = `hsla(${PURPLE_HUE + 30}, 100%, 75%, ${0.8 * a})`;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Event horizon — pure black core where light cannot escape
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, EVENT_HORIZON_RADIUS);
        core.addColorStop(0, `rgba(0, 0, 0, ${0.98 * a})`);
        core.addColorStop(0.85, `rgba(0, 0, 0, ${0.95 * a})`);
        core.addColorStop(1, `rgba(0, 0, 0, 0)`);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, EVENT_HORIZON_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
