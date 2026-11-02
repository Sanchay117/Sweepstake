import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { Waves } from "../ui/engraving.tsx";
import { clamp, Ground, Slam } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

const FLOOR = 850;
const LINTEL = { left: 150, top: 90, width: 1620, height: 136 };
const PILLAR = { width: 460, top: LINTEL.top + LINTEL.height };
const AT = [200, 730, 1260];

/** One column of the temple. It rises out of the floor when the narrator names it. */
function Pillar({ column, at, gone = -1, title, note }: { column: number; at: number; gone?: number; title: string; note: string }) {
  const frame = useCurrentFrame();
  const high = FLOOR - PILLAR.top;
  const rise = interpolate(frame, [at, at + 10], [high, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const fall = gone < 0 ? 0 : interpolate(frame, [gone, gone + 16], [0, high + 40], { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <div style={{ position: "absolute", left: AT[column], top: PILLAR.top, width: PILLAR.width, height: high, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${rise + fall}px)`,
          boxSizing: "border-box",
          padding: "0 34px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: ink.nasikDeep,
          backgroundColor: ink.paper,
          backgroundImage: `repeating-linear-gradient(90deg, rgba(63,68,137,0.2) 0 2px, transparent 2px 24px), linear-gradient(90deg, ${ink.tintDeep}, ${ink.paperLight} 50%, ${ink.tintDeep})`,
        }}
      >
        <div style={{ padding: "26px 22px 28px", background: ink.paperLight, boxShadow: `0 0 0 2px ${ink.nasikDeep}` }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 50, lineHeight: 1.08 }}>{title}</div>
          <div style={{ marginTop: 12, fontFamily: fonts.body, fontSize: 30, lineHeight: 1.25, color: ink.press }}>{note}</div>
        </div>
      </div>
    </div>
  );
}

export function Portaldot({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const native = cue(shot, "native");
  const ethereum = cue(shot, "ethereum");
  const solidity = cue(shot, "solidity");
  const take = cue(shot, "take");
  const stops = cue(shot, "stops");
  const fallen = stops + 14;

  // With the middle column gone, the lintel tips on its left column, hangs, and then drops.
  const tip = interpolate(frame, [take + 16, stops], [0, 6], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tilt = tip + interpolate(frame, [stops, fallen], [0, 9], { ...clamp, easing: Easing.in(Easing.quad) });
  const fall = interpolate(frame, [stops, fallen], [0, FLOOR - LINTEL.top - LINTEL.height - 110], { ...clamp, easing: Easing.in(Easing.quad) });
  const t = frame - fallen;
  const shake = t >= 0 ? 16 * Math.exp(-t / 5) * Math.sin(t * 2.6) : 0;

  return (
    <AbsoluteFill>
      <Ground tone="night">
        <Waves alpha={0.13} phase={2.6 + frame * 0.002} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${shake}px)` }}>
        <Pillar column={0} at={native} title="Native pools" note="pay the yield" />
        <Pillar column={1} at={ethereum} gone={take} title="Ethereum calls" note="run natively, from one wallet" />
        <Pillar column={2} at={solidity} title="Solidity on Revive" note="reads native income" />
        <div style={{ position: "absolute", left: 90, right: 90, top: FLOOR, height: 22, background: ink.paper, boxShadow: `0 8px 0 ${ink.vermilion}` }} />
        <div
          style={{
            position: "absolute",
            ...LINTEL,
            display: "grid",
            placeItems: "center",
            background: ink.paperLight,
            boxShadow: `0 0 0 2px ${ink.nasikDeep}, 0 0 0 8px ${ink.paperLight}, 0 0 0 10px ${ink.nasikDeep}`,
            transform: `translateY(${fall}px) rotate(${tilt}deg)`,
            transformOrigin: "16% 100%",
          }}
        >
          <Slam at={0} from={1.2}>
            <span style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 72, letterSpacing: 2, color: ink.nasikDeep }}>
              This needs <span style={{ color: ink.vermilion }}>Portaldot</span>
            </span>
          </Slam>
        </div>
      </div>
      <Sfx name="press" at={native} volume={0.5} />
      <Sfx name="press" at={ethereum} volume={0.5} />
      <Sfx name="press" at={solidity} volume={0.5} />
      <Sfx name="whoosh" at={take} volume={0.3} />
      <Sfx name="thud" at={fallen} volume={0.9} />
    </AbsoluteFill>
  );
}
