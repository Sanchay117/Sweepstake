import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { said, type Plan } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { Rosette, Waves, Wheels } from "../ui/engraving.tsx";
import { BrowserFrame, clamp, easeInOut, Ground, Hatch, Label, Layer, Middle, ramp, Slam, Stamp } from "../ui/kit.tsx";
import { LoopedSfx, Sfx } from "../ui/Sfx.tsx";

// The whole teaser is one timeline on the score's grid: 120 BPM at 30 fps is a beat every 15 frames
// and a bar every 60. Frames here are film frames, and scripts/music.ts places the same hits.
export const DROP = 600;
const PRINT = 810;
const STRIKE = 900;
const PULL_BACK = 936;
/** Where the new scene's crossfade begins, by which time the picture must match the hero footage. */
const MATCHED = 948;

const range = (from: number, to: number, step: number) => Array.from({ length: Math.ceil((to - from) / step) }, (_, i) => from + i * step);
const PRESSES = [...range(0, 240, 60), ...range(240, 480, 30), ...range(480, STRIKE + 1, 15)];

const NIGHT = { line: ink.paperLight, gap: "#3b407f", shade: "#14153c" };
const PAPER = { line: ink.nasikDeep, gap: ink.paper, shade: ink.nasik };
const RED = { line: ink.vermilion, gap: ink.paper, shade: ink.nasik };
const FIRE = { line: ink.paperLight, gap: "#a63a27", shade: "#5a1a10" };

/** How hard the last strike of the press is still ringing, 1 on the hit and falling fast. */
function ringing(frame: number) {
  const last = PRESSES.filter((p) => p <= frame).at(-1) ?? 0;
  return { last, k: Math.exp(-(frame - last) / 3.2) };
}

function jolt(frame: number, power: number) {
  const { last, k } = ringing(frame);
  const a = random(`strike ${last}`) * Math.PI * 2;
  return `translate(${power * k * Math.cos(a)}px, ${power * k * Math.sin(a)}px) scale(${1 + 0.014 * k})`;
}

/** Everything on screen takes the press's hit, and drifts slowly toward the viewer between hits. */
function Struck({ children, from }: { children: ReactNode; from: number }) {
  const frame = useCurrentFrame();
  const power = frame < 240 ? 5 : frame < 480 ? 7 : frame < DROP ? 9 : 13;
  const drift = 1 + (frame - from) * 0.0007;
  return <AbsoluteFill style={{ transform: `${jolt(frame, power)} scale(${drift})` }}>{children}</AbsoluteFill>;
}

/** A line of script that writes itself on from the left. */
function Written({ share, children, style }: { share: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: fonts.script, whiteSpace: "nowrap", opacity: share > 0 ? 1 : 0, clipPath: `inset(-30% ${(1 - share) * 100}% -30% -2%)`, ...style }}>{children}</div>
  );
}

function Year({ plan }: { plan: Plan }) {
  const frame = useCurrentFrame();
  const write = ramp(frame, said(plan, "t-1956", "strange") - 8, 22, easeInOut);
  return (
    <Ground tone="night">
      <Waves alpha={0.2 * ramp(frame, 0, 24)} phase={frame * 0.012} />
      <Struck from={0}>
        <Middle>
          <Wheels from="0000" to="1956" start={8} stops={[38, 45, 52, 60]} size={320} />
          <div style={{ marginTop: 34 }}>
            <Slam at={said(plan, "t-1956", "britain")} from={1.3}>
              <Hatch size={104} {...NIGHT} style={{ letterSpacing: 16 }}>
                BRITAIN
              </Hatch>
            </Slam>
          </div>
          <Written share={write} style={{ marginTop: 18, fontSize: 62, color: ink.paper }}>
            made savers a strange offer
          </Written>
        </Middle>
      </Struck>
    </Ground>
  );
}

function Keep({ plan }: { plan: Plan }) {
  const frame = useCurrentFrame();
  return (
    <Ground tone="night">
      <Waves alpha={0.15} phase={0.9 + frame * 0.012} />
      <Struck from={120}>
        <Middle>
          <div style={{ display: "flex", gap: 56 }}>
            <Slam at={said(plan, "t-offer", "keep")}>
              <Hatch size={222} {...NIGHT}>
                KEEP
              </Hatch>
            </Slam>
            <Slam at={said(plan, "t-offer", "your")}>
              <Hatch size={222} {...NIGHT}>
                YOUR
              </Hatch>
            </Slam>
          </div>
          <Slam at={said(plan, "t-offer", "money")}>
            <Hatch size={330} {...NIGHT}>
              MONEY.
            </Hatch>
          </Slam>
        </Middle>
      </Struck>
    </Ground>
  );
}

function Risk({ plan }: { plan: Plan }) {
  const risk = said(plan, "t-offer", "risk");
  return (
    <Ground tone="paper">
      <Struck from={risk}>
        <Middle>
          <div style={{ display: "flex", gap: 40 }}>
            <Slam at={risk}>
              <Hatch size={156} {...PAPER}>
                RISK
              </Hatch>
            </Slam>
            <Slam at={said(plan, "t-offer", "only")}>
              <Hatch size={156} {...PAPER}>
                ONLY
              </Hatch>
            </Slam>
            <Slam at={said(plan, "t-offer", "the")}>
              <Hatch size={156} {...PAPER}>
                THE
              </Hatch>
            </Slam>
          </div>
          <Slam at={said(plan, "t-offer", "interest")}>
            <Hatch size={240} {...RED}>
              INTEREST.
            </Hatch>
          </Slam>
        </Middle>
      </Struck>
    </Ground>
  );
}

/** A cloakroom ticket, with a perforated stub and two notches cut from its edges. */
function Ticket({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const stub = 240;
  const notches = `radial-gradient(circle at ${stub}px 0, transparent 30px, #000 31px), radial-gradient(circle at ${stub}px 100%, transparent 30px, #000 31px)`;
  return (
    <div
      style={{
        position: "relative",
        width: 1600,
        height: 560,
        background: ink.paperLight,
        boxShadow: "0 40px 70px -30px rgba(5,5,25,0.8)",
        maskImage: notches,
        WebkitMaskImage: notches,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: stub, top: 0, bottom: 0, borderLeft: `5px dotted ${ink.tintDeep}` }} />
      <div style={{ position: "absolute", left: 0, width: stub, top: 0, bottom: 0, display: "grid", placeItems: "center", color: ink.vermilion, fontFamily: fonts.mono, fontWeight: 600, fontSize: 34, letterSpacing: 6 }}>
        <span style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap" }}>No. 1956</span>
      </div>
      <div style={{ position: "absolute", left: stub, right: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

function Raffle({ plan }: { plan: Plan }) {
  const frame = useCurrentFrame();
  const STAMP = 330;
  const fall = interpolate(frame, [240, 247], [-900, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const landed = interpolate(frame, [247, 250, 256], [1, 0.98, 1], clamp);
  const write = ramp(frame, said(plan, "t-raffle", "squalid") - 12, 22, easeInOut);
  const fadeWords = interpolate(frame, [STAMP, STAMP + 2], [1, 0.09], clamp);
  const where = said(plan, "t-billion", "sits");
  return (
    <Ground tone="night">
      <Waves alpha={0.15} phase={2.1 + frame * 0.012} />
      <Struck from={240}>
        <Middle>
          <div style={{ position: "relative", transform: `translateY(${fall}px) scale(${landed}) rotate(-2.4deg)` }}>
            <Ticket>
              <div style={{ opacity: fadeWords, textAlign: "center" }}>
                <Written share={write} style={{ fontSize: 132, color: ink.nasikDeep, lineHeight: 1.3 }}>
                  &ldquo;a squalid raffle&rdquo;
                </Written>
                <Label color={ink.nasik} size={26} style={{ marginTop: 14, opacity: write }}>
                  Harold Wilson on Premium Bonds
                </Label>
              </div>
              <div style={{ position: "absolute", display: "grid", placeItems: "center", inset: 0 }}>
                <Stamp
                  at={STAMP}
                  size={132}
                  angle={-5}
                  sub={<span style={{ opacity: frame >= where ? 1 : 0 }}>in the draw, September 2026</span>}
                >
                  £137 billion
                </Stamp>
              </div>
            </Ticket>
          </div>
        </Middle>
      </Struck>
    </Ground>
  );
}

function India({ plan }: { plan: Plan }) {
  const frame = useCurrentFrame();
  const printed = said(plan, "t-india", "printed");
  const bond = said(plan, "t-india", "bond");
  const no = said(plan, "t-india", "no");
  const first = interpolate(frame, [printed, (printed + bond) / 2], [0, 1], clamp);
  const second = interpolate(frame, [(printed + bond) / 2, bond + 10], [0, 1], clamp);
  const rule = ramp(frame, no - 2, 14, easeInOut);
  return (
    <Ground tone="paper">
      <Rosette size={1500} petals={11} rings={30} depth={0.24} turns={2} inner={0.36} weight={1.2} style={{ left: 210, top: -210, opacity: 0.32, transform: `rotate(${frame * 0.16}deg)` }} />
      <Struck from={405}>
        <Middle>
          <Slam at={said(plan, "t-india", "india")} from={1.3}>
            <Hatch size={112} {...PAPER} style={{ letterSpacing: 10 }}>
              INDIA, 1964
            </Hatch>
          </Slam>
          <div style={{ position: "relative", marginTop: 34, color: ink.nasikDeep, fontSize: 80, lineHeight: 1.36 }}>
            <Written share={first}>No other interest will be</Written>
            <Written share={second}>payable on the Bond but</Written>
            <div style={{ position: "absolute", left: 34, top: 104, width: 590 * rule, height: 7, background: ink.vermilion }} />
          </div>
          <div style={{ marginTop: 6 }}>
            <Slam at={525} from={1.9}>
              <Hatch size={290} {...RED}>
                PRIZES
              </Hatch>
            </Slam>
          </div>
        </Middle>
      </Struck>
    </Ground>
  );
}

function Roll() {
  const frame = useCurrentFrame();
  const spin = interpolate(frame, [555, DROP], [0, 420], { ...clamp, easing: Easing.in(Easing.cubic) });
  const reveal = interpolate(frame, [555, 590], [0.12, 1], clamp);
  return (
    <Ground tone="night">
      <Rosette size={1360} petals={13} rings={34} depth={0.26} turns={2} inner={0.3} color={ink.tint} weight={1.2} reveal={reveal} style={{ left: 280, top: -140, opacity: 0.55, transform: `rotate(${spin}deg)` }} />
      <Struck from={555}>
        <Middle>
          <Wheels from="1964" to="2026" start={557} stops={[570, 577, 585, 594]} size={300} turns={1} />
        </Middle>
      </Struck>
    </Ground>
  );
}

/** The two lathe rosettes that keep turning behind the drop, kicked along by each press. */
function Turning({ color, opacity = 0.36 }: { color: string; opacity?: number }) {
  const frame = useCurrentFrame();
  const beats = (frame - DROP) / 15;
  const kicked = Math.floor(beats) + Easing.out(Easing.cubic)(beats - Math.floor(beats));
  return (
    <>
      <Rosette size={1000} petals={9} rings={24} depth={0.3} color={color} weight={1.3} style={{ left: -340, top: -300, opacity, transform: `rotate(${kicked * 14}deg)` }} />
      <Rosette size={1000} petals={9} rings={24} depth={0.3} color={color} weight={1.3} style={{ right: -340, bottom: -300, opacity, transform: `rotate(${-kicked * 14}deg)` }} />
    </>
  );
}

function Now() {
  return (
    <Ground tone="vermilion">
      <Turning color={ink.paper} />
      <Struck from={DROP}>
        <Middle>
          <Slam at={DROP} from={1.8}>
            <Hatch size={560} {...FIRE}>
              NOW
            </Hatch>
          </Slam>
        </Middle>
      </Struck>
    </Ground>
  );
}

function ItRuns() {
  return (
    <Ground tone="night">
      <Turning color={ink.tint} opacity={0.3} />
      <Struck from={630}>
        <Middle>
          <Hatch size={226} {...NIGHT}>
            IT RUNS ON
          </Hatch>
        </Middle>
      </Struck>
    </Ground>
  );
}

function Named() {
  const frame = useCurrentFrame();
  return (
    <Ground tone="paper">
      <Turning color={ink.nasik} opacity={0.3} />
      <Struck from={645}>
        <Middle>
          <Slam at={645} from={1.5}>
            <Hatch size={226} {...RED}>
              PORTALDOT
            </Hatch>
          </Slam>
          <Label color={ink.nasikDeep} size={40} style={{ marginTop: 22, opacity: frame >= 660 ? 1 : 0 }}>
            V3 testnet
          </Label>
        </Middle>
      </Struck>
    </Ground>
  );
}

function Stake() {
  return (
    <Ground tone="paper">
      <Waves color={ink.nasik} alpha={0.14} phase={4} />
      <Struck from={675}>
        <Middle>
          <Slam at={675}>
            <Hatch size={240} {...PAPER}>
              STAKE
            </Hatch>
          </Slam>
          <Slam at={690}>
            <Hatch size={420} {...RED}>
              POT.
            </Hatch>
          </Slam>
        </Middle>
      </Struck>
    </Ground>
  );
}

function Kept() {
  return (
    <Ground tone="night">
      <Waves alpha={0.16} phase={5} />
      <Struck from={720}>
        <Middle>
          <Slam at={720} from={1.7}>
            <Hatch size={316} {...NIGHT}>
              KEEP IT.
            </Hatch>
          </Slam>
        </Middle>
      </Struck>
    </Ground>
  );
}

const COLS = 32;
const ROWS = 16;
const PITCH = { x: 54, y: 36 };
const ORIGIN = { x: 960 - ((COLS - 1) * PITCH.x) / 2, y: 468 };
const WINNER = { col: 21, row: 8 };

/** Every member of a full set of pools as a dot: 32 members in 16 pools, and one winner. */
function Members({ dot, won, picked, flow = 0, ring = 0 }: { dot: string; won: string; picked: number; flow?: number; ring?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    const wx = ORIGIN.x + WINNER.col * PITCH.x;
    const wy = ORIGIN.y + WINNER.row * PITCH.y;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (col === WINNER.col && row === WINNER.row) continue;
        const x = ORIGIN.x + col * PITCH.x;
        const y = ORIGIN.y + row * PITCH.y;
        // Nearer members arrive first, so the yield visibly pours toward the winner.
        const reach = Math.hypot(col - WINNER.col, row - WINNER.row) / 24;
        const t = Math.min(1, Math.max(0, flow * 1.8 - reach * 0.8));
        const eased = t * t * (3 - 2 * t);
        ctx.fillStyle = dot;
        ctx.globalAlpha = (1 - picked * 0.5) * (1 - eased * 0.2);
        ctx.beginPath();
        ctx.arc(x + (wx - x) * eased, y + (wy - y) * eased, 8 - eased * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = won;
    ctx.beginPath();
    ctx.arc(wx, wy, 8 + picked * 18 + flow * 44, 0, Math.PI * 2);
    ctx.fill();
    if (ring > 0 && ring < 1) {
      ctx.strokeStyle = won;
      ctx.lineWidth = 5;
      ctx.globalAlpha = 1 - ring;
      ctx.beginPath();
      ctx.arc(wx, wy, 30 + ring * 120, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [dot, flow, height, picked, ring, won, width]);
  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0 }} />;
}

function One() {
  const frame = useCurrentFrame();
  const picked = ramp(frame, 765, 6);
  return (
    <Ground tone="vermilion">
      <Struck from={750}>
        <Members dot={ink.paperLight} won={ink.paperLight} picked={picked} ring={ramp(frame, 765, 14)} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 138, display: "flex", justifyContent: "center", gap: 44 }}>
          <Slam at={750} from={1.4}>
            <Hatch size={132} {...FIRE}>
              ONE MEMBER
            </Hatch>
          </Slam>
          <Slam at={765} from={1.4}>
            <Hatch size={132} {...FIRE}>
              WINS
            </Hatch>
          </Slam>
        </div>
      </Struck>
    </Ground>
  );
}

function Everyone() {
  const frame = useCurrentFrame();
  const flow = interpolate(frame, [780, PRINT - 2], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <Ground tone="paper">
      <Struck from={780}>
        <Members dot={ink.nasikDeep} won={ink.vermilion} picked={1} flow={flow} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 138, display: "flex", justifyContent: "center", gap: 44 }}>
          <Slam at={780} from={1.4}>
            <Hatch size={126} {...PAPER}>
              EVERYONE&rsquo;S
            </Hatch>
          </Slam>
          <Slam at={795} from={1.4}>
            <Hatch size={126} {...RED}>
              YIELD.
            </Hatch>
          </Slam>
        </div>
      </Struck>
    </Ground>
  );
}

/** One plate of the real bond, printed onto the sheet on a beat. */
function Plate({ name, at }: { name: string; at: number }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const scale = interpolate(t, [0, 3], [1.1, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return <Layer name={name} style={{ transform: `scale(${scale})` }} />;
}

/** A band of light crossing the sheet as the name is spoken. */
function Sheen({ at }: { at: number }) {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [at, at + 26], [-40, 140], { ...clamp, easing: easeInOut });
  return (
    <AbsoluteFill style={{ mixBlendMode: "soft-light", background: `linear-gradient(105deg, transparent ${x - 16}%, rgba(255,250,235,0.95) ${x}%, transparent ${x + 16}%)` }} />
  );
}

function Bond({ plan }: { plan: Plan }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [PULL_BACK, MATCHED], [4 / 3, 1], { ...clamp, easing: easeInOut });
  const power = frame >= STRIKE ? 22 : 10;
  const postmark = frame - STRIKE;
  const land = interpolate(postmark, [0, 4], [2.6, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Ground tone="night" still>
        <Waves alpha={0.15} phase={6} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: "960px 272px" }}>
        <BrowserFrame corners={scale > 1.01 ? 0 : 12}>
          <div style={{ position: "absolute", inset: 0, transform: jolt(frame, power) }}>
            <Plate name="print" at={PRINT} />
            <Plate name="wordmark" at={PRINT + 15} />
            <Plate name="issue" at={PRINT + 30} />
            <Plate name="serial" at={PRINT + 30} />
            <Plate name="plain" at={PRINT + 45} />
            <Plate name="promise" at={PRINT + 60} />
            <Plate name="fields" at={PRINT + 75} />
            <Plate name="foot" at={PRINT + 75} />
            {postmark >= 0 && <Layer name="postmark" style={{ transform: `scale(${land})`, transformOrigin: "78% 55%" }} />}
          </div>
          <Sheen at={said(plan, "t-name", "sweepstake")} />
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
}

/** A frame or two of bare paper on the biggest hits. */
function Flash({ at }: { at: number[] }) {
  const frame = useCurrentFrame();
  const o = Math.max(...at.map((f) => interpolate(frame, [f, f + 1, f + 5], [0, 0.95, 0], clamp)));
  return <AbsoluteFill style={{ background: ink.paperLight, opacity: o, pointerEvents: "none" }} />;
}

export function Teaser({ plan }: SceneProps) {
  const frame = useCurrentFrame();
  const risk = said(plan, "t-offer", "risk");
  const within = (from: number, to: number) => frame >= from && frame < to;
  return (
    <AbsoluteFill style={{ background: ink.press }}>
      {within(0, 120) && <Year plan={plan} />}
      {within(120, risk) && <Keep plan={plan} />}
      {within(risk, 240) && <Risk plan={plan} />}
      {within(240, 405) && <Raffle plan={plan} />}
      {within(405, 555) && <India plan={plan} />}
      {within(555, DROP) && <Roll />}
      {within(DROP, 630) && <Now />}
      {within(630, 645) && <ItRuns />}
      {within(645, 675) && <Named />}
      {within(675, 720) && <Stake />}
      {within(720, 750) && <Kept />}
      {within(750, 780) && <One />}
      {within(780, PRINT) && <Everyone />}
      {frame >= PRINT && <Bond plan={plan} />}
      <Flash at={[DROP, 645, STRIKE]} />
      <AbsoluteFill style={{ background: ink.press, opacity: interpolate(frame, [0, 10], [1, 0], clamp) }} />

      <LoopedSfx name="ratchet" from={8} frames={52} volume={0.1} />
      <Sfx name="paper" at={240} volume={0.5} />
      <Sfx name="stamp" at={330} volume={0.75} />
      <Sfx name="stamp" at={525} volume={0.5} />
      <LoopedSfx name="ratchet" from={557} frames={37} volume={0.14} />
      <Sfx name="stamp" at={STRIKE} volume={0.6} />
      <Sfx name="whoosh" at={PULL_BACK - 6} volume={0.3} />
    </AbsoluteFill>
  );
}
