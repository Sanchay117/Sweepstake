import { interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { Waves } from "../ui/engraving.tsx";
import { clamp, Ground, Hatch, Label, ramp, Slam, Stamp } from "../ui/kit.tsx";
import { LoopedSfx, Sfx } from "../ui/Sfx.tsx";

// Real output, copied from `npm run rehearse`, `forge test` and `npm test`.
const REHEARSE = [
  "vault 0x88b07a7098f3162d8b95a7a42aab5272177e2ae0",
  "PASS  pool pays 100% commission to the vault",
  "PASS  the pool has no root and no bouncer",
  "PASS  the operator can no longer redirect the commission",
  "PASS  a stranger moved all 5 tPOT of rewards into the vault",
  "PASS  the ticket rebuilt off chain matches the contract",
  "PASS  the winner's native account was paid by the Solidity contract",
  "PASS  Cleo's principal is unchanged after the draw",
  "PASS  Ben left using only the native pallet",
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
        const pass = line.startsWith("PASS");
        return (
          <div key={line} style={{ color: ink.tint, whiteSpace: "pre" }}>
            {pass ? (
              <>
                <span style={{ color: "#8fd0a0", fontWeight: 600 }}>PASS</span>
                {line.slice(4)}
              </>
            ) : (
              line
            )}
          </div>
        );
      })}
    </>
  );
}

export function Proof({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const fork = cue(shot, "fork");
  const thirty = cue(shot, "thirty");
  const tests = cue(shot, "tests");
  const fresh = cue(shot, "fresh");
  const entries: Entry[] = [
    { command: "npm run rehearse", lines: REHEARSE, at: 2, pace: 8 },
    { command: "forge test", lines: FORGE, at: thirty - 10, pace: 4 },
    { command: "npm test", lines: NODE, at: thirty + 8, pace: 4 },
  ];
  const tag = ramp(frame, fork, 12);
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
            Fork of the live chain
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
      <LoopedSfx name="typing" from={thirty - 10} frames={22} volume={0.16} />
      <Sfx name="press" at={tests} volume={0.5} />
      <Sfx name="stamp" at={fresh} volume={0.6} />
    </Ground>
  );
}
