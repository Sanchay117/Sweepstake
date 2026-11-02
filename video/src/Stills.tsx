import { AbsoluteFill } from "remotion";
import { fonts, ink } from "./theme.ts";
import { Rosette } from "./ui/engraving.tsx";
import { Layer } from "./ui/kit.tsx";

/** The real bond, with its sentence set large enough to read as a thumbnail. */
export function Thumbnail() {
  return (
    <AbsoluteFill style={{ background: ink.paper }}>
      <Layer name="print" />
      <Layer name="wordmark" style={{ transform: "scale(1.26)", transformOrigin: "50% 7%" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 462, textAlign: "center", fontFamily: fonts.display, fontWeight: 900, color: ink.press }}>
        <div style={{ fontSize: 118, lineHeight: 1.14 }}>Stake POT. Keep it.</div>
        <div style={{ fontSize: 80, lineHeight: 1.3, color: ink.vermilion }}>One member wins everyone&rsquo;s yield.</div>
      </div>
      <div style={{ position: "absolute", left: 300, bottom: 116, fontFamily: fonts.mono, fontWeight: 600, fontSize: 36, letterSpacing: 4, color: ink.nasikDeep }}>NO-LOSS PRIZE BONDS ON PORTALDOT V3</div>
      <Layer name="postmark" style={{ transform: "translate(2.6%, 25%) rotate(-6deg) scale(1.05)", transformOrigin: "78% 55%" }} />
    </AbsoluteFill>
  );
}

/** The square mark for the submission form: the bond's rosette around an engraved S. */
export function Logo() {
  return (
    <AbsoluteFill style={{ background: ink.paper, display: "grid", placeItems: "center" }}>
      <Rosette size={780} petals={13} rings={30} depth={0.2} turns={2} inner={0.62} weight={1.3} style={{ left: 10, top: 10 }} />
      <div style={{ width: 440, height: 440, borderRadius: 220, background: ink.paperLight, boxShadow: `0 0 0 4px ${ink.nasikDeep}, 0 0 0 14px ${ink.paperLight}, 0 0 0 16px ${ink.nasikDeep}`, display: "grid", placeItems: "center", fontFamily: fonts.display, fontWeight: 900, fontSize: 330, lineHeight: 1, color: ink.nasikDeep, zIndex: 1 }}>
        <span style={{ transform: "translateY(-8px)" }}>S</span>
      </div>
    </AbsoluteFill>
  );
}
