import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { clamp, Label, Layer, ramp } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

/** The bond again, with the sentence that opened the film, and where to find the real thing. */
export function Close({ shot, repo, site }: SceneProps & { repo: string; site: string }) {
  const frame = useCurrentFrame();
  const stake = cue(shot, "stake");
  const yieldWord = cue(shot, "yield");
  const land = yieldWord + 18;
  const postmark = frame - land;
  const scale = interpolate(postmark, [0, 4], [2.4, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const foot = ramp(frame, land + 10, 16);
  const out = interpolate(frame, [shot.frames - 26, shot.frames - 2], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: ink.paper }}>
      <Layer name="print" />
      <Layer name="wordmark" />
      <Layer name="issue" />
      <Layer name="serial" />
      <Layer name="plain" style={{ opacity: ramp(frame, stake - 4, 12) }} />
      <Layer name="promise" />
      {postmark >= 0 && <Layer name="postmark" style={{ transform: `scale(${scale})`, transformOrigin: "78% 55%" }} />}
      <div style={{ position: "absolute", left: 0, right: 0, top: 824, textAlign: "center", color: ink.nasikDeep, opacity: foot }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 38 }}>Portaldot Hacker House 2026</div>
        <Label color={ink.nasik} size={20} style={{ marginTop: 8 }}>
          Ecosystem DApps
        </Label>
        {(repo || site) && (
          <div style={{ marginTop: 12, fontFamily: fonts.mono, fontWeight: 500, fontSize: 24, color: ink.press }}>
            {[site, repo].filter(Boolean).join("   ")}
          </div>
        )}
      </div>
      <AbsoluteFill style={{ background: ink.press, opacity: out }} />
      <Sfx name="stamp" at={land} volume={0.7} />
    </AbsoluteFill>
  );
}
