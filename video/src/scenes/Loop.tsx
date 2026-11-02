import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { Rosette, Waves } from "../ui/engraving.tsx";
import { clamp, easeInOut, Ground, Label, ramp, Slam, Stamp } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

const CARD = { w: 300, h: 400, top: 240 };
const COLUMN = [105, 575, 1045, 1515];
const MIDDLE = CARD.top + CARD.h / 2;
const BOTTOM = CARD.top + CARD.h + 7;
const RETURN = 770;
const centre = (column: number) => COLUMN[column] + CARD.w / 2;

function Card({ column, at, petals, title, fade = 0, children }: { column: number; at: number; petals: number; title: string; fade?: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const pop = ramp(frame, at, 14);
  return (
    <div
      style={{
        position: "absolute",
        left: COLUMN[column],
        top: CARD.top,
        width: CARD.w,
        height: CARD.h,
        boxSizing: "border-box",
        padding: "160px 16px 0",
        background: ink.paperLight,
        border: `2px solid ${ink.nasikDeep}`,
        boxShadow: `0 0 0 5px ${ink.paperLight}, 0 0 0 6px ${ink.nasikDeep}`,
        textAlign: "center",
        color: ink.nasikDeep,
        opacity: pop,
        transform: `translateY(${(1 - pop) * 26}px)`,
      }}
    >
      <Rosette size={142} petals={petals} rings={16} depth={0.3} weight={0.8} reveal={ramp(frame, at, 30, easeInOut)} style={{ left: (CARD.w - 146) / 2, top: 12, opacity: 1 - fade * 0.7, transform: `rotate(${frame * 0.3}deg)` }} />
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 36, lineHeight: 1.08 }}>{title}</div>
      <div style={{ marginTop: 10, fontFamily: fonts.body, fontSize: 25, lineHeight: 1.26, color: ink.press }}>{children}</div>
    </div>
  );
}

/** A rule between two cards, with tokens running along it once it opens. */
function Run({ column, at, stop = Infinity, label }: { column: number; at: number; stop?: number; label?: ReactNode }) {
  const frame = useCurrentFrame();
  const left = COLUMN[column] + CARD.w + 10;
  const width = COLUMN[column + 1] - left - 10;
  const open = ramp(frame, at, 16, easeInOut);
  const running = frame < stop ? 1 : 1 - ramp(frame, stop, 10);
  const tokens = [0, 1, 2].map((i) => ((frame - at) / 42 + i / 3) % 1);
  return (
    <div style={{ position: "absolute", left, top: MIDDLE, width, height: 0 }}>
      <div style={{ position: "absolute", left: 0, top: -2, width: width * open, height: 4, background: ink.nasikDeep }} />
      <div
        style={{
          position: "absolute",
          left: width * open - 2,
          top: -9,
          width: 0,
          height: 0,
          opacity: open,
          borderTop: "9px solid transparent",
          borderBottom: "9px solid transparent",
          borderLeft: `14px solid ${ink.nasikDeep}`,
        }}
      />
      {open >= 1 &&
        tokens.map((t, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: t * (width - 20) - 2,
              top: -12,
              width: 24,
              height: 24,
              borderRadius: 12,
              background: ink.paperLight,
              border: `3px solid ${ink.nasikDeep}`,
              boxSizing: "border-box",
              opacity: running * Math.min(1, Math.min(t, 1 - t) * 8),
            }}
          />
        ))}
      {label && <div style={{ position: "absolute", left: -10, right: -10, bottom: 22, textAlign: "center", opacity: open }}>{label}</div>}
    </div>
  );
}

/** The closing line: paid out, and every bond carried round into the next draw. */
function Again({ at }: { at: number }) {
  const frame = useCurrentFrame();
  const drawn = ramp(frame, at, 20, easeInOut);
  const down = RETURN - BOTTOM;
  const across = centre(3) - centre(1);
  const across1 = Math.min(1, Math.max(0, (drawn - 0.15) / 0.7));
  const up = Math.max(0, (drawn - 0.85) / 0.15);
  return (
    <>
      <div style={{ position: "absolute", left: centre(3) - 2, top: BOTTOM, width: 4, height: down * Math.min(1, drawn / 0.15), background: ink.nasikDeep }} />
      <div style={{ position: "absolute", left: centre(3) - across * across1, top: RETURN - 2, width: across * across1, height: 4, background: ink.nasikDeep }} />
      <div style={{ position: "absolute", left: centre(1) - 2, top: RETURN - down * up, width: 4, height: down * up, background: ink.nasikDeep }} />
      <div
        style={{
          position: "absolute",
          left: centre(1) - 9,
          top: BOTTOM - 2,
          width: 0,
          height: 0,
          opacity: up,
          borderLeft: "9px solid transparent",
          borderRight: "9px solid transparent",
          borderBottom: `14px solid ${ink.nasikDeep}`,
        }}
      />
      <div style={{ position: "absolute", left: centre(1), width: across, top: RETURN - 24, display: "flex", justifyContent: "center", opacity: ramp(frame, at + 8, 10) }}>
        <span style={{ padding: "2px 22px", background: ink.tint, fontFamily: fonts.body, fontWeight: 600, fontSize: 34, color: ink.nasikDeep }}>Every bond stays in the next draw</span>
      </div>
    </>
  );
}

export function Loop({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const pool = cue(shot, "pool");
  const stakes = cue(shot, "stakes");
  const commission = cue(shot, "commission");
  const percent = cue(shot, "one");
  const contract = cue(shot, "contract");
  const bytes = cue(shot, "1785");
  const renounced = cue(shot, "renounced");
  const whatever = cue(shot, "whatever");
  const prize = cue(shot, "prize");

  const held = interpolate(frame, [whatever, prize], [0, 7], clamp);
  const up = ramp(frame, stakes, 16);
  return (
    <Ground tone="paper">
      <Waves color={ink.nasik} alpha={0.09} phase={1.2 + frame * 0.002} />

      <div style={{ position: "absolute", left: COLUMN[1] - 50, top: 70, width: CARD.w + 100, height: 62, display: "grid", placeItems: "center", background: ink.nasikDeep, opacity: up, transform: `translateY(${(1 - up) * -18}px)` }}>
        <Label color={ink.paperLight} size={21} style={{ letterSpacing: 2 }}>
          Portaldot validators
        </Label>
      </div>
      <div style={{ position: "absolute", left: centre(1) - 2, top: 132, width: 4, height: (CARD.top - 132) * up, background: ink.nasikDeep }} />

      <Card column={0} at={0} petals={7} title="Your wallet">
        MetaMask, one signature
      </Card>
      <Card column={1} at={pool} petals={11} title="Nomination pool" fade={ramp(frame, renounced, 4)}>
        Native. No keys. Stakes everything.
        <div style={{ marginTop: 6, fontFamily: fonts.mono, fontWeight: 600, fontSize: 19, color: ink.vermilion, opacity: ramp(frame, renounced + 6, 8) }}>no root, no bouncer</div>
      </Card>
      <Card column={2} at={contract} petals={9} title="PrizeVault">
        <span style={{ fontFamily: fonts.mono, fontWeight: 600, opacity: ramp(frame, bytes, 8) }}>1,785 bytes</span>
        <div style={{ marginTop: 8, fontFamily: fonts.mono, fontWeight: 600, fontSize: 30, color: ink.vermilion, opacity: ramp(frame, whatever, 8) }}>{held.toFixed(4)} tPOT</div>
      </Card>
      <Card column={3} at={prize - 8} petals={13} title="One member">
        <span style={{ fontFamily: fonts.mono, fontWeight: 600, color: ink.vermilion }}>6.6500 tPOT</span>
        <div style={{ marginTop: 6, fontSize: 21 }}>0.3500 to the keeper who ran the draw</div>
      </Card>

      <Run column={0} at={pool - 4} stop={commission} />
      <Run
        column={1}
        at={commission}
        label={
          <Slam at={percent} from={1.6}>
            <span style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 46, color: ink.vermilion }}>100%</span>
          </Slam>
        }
      />
      <Run
        column={2}
        at={prize - 16}
        label={
          <Slam at={prize} from={1.6}>
            <span style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 46, color: ink.vermilion }}>95%</span>
          </Slam>
        }
      />

      <div style={{ position: "absolute", left: COLUMN[1] - 30, top: CARD.top + 34, width: CARD.w + 60, display: "flex", justifyContent: "center" }}>
        <Stamp at={renounced} size={42} angle={-8}>
          Renounced
        </Stamp>
      </div>

      <Again at={prize - 2} />

      <Sfx name="whoosh" at={commission} volume={0.2} />
      <Sfx name="stamp" at={percent} volume={0.4} />
      <Sfx name="stamp" at={renounced} volume={0.6} />
      <Sfx name="chime" at={prize} volume={0.32} />
    </Ground>
  );
}
