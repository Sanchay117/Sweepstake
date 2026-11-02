import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue, FPS, type Plan, type Shot } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { Waves } from "../ui/engraving.tsx";
import { BrowserFrame, clamp, easeInOut, Ground, Label, ramp } from "../ui/kit.tsx";
import { LoopedSfx, Sfx } from "../ui/Sfx.tsx";

interface Move {
  t: number;
  dur: number;
  z: number;
  x: number;
  y: number;
}

/** The camera over the whole take, in capture seconds, so scenes that share a take always agree. */
function moves(m: Record<string, number>): Move[] {
  return [
    // The bond: the chain's numbers, then the promise, then the whole sheet.
    { t: m.hero + 2.6, dur: 1.2, z: 1.34, x: 0.5, y: 0.627 },
    { t: m.hero + 7.1, dur: 1.4, z: 1.5, x: 0.5, y: 0.6 },
    { t: m.hero + 11.4, dur: 1.6, z: 1, x: 0.5, y: 0.5 },
    // The counter: the form, until the bond lands.
    { t: m.counter + 1.6, dur: 1.2, z: 1.3, x: 0.385, y: 0.4 },
    { t: m.bonded + 0.1, dur: 1.2, z: 1, x: 0.5, y: 0.5 },
    // The register: the table, once the page has arrived.
    { t: m.register + 4.1, dur: 1.2, z: 1.34, x: 0.375, y: 0.373 },
    // The draw opens on the whole page, then finds the button.
    { t: m.draw, dur: 0, z: 1, x: 0.5, y: 0.5 },
    { t: m.finish - 2.3, dur: 1.3, z: 1.34, x: 0.625, y: 0.4 },
    // Check it: down to the list as it fills, and back out before the page moves.
    { t: m.checking + 0.3, dur: 1.1, z: 1.34, x: 0.625, y: 0.58 },
    { t: m.exit - 1.2, dur: 1.1, z: 1, x: 0.5, y: 0.5 },
    // Leaving: the button, then the whole page for the receipt.
    { t: m.exit + 1.5, dur: 1.1, z: 1.34, x: 0.625, y: 0.42 },
    { t: m.unbond + 1.5, dur: 1.4, z: 1, x: 0.5, y: 0.5 },
  ];
}

function camera(seconds: number, list: Move[]) {
  let z = 1;
  let x = 0.5;
  let y = 0.5;
  for (const move of list) {
    const t = move.dur ? interpolate(seconds, [move.t, move.t + move.dur], [0, 1], { ...clamp, easing: easeInOut }) : seconds >= move.t ? 1 : 0;
    z += (move.z - z) * t;
    x += (move.x - x) * t;
    y += (move.y - y) * t;
  }
  const half = 0.5 / z;
  x = Math.min(1 - half, Math.max(half, x));
  y = Math.min(1 - half, Math.max(half, y));
  return `scale(${z}) translate(${(0.5 - x) * 100}%, ${(0.5 - y) * 100}%)`;
}

/** A box in the page's own 1600 × 900 pixels, so overlays can be read straight off a frame. */
const box = (left: number, top: number, width: number, height: number): CSSProperties => ({
  position: "absolute",
  left: `${left / 16}%`,
  top: `${top / 9}%`,
  width: `${width / 16}%`,
  height: `${height / 9}%`,
});

const STEPS: [string, string][] = [
  ["hero", "The bond"],
  ["counter", "The counter"],
  ["register", "The register"],
  ["draw", "The draw"],
  ["check", "Check it"],
  ["exit", "Leaving"],
];

/** The six stops on the walk through the site, in the margin beside the window. */
function Rail({ active }: { active: string }) {
  return (
    <div style={{ position: "absolute", left: 34, top: 0, height: 878, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
      {STEPS.map(([id, name]) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, opacity: id === active ? 1 : 0.42 }}>
          <span style={{ width: 16, height: 4, background: id === active ? ink.vermilion : ink.tint }} />
          <Label color={ink.paperLight} size={15} style={{ letterSpacing: 1.6, whiteSpace: "nowrap" }}>
            {name}
          </Label>
        </div>
      ))}
    </div>
  );
}

function Filmed({ plan, shot, children, above }: { plan: Plan; shot: Shot; children?: ReactNode; above?: ReactNode }) {
  const frame = useCurrentFrame();
  const m = plan.capture.marks;
  const start = m[shot.id];
  return (
    <AbsoluteFill>
      <Ground tone="night" still>
        <Waves alpha={0.15} phase={6} />
      </Ground>
      <Rail active={shot.id} />
      <BrowserFrame>
        <div style={{ position: "absolute", inset: 0, transform: camera(start + frame / FPS, moves(m)) }}>
          <OffthreadVideo src={staticFile("capture/site.mp4")} trimBefore={Math.round(start * FPS)} muted style={{ display: "block", width: "100%", height: "100%" }} />
          {children}
        </div>
        {above}
      </BrowserFrame>
    </AbsoluteFill>
  );
}

/** Frame of the scene at which the footage reaches a capture mark. */
const atMark = (plan: Plan, shot: Shot, mark: string) => (plan.capture.marks[mark] - plan.capture.marks[shot.id]) * FPS;

export function Hero({ shot, plan }: SceneProps) {
  const frame = useCurrentFrame();
  const rule = ramp(frame, cue(shot, "read"), 26, easeInOut);
  const gone = 1 - ramp(frame, cue(shot, "and"), 12);
  return (
    <Filmed plan={plan} shot={shot}>
      <div style={{ ...box(400, 723, 800 * rule, 4), background: ink.vermilion, opacity: gone }} />
    </Filmed>
  );
}

/** A note pinned over the window, for what a recording of the page cannot show. */
function Note({ at, until, title, children }: { at: number; until: number; title: string; children: ReactNode }) {
  const frame = useCurrentFrame();
  const o = ramp(frame, at, 12) * (1 - ramp(frame, until, 10));
  return (
    <div
      style={{
        position: "absolute",
        right: 22,
        top: 22,
        width: 560,
        padding: "16px 20px 18px",
        background: ink.paperLight,
        border: `2px solid ${ink.nasikDeep}`,
        boxShadow: `0 0 0 4px ${ink.paperLight}, 0 0 0 5px ${ink.nasikDeep}`,
        opacity: o,
        transform: `translateY(${(1 - o) * 12}px)`,
      }}
    >
      <Label color={ink.vermilion} size={15}>
        {title}
      </Label>
      <div style={{ marginTop: 10, fontFamily: fonts.mono, fontSize: 21, lineHeight: 1.5, color: ink.press }}>{children}</div>
    </div>
  );
}

export function Counter({ shot, plan }: SceneProps) {
  const connected = atMark(plan, shot, "connected");
  const bond = atMark(plan, shot, "bond");
  const bonded = atMark(plan, shot, "bonded");
  return (
    <Filmed
      plan={plan}
      shot={shot}
      above={
        <Note at={cue(shot, "your")} until={cue(shot, "call") + 90} title="One Ethereum transaction">
          <div>
            to <span style={{ color: ink.nasik }}>0x6d6f...0000</span>, the pallets address
          </div>
          <div>
            runs <span style={{ color: ink.nasik }}>nominationPools.join</span>
          </div>
        </Note>
      }
    >
      <Sfx name="tick" at={connected - 5} volume={0.5} />
      <LoopedSfx name="typing" from={bond - 50} frames={16} volume={0.2} />
      <Sfx name="tick" at={bond - 5} volume={0.5} />
      <Sfx name="stamp" at={bonded} volume={0.45} />
    </Filmed>
  );
}

export function Register({ shot, plan }: SceneProps) {
  const frame = useCurrentFrame();
  const mark = ramp(frame, 150, 14);
  return (
    <Filmed plan={plan} shot={shot}>
      <div style={{ ...box(244, 304, 522, 33), border: `3px solid ${ink.vermilion}`, borderRadius: 3, opacity: mark, boxSizing: "border-box" }} />
    </Filmed>
  );
}

const BLOCK = 58;
const SPACE = 14;

/** Commit, five blocks, a hash nobody could know, a ticket: played out in the page's empty corner. */
function Blocks({ shot }: { shot: Shot }) {
  const frame = useCurrentFrame();
  const commit = cue(shot, "commits");
  const five = cue(shot, "five");
  const hash = cue(shot, "hash");
  const picks = cue(shot, "picks");
  const away = cue(shot, "if");
  const shown = ramp(frame, commit - 10, 12) * (1 - ramp(frame, away, 12));
  const note = frame >= picks ? "picks the ticket" : frame >= hash ? "a hash nobody could know" : frame >= five ? "five blocks later" : "root committed";
  const slots = [
    { text: "root", at: commit, fill: ink.nasikDeep, face: ink.paperLight },
    ...[1, 2, 3, 4].map((n) => ({ text: String(n), at: five + (n - 1) * 7, fill: ink.tint, face: ink.nasikDeep })),
    { text: frame >= picks ? "5" : "?", at: five + 28, fill: ink.vermilion, face: ink.paperLight },
    { text: "ticket", at: picks, fill: ink.paperLight, face: ink.vermilion },
  ];
  return (
    <div style={{ ...box(252, 354, 510, 120), opacity: shown }}>
      <Label color={ink.nasik} size={13} style={{ letterSpacing: 1.6 }}>
        How a draw is decided
      </Label>
      <div style={{ display: "flex", gap: (SPACE * 1440) / 1600, marginTop: 8 }}>
        {slots.map((slot, i) => {
          const pop = ramp(frame, slot.at, 8);
          return (
            <div
              key={i}
              style={{
                width: (BLOCK * 1440) / 1600,
                height: (BLOCK * 1440) / 1600,
                display: "grid",
                placeItems: "center",
                boxSizing: "border-box",
                border: `2px solid ${pop > 0 ? (i === 6 ? ink.vermilion : ink.nasikDeep) : ink.tintDeep}`,
                background: pop > 0 ? slot.fill : "transparent",
                color: slot.face,
                fontFamily: fonts.mono,
                fontWeight: 600,
                fontSize: slot.text.length > 1 ? 13 : 24,
                transform: `scale(${1 + 0.16 * Math.sin(pop * Math.PI)})`,
              }}
            >
              {pop > 0 ? slot.text : ""}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontFamily: fonts.mono, fontWeight: 500, fontSize: 20, color: ink.press }}>{note}</div>
    </div>
  );
}

export function Draw({ shot, plan }: SceneProps) {
  const finish = atMark(plan, shot, "finish");
  const waiting = finish + 78;
  return (
    <Filmed
      plan={plan}
      shot={shot}
      above={
        <Note at={waiting} until={atMark(plan, shot, "paid") - 12} title="A real transaction">
          <div>
            to <span style={{ color: ink.nasik }}>PrizeVault</span>, runs <span style={{ color: ink.nasik }}>draw</span>
          </div>
          <div>waiting for the next block</div>
        </Note>
      }
    >
      <Blocks shot={shot} />
      <Sfx name="tick" at={finish - 5} volume={0.5} />
      <Sfx name="tick" at={waiting} volume={0.3} />
    </Filmed>
  );
}

// Each line of the check's receipt in the page's pixels, and the word that uncovers it. The browser
// finishes all four at once, so the film deals them out as the narrator reaches them.
const LINES = [
  { top: 480, height: 26, word: "rebuilds" },
  { top: 506, height: 62, word: "matches" },
  { top: 570, height: 42, word: "recomputes" },
  { top: 614, height: 62, word: "lands" },
];

export function Check({ shot, plan }: SceneProps) {
  const frame = useCurrentFrame();
  const checking = atMark(plan, shot, "checking");
  return (
    <Filmed plan={plan} shot={shot}>
      {LINES.map((line) => {
        const at = cue(shot, line.word);
        return (
          <div key={line.word}>
            {frame >= checking - 2 && <div style={{ ...box(838, line.top, 524, line.height), background: ink.paper, opacity: 1 - ramp(frame, at, 8) }} />}
            <Sfx name="tick" at={at} volume={0.45} />
          </div>
        );
      })}
      <Sfx name="stamp" at={0} volume={0.45} />
      <Sfx name="tick" at={checking - 5} volume={0.5} />
      <Sfx name="chime" at={cue(shot, "winner")} volume={0.32} />
    </Filmed>
  );
}

export function Exit({ shot, plan }: SceneProps) {
  return (
    <Filmed plan={plan} shot={shot}>
      <Sfx name="tick" at={atMark(plan, shot, "unbond") - 5} volume={0.5} />
      <Sfx name="stamp" at={atMark(plan, shot, "unbonded")} volume={0.4} />
    </Filmed>
  );
}
