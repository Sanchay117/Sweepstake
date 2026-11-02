import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fonts, ink } from "../theme.ts";
import { clamp } from "./kit.tsx";

const TAU = Math.PI * 2;

/** The engraved waves from the website (web/src/guilloche.js), redrawn each frame so they can move. */
export function Waves({ color = ink.tint, alpha = 0.16, phase = 0, step = 11, swell = 20, weight = 0.8 }: { color?: string; alpha?: number; phase?: number; step?: number; swell?: number; weight?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = weight;
    for (let row = -4; row * step < height + 60; row += 1) {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 5) {
        const y = row * step + swell * Math.sin(x / 108 + row * 0.13 + phase) * Math.cos(row * 0.05) + 6 * Math.sin(x / 37 + row * 0.3 - phase * 1.6);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [alpha, color, height, phase, step, swell, weight, width]);
  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0 }} />;
}

interface RosetteProps {
  size: number;
  petals?: number;
  rings?: number;
  depth?: number;
  turns?: number;
  inner?: number;
  color?: string;
  weight?: number;
  /** 0 to 1: how much of the figure has been cut so far. */
  reveal?: number;
  style?: CSSProperties;
}

/** A rosette: rings of one curve, each turned a little, as a geometric lathe cuts them. */
export function Rosette({ size, petals = 12, rings = 24, depth = 0.3, turns = 1, inner = 0.42, color = ink.nasik, weight = 1, reveal = 1, style }: RosetteProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    const c = size / 2;
    const radius = c - 2;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    const steps = 520;
    const cut = reveal * rings;
    for (let i = 0; i < Math.ceil(cut); i += 1) {
      const shift = (i / rings) * (TAU / petals) * turns;
      const ring = radius * (inner + ((1 - inner) * i) / Math.max(1, rings - 1));
      const share = Math.min(1, cut - i);
      ctx.beginPath();
      for (let k = 0; k <= steps * share; k += 1) {
        const a = (k / steps) * TAU;
        const r = ring * (1 - depth + depth * Math.cos(petals * a + shift * petals));
        const x = c + r * Math.cos(a);
        const y = c + r * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [color, depth, inner, petals, reveal, rings, size, turns, weight]);
  return <canvas ref={ref} width={size} height={size} style={{ position: "absolute", ...style }} />;
}

const DIGITS = "01234567890";

/** One digit of a numbering machine. `position` is how far the wheel has turned, in digits. */
function Wheel({ position, size, face, digit }: { position: number; size: number; face: string; digit: string }) {
  const high = size * 1.26;
  const at = ((position % 10) + 10) % 10;
  return (
    <div
      style={{
        position: "relative",
        width: size * 0.76,
        height: high,
        overflow: "hidden",
        borderRadius: size * 0.05,
        background: face,
        boxShadow: `inset 0 0 0 ${size * 0.012}px rgba(29,27,32,0.5), 0 ${size * 0.02}px ${size * 0.06}px rgba(5,5,25,0.45)`,
      }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${-at * high}px)` }}>
        {[...DIGITS].map((d, i) => (
          <div key={i} style={{ height: high, display: "grid", placeItems: "center", fontFamily: fonts.display, fontWeight: 900, fontSize: size, lineHeight: 1, color: digit }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(29,27,32,0.62), rgba(29,27,32,0) 26%, rgba(255,250,235,0.1) 50%, rgba(29,27,32,0) 74%, rgba(29,27,32,0.66))" }} />
    </div>
  );
}

/**
 * Brass numbering wheels that turn from one number to another. Each wheel stops at its own frame
 * in `stops`, and each step is a quick ratchet followed by a rest, so they slow down in clicks.
 */
export function Wheels({ from, to, start, stops, size, turns = 2, face = ink.paperLight, digit = ink.nasikDeep, style }: { from: string; to: string; start: number; stops: number[]; size: number; turns?: number; face?: string; digit?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: size * 0.05, justifyContent: "center", ...style }}>
      {[...to].map((char, i) => {
        const first = Number(from[i]);
        const last = Number(char) + 10 * (turns + i);
        const progress = interpolate(frame, [start, stops[i]], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.3, 1) });
        const turned = first + (last - first) * progress;
        const whole = Math.floor(turned);
        const stepped = whole + Math.min(1, (turned - whole) * 2.4);
        return <Wheel key={i} position={stepped} size={size} face={face} digit={digit} />;
      })}
    </div>
  );
}
