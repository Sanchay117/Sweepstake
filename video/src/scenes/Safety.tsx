import { useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { Rosette } from "../ui/engraving.tsx";
import { Ground, Hatch, Middle, ramp, Slam } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

const FIRE = { line: ink.paperLight, gap: "#a63a27", shade: "#5a1a10" };

export function Safety({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const no = cue(shot, "no");
  const worst = cue(shot, "worst");
  const one = cue(shot, "one");
  const dim = 1 - 0.5 * ramp(frame, worst, 8);
  return (
    <Ground tone="vermilion">
      <Rosette size={1500} petals={11} rings={26} depth={0.26} turns={2} inner={0.36} color={ink.paper} weight={1.1} style={{ left: 210, top: -250, opacity: 0.16, transform: `rotate(${frame * 0.1}deg)` }} />
      <Middle style={{ paddingBottom: 90 }}>
        <div style={{ opacity: dim }}>
          <Slam at={no} from={1.3}>
            <Hatch size={124} {...FIRE}>
              No contract ever
            </Hatch>
          </Slam>
          <br />
          <Slam at={no + 8} from={1.3}>
            <Hatch size={124} {...FIRE}>
              holds a deposit.
            </Hatch>
          </Slam>
        </div>
        <div style={{ marginTop: 46, fontFamily: fonts.body, fontWeight: 600, fontSize: 58, color: ink.paperLight, opacity: ramp(frame, worst, 6) }}>The worst a bug can lose:</div>
        <Slam at={one} from={1.8}>
          <Hatch size={190} {...FIRE}>
            ONE PRIZE
          </Hatch>
        </Slam>
      </Middle>
      <Sfx name="stamp" at={no} volume={0.7} />
      <Sfx name="stamp" at={one} volume={0.8} />
    </Ground>
  );
}
