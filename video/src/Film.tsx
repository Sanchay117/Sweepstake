import type { ComponentType, ReactNode } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { OVERLAP, TEASER_FRAMES, type Plan, type Shot } from "./plan.ts";
import { Close } from "./scenes/Close.tsx";
import { Check, Counter, Draw, Exit, Hero, Register } from "./scenes/Footage.tsx";
import { Loop } from "./scenes/Loop.tsx";
import { Portaldot } from "./scenes/Portaldot.tsx";
import { Proof } from "./scenes/Proof.tsx";
import { Safety } from "./scenes/Safety.tsx";
import { DROP, Teaser } from "./scenes/Teaser.tsx";
import { ink } from "./theme.ts";
import { Captions } from "./ui/Captions.tsx";

export interface SceneProps {
  shot: Shot;
  plan: Plan;
}

export interface FilmProps extends Record<string, unknown> {
  captions: boolean;
  music: boolean;
  /** Public repository URL for the closing card; hidden when empty. */
  repo: string;
  /** Public website URL for the closing card; hidden when empty. */
  site: string;
  plan?: Plan;
}

const SCENES: Record<string, { component: ComponentType<SceneProps & { repo: string; site: string }>; boxed?: boolean; quiet?: boolean }> = {
  teaser: { component: Teaser, quiet: true },
  hero: { component: Hero },
  counter: { component: Counter },
  register: { component: Register },
  loop: { component: Loop, boxed: true },
  draw: { component: Draw },
  check: { component: Check },
  exit: { component: Exit },
  portaldot: { component: Portaldot },
  safety: { component: Safety, boxed: true },
  proof: { component: Proof },
  close: { component: Close, quiet: true },
};

/** Fades a scene in over the overlap with the one before it. */
function CrossFade({ children, first }: { children: ReactNode; first: boolean }) {
  const frame = useCurrentFrame();
  const o = first ? 1 : interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

export function Film({ captions, music, repo, site, plan }: FilmProps) {
  if (!plan) return null;
  return (
    <AbsoluteFill style={{ background: ink.press }}>
      {plan.shots.map((shot, i) => {
        const scene = SCENES[shot.id];
        const Scene = scene.component;
        return (
          <Sequence key={shot.id} from={shot.from} durationInFrames={shot.frames} name={shot.id}>
            <CrossFade first={i === 0}>
              <Scene shot={shot} plan={plan} repo={repo} site={site} />
              {captions && !scene.quiet && <Captions shot={shot} boxed={scene.boxed} />}
            </CrossFade>
          </Sequence>
        );
      })}
      {plan.voices.map((voice) => (
        <Sequence key={voice.id} from={voice.from} durationInFrames={voice.frames} name={`vo ${voice.id}`}>
          <Audio src={staticFile(voice.file)} volume={voice.from < TEASER_FRAMES ? TEASER_VOICE : 1} />
        </Sequence>
      ))}
      {music && <Score plan={plan} />}
    </AbsoluteFill>
  );
}

const fade = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The narrator sits a little forward in the teaser, where the words compete with a full score. */
const TEASER_VOICE = 1.4;

/**
 * The teaser's score, then a quiet bed under the demo. Between lines the score climbs toward the
 * drop and the title. Under a line it falls away, further as the music gets bigger, so the words
 * stay on top. Only the first beat of the drop lands at full strength, whoever is talking.
 */
function Score({ plan }: { plan: Plan }) {
  const lines = plan.voices.filter((v) => v.from < TEASER_FRAMES);
  const beneath = (frame: number) => interpolate(frame, [200, 405, 600, 675], [0.7, 0.31, 0.24, 0.19], fade);
  const hit = (frame: number) => interpolate(frame, [DROP - 2, DROP, DROP + 4, DROP + 12], [0, 1, 1, 0], fade);
  const ducked = (frame: number) => {
    const under = lines.reduce((most, v) => Math.max(most, interpolate(frame, [v.from - 5, v.from + 1, v.from + v.frames - 3, v.from + v.frames + 5], [0, 1, 1, 0], fade)), 0);
    return 1 - (1 - beneath(frame)) * under * (1 - hit(frame));
  };
  const level = (frame: number) => interpolate(frame, [0, 230, 300, 590, 600, 930, 940, 1060], [0.34, 0.42, 0.5, 0.58, 0.78, 0.78, 0.2, 0], fade);
  return (
    <>
      <Audio src={staticFile("sfx/teaser.wav")} volume={(f) => level(f) * ducked(f)} />
      <Sequence from={TEASER_FRAMES} name="bed">
        <Audio
          src={staticFile("sfx/bed.wav")}
          loop
          volume={(f) => {
            const left = plan.total - TEASER_FRAMES - f;
            return interpolate(f, [0, 90], [0, 0.12], fade) * interpolate(left, [0, 100], [0, 1], fade);
          }}
        />
      </Sequence>
    </>
  );
}
