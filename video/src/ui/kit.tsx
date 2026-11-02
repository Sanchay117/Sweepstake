import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { fonts, ink } from "../theme.ts";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 over `dur` frames starting at `at`, eased. */
export function ramp(frame: number, at: number, dur = 18, easing = easeOut) {
  return interpolate(frame, [at, at + dur], [0, 1], { ...clamp, easing });
}

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .3  0 0 0 0 .25  0 0 0 0 .2  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export type Tone = "night" | "paper" | "vermilion";

const GROUNDS: Record<Tone, { background: string; color: string; grain: number; blend: "screen" | "multiply"; edge: string }> = {
  night: {
    background: `radial-gradient(ellipse at 50% 42%, #33387a, ${ink.nasikDeep} 62%, #1d2050)`,
    color: ink.paperLight,
    grain: 0.14,
    blend: "screen",
    edge: "rgba(8,8,30,0.5)",
  },
  paper: {
    background: `radial-gradient(ellipse at 50% 42%, ${ink.tintDeep}, ${ink.tint} 55%, ${ink.paper})`,
    color: ink.nasikDeep,
    grain: 0.26,
    blend: "multiply",
    edge: "rgba(120,80,30,0.2)",
  },
  vermilion: {
    background: `radial-gradient(ellipse at 50% 42%, #cb5239, ${ink.vermilion} 58%, #952f1f)`,
    color: ink.paperLight,
    grain: 0.22,
    blend: "multiply",
    edge: "rgba(50,10,5,0.4)",
  },
};

/** A printed ground: ink or paper, film grain and a soft vignette. `still` holds the grain. */
export function Ground({ tone, still = false, children, style }: { tone: Tone; still?: boolean; children?: ReactNode; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const ground = GROUNDS[tone];
  const jitter = still ? 0 : Math.floor(frame / 2) % 4;
  return (
    <AbsoluteFill style={{ background: ground.background, color: ground.color, fontFamily: fonts.body, overflow: "hidden", ...style }}>
      {children}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backgroundImage: GRAIN,
          backgroundPosition: `${jitter * 37}px ${jitter * 53}px`,
          opacity: ground.grain,
          mixBlendMode: ground.blend,
        }}
      />
      <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at 50% 50%, transparent 58%, ${ground.edge} 100%)` }} />
    </AbsoluteFill>
  );
}

/** One part of the real bond, photographed off the website by scripts/capture.ts. */
export function Layer({ name, style }: { name: string; style?: CSSProperties }) {
  return <Img src={staticFile(`capture/layers/${name}.png`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }} />;
}

/** Comes down like the press: large and fast, a small bounce, and an ink echo thrown off the hit. */
export function Slam({ at, from = 1.55, children, style }: { at: number; from?: number; children: ReactNode; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  const drop = interpolate(t, [0, 3], [from, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const bounce = interpolate(t, [3, 5, 10], [1, 0.975, 1], clamp);
  const thrown = interpolate(t, [3, 12], [1, 1.14], { ...clamp, easing: Easing.out(Easing.quad) });
  const echo = interpolate(t, [3, 12], [0.4, 0], clamp);
  return (
    <span style={{ position: "relative", display: "inline-block", opacity: t < 0 ? 0 : 1, transform: `scale(${t < 3 ? drop : bounce})`, ...style }}>
      {t >= 3 && t < 12 && <span style={{ position: "absolute", inset: 0, opacity: echo, transform: `scale(${thrown})` }}>{children}</span>}
      {children}
    </span>
  );
}

/** Display type engraved like the wordmark: ruled lines, an outline and an offset shade. */
export function Hatch({
  children,
  size,
  line = ink.nasikDeep,
  gap = ink.paper,
  shade = ink.nasik,
  style,
}: {
  children: ReactNode;
  size: number;
  line?: string;
  gap?: string;
  shade?: string;
  style?: CSSProperties;
}) {
  const solid = Math.max(3, size * 0.05);
  const open = Math.max(2, size * 0.02);
  return (
    <span style={{ position: "relative", display: "inline-block", fontFamily: fonts.display, fontWeight: 900, fontSize: size, lineHeight: 1.08, letterSpacing: size * 0.008, whiteSpace: "nowrap", ...style }}>
      <span style={{ position: "absolute", left: size * 0.035, top: size * 0.045, color: shade, opacity: 0.6 }}>{children}</span>
      <span
        style={{
          position: "relative",
          display: "inline-block",
          color: "transparent",
          backgroundImage: `repeating-linear-gradient(177deg, ${line} 0 ${solid}px, ${gap} ${solid}px ${solid + open}px)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextStroke: `${Math.max(1.5, size * 0.01)}px ${line}`,
        }}
      >
        {children}
      </span>
    </span>
  );
}

const WORN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><filter id='r'><feTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='3' seed='11'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.15'/></filter><rect width='100%' height='100%' filter='url(%23r)'/></svg>\")";

/** A rubber stamp that hits the page at `at`, in worn vermilion ink. */
export function Stamp({ at, children, sub, size = 84, angle = -7, color = ink.vermilion, style }: { at: number; children: ReactNode; sub?: ReactNode; size?: number; angle?: number; color?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const drop = interpolate(t, [0, 4], [2.2, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const settle = interpolate(t, [4, 8, 12], [1, 0.97, 1], clamp);
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${size * 0.2}px ${size * 0.42}px ${size * 0.22}px`,
        border: `${Math.max(4, size * 0.075)}px solid ${color}`,
        borderRadius: size * 0.1,
        color,
        fontFamily: fonts.display,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: size * 0.02,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        transform: `rotate(${angle}deg) scale(${t < 4 ? drop : settle})`,
        maskImage: WORN,
        WebkitMaskImage: WORN,
        ...style,
      }}
    >
      <span>{children}</span>
      {sub && <span style={{ fontFamily: fonts.mono, fontWeight: 600, fontSize: size * 0.28, letterSpacing: size * 0.05, marginTop: size * 0.16 }}>{sub}</span>}
    </div>
  );
}

/** The small uppercase label the website uses over each section. */
export function Label({ children, color, size = 22, style }: { children: ReactNode; color?: string; size?: number; style?: CSSProperties }) {
  return <div style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: size, letterSpacing: size * 0.13, textTransform: "uppercase", color, ...style }}>{children}</div>;
}

/** Centres its children on the frame in a column. */
export function Middle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", ...style }}>{children}</AbsoluteFill>;
}

export const FRAME = { x: 240, y: 28, w: 1440, h: 810, bar: 40 };

/** A browser window with its page held in the 1440 × 810 area below the toolbar. */
export function BrowserFrame({ children, corners = 12 }: { children: ReactNode; corners?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: FRAME.x,
        top: FRAME.y,
        width: FRAME.w,
        height: FRAME.bar + FRAME.h,
        borderRadius: corners,
        overflow: "hidden",
        background: ink.paper,
        boxShadow: "0 40px 80px -30px rgba(5,5,25,0.8), 0 0 0 1px rgba(10,10,40,0.5)",
      }}
    >
      <div style={{ height: FRAME.bar, display: "flex", alignItems: "center", gap: 9, padding: "0 16px", background: ink.paperLight, borderBottom: `1px solid ${ink.tintDeep}` }}>
        {[ink.vermilion, ink.tintDeep, ink.nasik].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div style={{ marginLeft: 14, flex: 1, height: 26, borderRadius: 4, background: ink.paper, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", fontFamily: fonts.mono, fontSize: 15, color: ink.nasikDeep }}>
          <span>localhost:5198</span>
          <span style={{ color: ink.vermilion }}>live Portaldot V3 testnet, stand-in wallet</span>
        </div>
      </div>
      <div style={{ position: "relative", width: FRAME.w, height: FRAME.h, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
