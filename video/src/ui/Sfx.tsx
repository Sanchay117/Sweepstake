import { Audio, interpolate, Sequence, staticFile } from "remotion";

export type SfxName = "stamp" | "press" | "thud" | "whoosh" | "tick" | "paper" | "chime";

/** A one-shot sound effect from public/sfx (made by scripts/sfx.ts) at a scene frame. */
export function Sfx({ name, at, volume = 0.6 }: { name: SfxName; at: number; volume?: number }) {
  return (
    <Sequence from={Math.max(0, Math.round(at))} durationInFrames={90} name={`sfx ${name}`} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
}

/** A looped sound for `frames` frames from `from`, faded at both ends. */
export function LoopedSfx({ name, from, frames, volume = 0.16 }: { name: "typing" | "ratchet"; from: number; frames: number; volume?: number }) {
  if (frames <= 0) return null;
  return (
    <Sequence from={Math.round(from)} durationInFrames={Math.round(frames)} name={`sfx ${name}`} layout="none">
      <Audio
        src={staticFile(`sfx/${name}.wav`)}
        loop
        volume={(f) => volume * interpolate(f, [0, 4, frames - 6, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    </Sequence>
  );
}
