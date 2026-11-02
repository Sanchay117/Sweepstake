import { interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { Waves } from "../ui/engraving.tsx";
import { clamp, Ground, Hatch, Label, ramp, Slam, Stamp } from "../ui/kit.tsx";
import { LoopedSfx, Sfx } from "../ui/Sfx.tsx";

// Real output from the live testnet, with hashes shortened, plus `forge test` and `npm test`.
const SETUP = [
  "vault 0x2C898e8E0511792A530AB7CFE6C7FC3FAa9C99aF",
  "Pool opened: 0x02a3...fbb3 in block 290908",
  "Commission set to 100%: 0x24ac...85b1 in block 290909",
  "Root role renounced: 0x4ed3...b9dc in block 290912",
];
const CRANK = [
  "prize now 5.0000 tPOT",
  "committed 3 members at block 290941: 0x7ae9...3141",
  "draw 1: ticket 11010863810202332 went to 0x44d1...2a50",
];
const CHECKS = [
  "block 291122: revive 0xda9c...1e7c eth 0xda9c...1e7c MATCH",
  "state at block 1 (291126 old): available",
];
const FORGE = ["21 tests passed, 0 failed, 0 skipped (21 total tests)"];
const NODE = ["tests 11   pass 11   fail 0"];

interface Entry {
  command: string;
  lines: string[];
  at: number;
  /** Frames between output lines. */
  pace: number;
}

function Run({ entry }: { entry: Entry }) {
  const frame = useCurrentFrame();
  const typed = Math.floor(interpolate(frame, [entry.at, entry.at + entry.command.length * 0.7], [0, entry.command.length], clamp));
  const first = entry.at + entry.command.length * 0.7 + 4;
  if (frame < entry.at) return null;
  return (
    <>
      <div style={{ color: ink.paperLight }}>
        <span style={{ color: ink.tint }}>$ </span>
        {entry.command.slice(0, typed)}
      </div>
      {entry.lines.map((line, i) => {
        if (frame < first + i * entry.pace) return null;
        return (
          <div key={line} style={{ color: ink.tint, whiteSpace: "pre" }}>
            {line}
          </div>
        );
      })}
    </>
  );
}

export function Proof({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const live = cue(shot, "live");
  const real = cue(shot, "real");
  const thirty = cue(shot, "thirty");
  const tests = cue(shot, "tests");
  const fresh = cue(shot, "fresh");
  const entries: Entry[] = [
    { command: "npm run setup", lines: SETUP, at: 2, pace: 8 },
    { command: "npm run crank", lines: CRANK, at: real - 20, pace: 10 },
    { command: "npm run live-checks", lines: CHECKS, at: thirty - 50, pace: 8 },
    { command: "forge test", lines: FORGE, at: thirty - 10, pace: 4 },
    { command: "npm test", lines: NODE, at: thirty + 8, pace: 4 },
  ];
  const tag = ramp(frame, live, 12);
  return (
    <Ground tone="night" still>
      <Waves alpha={0.13} phase={3.4} />
      <div style={{ position: "absolute", left: 70, top: 56, width: 1160, height: 800, background: ink.press, borderRadius: 10, overflow: "hidden", boxShadow: "0 40px 80px -30px rgba(5,5,25,0.8)" }}>
        <div style={{ height: 40, display: "flex", alignItems: "center", gap: 9, padding: "0 16px", background: "#2b2930" }}>
          {[ink.vermilion, ink.tintDeep, ink.nasik].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
          ))}
          <span style={{ marginLeft: 14, fontFamily: fonts.mono, fontSize: 16, color: ink.tint }}>Portaldot/sweepstake</span>
        </div>
        <div style={{ padding: "22px 26px", fontFamily: fonts.mono, fontSize: 25, lineHeight: 1.62 }}>
          {entries.map((entry) => (
            <Run key={entry.command} entry={entry} />
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", left: 1270, right: 60, top: 56, height: 800, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ opacity: tag, transform: `translateY(${(1 - tag) * 14}px)` }}>
          <Label color={ink.paper} size={20} style={{ letterSpacing: 2, lineHeight: 1.5 }}>
            Live V3 testnet
            <br />
            Stand-in wallet
          </Label>
        </div>
        <div style={{ marginTop: 40, minHeight: 300 }}>
          <Slam at={tests} from={1.7}>
            <Hatch size={210} line={ink.paperLight} gap="#3b407f" shade="#14153c">
              32
            </Hatch>
            <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 46, color: ink.paperLight }}>tests pass</div>
          </Slam>
        </div>
        <div style={{ minHeight: 180, display: "grid", placeItems: "center" }}>
          <Stamp at={fresh} size={46} angle={-6} color="#ec7a62" sub="every step reproduced">
            Fresh clone
          </Stamp>
        </div>
      </div>

      <LoopedSfx name="typing" from={2} frames={12} volume={0.16} />
      <LoopedSfx name="typing" from={real - 20} frames={12} volume={0.16} />
      <LoopedSfx name="typing" from={thirty - 50} frames={14} volume={0.16} />
      <LoopedSfx name="typing" from={thirty - 10} frames={22} volume={0.16} />
      <Sfx name="press" at={tests} volume={0.5} />
      <Sfx name="stamp" at={fresh} volume={0.6} />
    </Ground>
  );
}
