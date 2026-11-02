// Composes the teaser's score in code (no samples, no licences): public/sfx/teaser.wav
//
// 120 BPM in D minor, so one bar is 2 s or 60 frames, and the picture in scenes/Teaser.tsx cuts on
// the same grid. The percussion is a printing press and a numbering machine, because that is what
// makes a bond.
//
//   bars 0-3    the press and the wheels, over a drone
//   bars 4-9    the build: bass, arpeggio, then a riser
//   bars 10-12  the drop: "Now it runs on Portaldot"
//   bars 13-14  the press on every beat, as the bond assembles
//   bar 15      the last strike, and a D major chord that rings out
//
//   node scripts/music.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 48000;
const BEAT = 0.5;
const BAR = 4 * BEAT;
const SIXTEENTH = BEAT / 4;
const LENGTH = 40;
const DROP = 10 * BAR;
const STRIKE = 15 * BAR;

type Bus = [Float32Array, Float32Array];
const bus = (): Bus => [new Float32Array(LENGTH * SR), new Float32Array(LENGTH * SR)];
const drums = bus();
const tonal = bus();
const send = bus();

let seed = 0x51ed27;
const noise = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 0xffffffff) * 2 - 1;
};
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function put(target: Bus, index: number, value: number, pan: number) {
  if (index < 0 || index >= target[0].length) return;
  target[0][index] += value * Math.cos(((pan + 1) * Math.PI) / 4);
  target[1][index] += value * Math.sin(((pan + 1) * Math.PI) / 4);
}

/** A band-limited saw step correction, so low notes do not alias. */
function blep(t: number, dt: number) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

interface Tone {
  at: number;
  dur: number;
  hz: number;
  gain: number;
  pan?: number;
  attack?: number;
  release?: number;
  /** The low-pass opens at cutFrom and settles at cutTo over cutTime. */
  cutFrom: number;
  cutTo: number;
  cutTime?: number;
  detune?: number[];
  sine?: number;
  reverb?: number;
  target?: Bus;
}

function tone({ at, dur, hz, gain, pan = 0, attack = 0.004, release = 0.06, cutFrom, cutTo, cutTime = 0.15, detune = [0], sine = 0, reverb = 0, target = tonal }: Tone) {
  const total = Math.ceil((dur + release) * SR);
  const start = Math.round(at * SR);
  const dts = detune.map((cents) => (hz * Math.pow(2, cents / 1200)) / SR);
  const phases = detune.map((_, i) => (i * 0.37) % 1);
  let low = 0;
  let band = 0;
  let sinePhase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    let wave = 0;
    for (let v = 0; v < dts.length; v++) {
      phases[v] += dts[v];
      if (phases[v] >= 1) phases[v] -= 1;
      wave += 2 * phases[v] - 1 - blep(phases[v], dts[v]);
    }
    wave /= Math.sqrt(dts.length);
    sinePhase += (2 * Math.PI * hz) / SR;
    const cutoff = cutTo + (cutFrom - cutTo) * Math.exp(-t / cutTime);
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, 16000)) / SR);
    low += f * band;
    const high = wave - low - 0.7 * band;
    band += f * high;
    const env = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) / (release / 3)) : 1);
    const sample = (low + Math.sin(sinePhase) * sine) * env * gain;
    put(target, start + i, sample, pan);
    if (reverb) put(send, start + i, sample * reverb, pan);
  }
}

const kicks: number[] = [];

function kick(at: number, gain = 1) {
  kicks.push(at);
  const start = Math.round(at * SR);
  let phase = 0;
  for (let i = 0; i < 0.34 * SR; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * (47 + 120 * Math.exp(-t / 0.028))) / SR;
    const body = Math.sin(phase) * Math.exp(-t / 0.13);
    const click = t < 0.004 ? noise() * 0.35 * (1 - t / 0.004) : 0;
    put(drums, start + i, (body + click) * gain, 0);
  }
}

/** The press: a kick with iron ringing above it. */
function press(at: number, gain = 1) {
  kick(at, gain);
  const start = Math.round(at * SR);
  for (const [hz, life, level] of [[410, 0.06, 0.2], [733, 0.05, 0.16], [1187, 0.035, 0.12], [1730, 0.025, 0.08]]) {
    for (let i = 0; i < 0.22 * SR; i++) {
      const t = i / SR;
      const sample = Math.sin(2 * Math.PI * hz * t) * level * gain * Math.exp(-t / life);
      put(drums, start + i, sample, 0);
      put(send, start + i, sample * 0.5, 0);
    }
  }
}

/** One click of the numbering machine. */
function tick(at: number, gain: number, pan: number) {
  const start = Math.round(at * SR);
  for (let i = 0; i < 0.014 * SR; i++) {
    const t = i / SR;
    put(drums, start + i, (noise() * 0.5 * Math.exp(-t / 0.0012) + Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t / 0.004)) * gain, pan);
  }
}

function hat(at: number, gain: number) {
  const start = Math.round(at * SR);
  let last = 0;
  for (let i = 0; i < 0.08 * SR; i++) {
    const t = i / SR;
    const white = noise();
    const high = white - last;
    last = white;
    put(drums, start + i, high * gain * Math.exp(-t / 0.024), 0.15);
  }
}

function clap(at: number, gain: number) {
  const start = Math.round(at * SR);
  let low = 0;
  for (let i = 0; i < 0.2 * SR; i++) {
    const t = i / SR;
    const hits = [0, 0.011, 0.023].reduce((sum, h) => sum + (t >= h ? Math.exp(-(t - h) / 0.009) : 0), 0) + Math.exp(-t / 0.075) * 0.7;
    const white = noise();
    low += 0.28 * (white - low);
    const sample = (white - low) * hits * gain;
    put(drums, start + i, sample, 0);
    put(send, start + i, sample * 0.35, 0);
  }
}

/** Noise climbing to the drop. */
function riser(from: number, to: number, gain: number) {
  const start = Math.round(from * SR);
  const total = Math.round((to - from) * SR);
  let low = 0;
  let band = 0;
  for (let i = 0; i < total; i++) {
    const p = i / total;
    const f = 2 * Math.sin((Math.PI * (300 + 7000 * p * p * p)) / SR);
    low += f * band;
    band += f * (noise() - low - 0.5 * band);
    const sample = band * gain * p * p;
    put(tonal, start + i, sample, Math.sin(p * 40) * 0.5);
    put(send, start + i, sample * 0.4, 0);
  }
}

/** A strike: a falling sub and a dark crash, sent to the reverb. */
function impact(at: number, gain: number) {
  const start = Math.round(at * SR);
  let phase = 0;
  let low = 0;
  for (let i = 0; i < 2.6 * SR; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * (34 + 70 * Math.exp(-t / 0.09))) / SR;
    put(drums, start + i, Math.sin(phase) * gain * Math.exp(-t / 0.5), 0);
    low += 0.18 * (noise() - low);
    const crash = low * gain * 0.7 * Math.exp(-t / 0.42);
    put(drums, start + i, crash, 0);
    put(send, start + i, crash * 0.9, 0);
  }
}

const CHORDS = [
  { root: 38, notes: [62, 65, 69] }, // Dm
  { root: 34, notes: [58, 62, 65] }, // Bb
  { root: 41, notes: [60, 65, 69] }, // F
  { root: 36, notes: [60, 64, 67] }, // C
];
const chordAt = (bar: number) => CHORDS[bar % 4];
const SUPER = [-14, -7, 0, 7, 14];

// Bars 0-3: the drone, the press once a bar, and the wheels turning.
for (const note of [38, 45]) {
  tone({ at: 0, dur: 8.2, hz: midi(note), gain: 0.2, attack: 1.2, release: 1.2, cutFrom: 180, cutTo: 520, cutTime: 6, detune: [-6, 6], sine: 0.3, reverb: 0.3 });
}
for (let b = 0; b < 4; b++) press(b * BAR, 0.5);
for (let s = 0; s < 32; s++) tick(s * 2 * SIXTEENTH, 0.06 + s * 0.001, s % 2 ? 0.3 : -0.3);

// Bars 4-9: the build.
for (let b = 4; b < 10; b++) {
  const chord = chordAt(b - 4);
  const heat = (b - 4) / 6;
  const open = 260 + 1300 * heat * heat;
  for (let e = 0; e < 8; e++) {
    tone({ at: b * BAR + e * 2 * SIXTEENTH, dur: 0.16, hz: midi(chord.root + 12), gain: 0.34, cutFrom: open * 2, cutTo: open, cutTime: 0.05, detune: [-5, 5], sine: 0.5 });
  }
  for (let s = 0; s < 16; s++) {
    if (b < 6 && s % 2) continue;
    const note = chord.notes[[0, 1, 2, 1][s % 4]] + 12 * (s % 8 > 3 ? 1 : 0);
    const at = b * BAR + s * SIXTEENTH;
    const gain = 0.08 + 0.1 * heat;
    tone({ at, dur: 0.09, hz: midi(note), gain, pan: s % 2 ? 0.35 : -0.35, cutFrom: 900 + 3600 * heat, cutTo: 400, cutTime: 0.07, reverb: 0.25 });
    tone({ at: at + 3 * SIXTEENTH, dur: 0.09, hz: midi(note), gain: gain * 0.35, pan: s % 2 ? -0.6 : 0.6, cutFrom: 1000, cutTo: 400, cutTime: 0.07, reverb: 0.3 });
  }
  for (const note of chord.notes) {
    tone({ at: b * BAR, dur: BAR, hz: midi(note - 12), gain: 0.05 + 0.05 * heat, attack: 0.4, release: 0.4, cutFrom: 500 + 1100 * heat, cutTo: 500 + 1100 * heat, detune: SUPER, reverb: 0.3 });
  }
  const beats = b < 8 ? [0, 2] : [0, 1, 2, 3];
  for (const k of beats) press(b * BAR + k * BEAT, 0.5 + 0.3 * heat);
  for (let s = 0; s < 8; s++) tick(b * BAR + s * 2 * SIXTEENTH, 0.08 + 0.08 * heat, s % 2 ? 0.3 : -0.3);
}
riser(8 * BAR, DROP - BEAT / 2, 0.42);
for (let s = 0; s < 16; s++) clap(9 * BAR + s * SIXTEENTH, 0.1 + (s / 16) * 0.22);

// Bars 10-12: the drop.
impact(DROP, 0.95);
for (let b = 10; b < 13; b++) {
  const chord = chordAt(b - 10);
  for (let k = 0; k < 4; k++) press(b * BAR + k * BEAT, 0.9);
  for (const k of [1, 3]) clap(b * BAR + k * BEAT, 0.34);
  for (let k = 0; k < 4; k++) hat(b * BAR + k * BEAT + BEAT / 2, 0.26);
  for (let s = 0; s < 16; s++) hat(b * BAR + s * SIXTEENTH, 0.06);
  for (let e = 0; e < 8; e++) {
    tone({ at: b * BAR + e * 2 * SIXTEENTH, dur: 0.2, hz: midi(chord.root + 12), gain: 0.42, cutFrom: 1900, cutTo: 500, cutTime: 0.09, detune: [-7, 7], sine: 0.5 });
  }
  for (const note of chord.notes) {
    tone({ at: b * BAR, dur: BAR, hz: midi(note), gain: 0.11, attack: 0.02, release: 0.3, cutFrom: 3400, cutTo: 2200, cutTime: 0.4, detune: SUPER, reverb: 0.35, pan: 0 });
  }
  for (const [s, i] of [[0, 2], [3, 1], [6, 0], [8, 2], [11, 1], [14, 2]]) {
    const hz = midi(chord.notes[i] + 12);
    tone({ at: b * BAR + s * SIXTEENTH, dur: 0.14, hz, gain: 0.14, release: 0.3, cutFrom: 5000, cutTo: 1700, cutTime: 0.08, detune: [-8, 8], sine: 0.8, reverb: 0.5 });
  }
}

// Bars 13-14: the press on every beat, and a held chord rising to the strike.
for (let b = 13; b < 15; b++) {
  for (let k = 0; k < 4; k++) press(b * BAR + k * BEAT, 0.8 + 0.025 * ((b - 13) * 4 + k));
  for (let s = 0; s < 16; s++) tick(b * BAR + s * SIXTEENTH, 0.2, s % 2 ? 0.35 : -0.35);
  for (let e = 0; e < 8; e++) {
    tone({ at: b * BAR + e * 2 * SIXTEENTH, dur: 0.18, hz: midi(50), gain: 0.34, cutFrom: 1500, cutTo: 480, cutTime: 0.08, detune: [-7, 7], sine: 0.5 });
  }
}
for (const note of [50, 57, 62, 65, 69]) {
  tone({ at: 13 * BAR, dur: 2 * BAR, hz: midi(note), gain: 0.11, attack: 0.5, release: 0.15, cutFrom: 800, cutTo: 5200, cutTime: 2.4, detune: SUPER, reverb: 0.4 });
}
riser(14 * BAR, STRIKE, 0.3);

// Bar 15: the last strike. The minor mode resolves to D major.
impact(STRIKE, 1);
press(STRIKE, 1);
for (const note of [38, 50, 57, 62, 66, 69, 74]) {
  tone({ at: STRIKE, dur: 3.2, hz: midi(note), gain: 0.12, attack: 0.01, release: 3.6, cutFrom: 4200, cutTo: 900, cutTime: 1.6, detune: SUPER, reverb: 0.6, sine: note < 45 ? 0.6 : 0 });
}

// The press ducks everything tonal, which is what makes the drop pump.
function duck(target: Bus) {
  const sorted = [...kicks].sort((a, b) => a - b);
  let k = 0;
  for (let i = 0; i < target[0].length; i++) {
    const t = i / SR;
    while (k + 1 < sorted.length && sorted[k + 1] <= t) k++;
    const since = sorted[k] <= t ? t - sorted[k] : 1;
    const gain = 1 - 0.62 * Math.exp(-since / 0.09);
    target[0][i] *= gain;
    target[1][i] *= gain;
  }
}
duck(tonal);

/** Parallel combs into series all-passes, a touch longer on the right. */
function reverb(input: Float32Array, spread: number) {
  const out = new Float32Array(input.length);
  for (const size of [1557, 1617, 1491, 1422, 1277, 1356]) {
    const line = new Float32Array(Math.round((size + spread) * 1.45));
    let at = 0;
    let damp = 0;
    for (let i = 0; i < input.length; i++) {
      const y = line[at];
      damp = 0.6 * damp + 0.4 * y;
      line[at] = input[i] + damp * 0.86;
      at = (at + 1) % line.length;
      out[i] += y * 0.16;
    }
  }
  for (const size of [556, 441, 341]) {
    const line = new Float32Array(size + spread);
    let at = 0;
    for (let i = 0; i < out.length; i++) {
      const delayed = line[at];
      const x = out[i];
      line[at] = x + delayed * 0.5;
      out[i] = delayed - x * 0.5;
      at = (at + 1) % line.length;
    }
  }
  return out;
}
const wetL = reverb(send[0], 0);
const wetR = reverb(send[1], 23);

const mix = bus();
for (let i = 0; i < mix[0].length; i++) {
  mix[0][i] = Math.tanh((drums[0][i] * 0.9 + tonal[0][i] + wetL[i] * 0.55) * 1.15);
  mix[1][i] = Math.tanh((drums[1][i] * 0.9 + tonal[1][i] + wetR[i] * 0.55) * 1.15);
}

// Fades the tail to nothing, then writes 16 bit stereo.
const fadeFrom = (LENGTH - 2) * SR;
for (let i = fadeFrom; i < mix[0].length; i++) {
  const gain = 1 - (i - fadeFrom) / (mix[0].length - fadeFrom);
  mix[0][i] *= gain;
  mix[1][i] *= gain;
}
let peak = 0;
for (let i = 0; i < mix[0].length; i++) peak = Math.max(peak, Math.abs(mix[0][i]), Math.abs(mix[1][i]));
const scale = 0.89 / peak;
const pcm = Buffer.alloc(44 + mix[0].length * 4);
pcm.write("RIFF", 0);
pcm.writeUInt32LE(36 + mix[0].length * 4, 4);
pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28);
pcm.writeUInt16LE(4, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(mix[0].length * 4, 40);
for (let i = 0; i < mix[0].length; i++) {
  pcm.writeInt16LE(Math.round(mix[0][i] * scale * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(mix[1][i] * scale * 32767), 46 + i * 4);
}
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sfx");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "teaser.wav"), pcm);
console.log(`teaser.wav  ${LENGTH}s, ${kicks.length} press strikes, peak gain ${scale.toFixed(2)}`);
