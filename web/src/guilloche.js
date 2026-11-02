// Security engraving, computed. The lines on a bond are interleaved curves that a copier cannot
// hold, so every pattern here is drawn fresh for the screen's own pixel density.
const TAU = Math.PI * 2;

/** Sizes a canvas to its box at device resolution and returns a context in CSS pixels. */
export function prepare(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

/** A rounded rectangle walked by distance, so a pattern can wrap it and meet itself exactly. */
function perimeter(x, y, w, h, r) {
  const flatW = w - 2 * r;
  const flatH = h - 2 * r;
  const arc = (Math.PI / 2) * r;
  const length = 2 * (flatW + flatH) + 4 * arc;

  const corner = (cx, cy, start, along) => {
    const a = start + (along / arc) * (Math.PI / 2);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
  };

  return {
    length,
    at(distance) {
      let s = ((distance % length) + length) % length;
      if (s < flatW) return { x: x + r + s, y, nx: 0, ny: -1 };
      s -= flatW;
      if (s < arc) return corner(x + w - r, y + r, -Math.PI / 2, s);
      s -= arc;
      if (s < flatH) return { x: x + w, y: y + r + s, nx: 1, ny: 0 };
      s -= flatH;
      if (s < arc) return corner(x + w - r, y + h - r, 0, s);
      s -= arc;
      if (s < flatW) return { x: x + w - r - s, y: y + h, nx: 0, ny: 1 };
      s -= flatW;
      if (s < arc) return corner(x + r, y + h - r, Math.PI / 2, s);
      s -= arc;
      if (s < flatH) return { x, y: y + h - r - s, nx: -1, ny: 0 };
      s -= flatH;
      return corner(x + r, y + r, Math.PI, s);
    },
  };
}

/** Interleaved waves that swell and pinch, which is what reads as a chain of leaves. */
function band(ctx, path, { width, offset = 0, leaf, lines, pinch = 0.34, color, weight, phase = 0 }) {
  const waves = Math.max(8, Math.round(path.length / leaf));
  const steps = Math.ceil(path.length / 1.4);
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.lineJoin = "round";
  for (let i = 0; i < lines; i += 1) {
    const shift = (i / lines) * TAU + phase;
    ctx.beginPath();
    for (let k = 0; k <= steps; k += 1) {
      const s = (k / steps) * path.length;
      const t = (k / steps) * TAU * waves;
      const swell = 1 - pinch + pinch * Math.cos(t * 2);
      const d = offset + (width / 2) * swell * Math.sin(t + shift);
      const p = path.at(s);
      const px = p.x + p.nx * d;
      const py = p.y + p.ny * d;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

/** Microprinting: legible only when you zoom in, like the line on a real note. */
function microprint(ctx, path, { text, inset, color, size }) {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px "IBM Plex Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const advance = size * 0.66;
  const count = Math.floor(path.length / advance);
  for (let i = 0; i < count; i += 1) {
    const s = i * (path.length / count);
    const p = path.at(s);
    const char = text[i % text.length];
    ctx.save();
    ctx.translate(p.x + p.nx * inset, p.y + p.ny * inset);
    ctx.rotate(Math.atan2(p.ny, p.nx) + Math.PI / 2);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
}

/** A rosette: rings of the same curve, each turned a little, like a geometric lathe. */
export function rosette(ctx, cx, cy, radius, { petals = 12, rings = 22, depth = 0.3, turns = 1, color, weight = 0.6, inner = 0.46 }) {
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  const steps = 420;
  for (let i = 0; i < rings; i += 1) {
    const shift = (i / rings) * (TAU / petals) * turns;
    const size = radius * (inner + ((1 - inner) * i) / Math.max(1, rings - 1));
    ctx.beginPath();
    for (let k = 0; k <= steps; k += 1) {
      const a = (k / steps) * TAU;
      const r = size * (1 - depth + depth * Math.cos(petals * a + shift * petals));
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function medallion(ctx, cx, cy, radius, { color, paper, weight }) {
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.02, 0, TAU);
  ctx.fill();
  rosette(ctx, cx, cy, radius, { petals: 14, rings: 16, depth: 0.2, color, weight, inner: 0.62 });
  rosette(ctx, cx, cy, radius * 0.56, { petals: 8, rings: 10, depth: 0.26, turns: 2, color, weight: weight * 0.9, inner: 0.5 });
}

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The hero: a rainbow tint, a lace frame, medallions and a line of microprint. */
export function paintBond(canvas) {
  const { ctx, width, height } = prepare(canvas);
  const ink = css("--nasik");
  const paper = css("--paper");
  const compact = width < 720;
  const margin = compact ? 7 : 13;
  const frame = compact ? 15 : 34;
  const edge = margin + frame / 2;

  const tint = ctx.createRadialGradient(width / 2, height * 0.42, 40, width / 2, height * 0.42, Math.max(width, height) * 0.62);
  tint.addColorStop(0, css("--tint-deep"));
  tint.addColorStop(0.55, css("--tint"));
  tint.addColorStop(1, paper);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, width, height);

  const inner = margin + frame + 3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner, inner, width - inner * 2, height - inner * 2);
  ctx.clip();
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.09;
  ctx.lineWidth = 0.5;
  const spacing = compact ? 11 : 13;
  for (let row = -2; row * spacing < height + 40; row += 1) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = row * spacing + 7 * Math.sin(x / 46 + row * 0.42) + 3 * Math.sin(x / 17 - row * 0.2);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  const outline = perimeter(edge, edge, width - edge * 2, height - edge * 2, compact ? 8 : 16);
  band(ctx, outline, { width: frame * 0.92, leaf: compact ? 18 : 46, lines: compact ? 7 : 13, color: ink, weight: compact ? 0.5 : 0.62 });
  band(ctx, outline, { width: frame * 0.5, leaf: compact ? 18 : 46, lines: compact ? 3 : 6, color: ink, weight: 0.5, phase: Math.PI / 2, pinch: 0.5 });

  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(margin - 2, margin - 2, width - (margin - 2) * 2, height - (margin - 2) * 2, compact ? 7 : 12);
  ctx.stroke();

  const innerRule = perimeter(inner, inner, width - inner * 2, height - inner * 2, compact ? 4 : 6);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(inner, inner, width - inner * 2, height - inner * 2, compact ? 4 : 6);
  ctx.stroke();
  if (!compact) {
    microprint(ctx, innerRule, {
      text: "NO OTHER INTEREST WILL BE PAYABLE ON THE BOND BUT PRIZES   ",
      inset: -6,
      color: ink,
      size: 5,
    });
  }

  if (!compact) {
    const r = 58;
    const pad = margin + 40;
    for (const [cx, cy] of [
      [pad, pad],
      [width - pad, pad],
      [pad, height - pad],
      [width - pad, height - pad],
    ]) {
      medallion(ctx, cx, cy, r, { color: ink, paper, weight: 0.55 });
    }
  }
}

/** Flat ink ground with lighter engraved waves, for the turn. */
export function paintWaves(canvas) {
  const { ctx, width, height } = prepare(canvas);
  ctx.strokeStyle = css("--tint");
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 0.6;
  for (let row = -3; row * 9 < height + 60; row += 1) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = row * 9 + 16 * Math.sin(x / 90 + row * 0.13) * Math.cos(row * 0.05) + 5 * Math.sin(x / 31 + row * 0.3);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** The back of the bond: a vermilion wave frame, after the 1963 issue. */
export function paintReverse(canvas) {
  const { ctx, width, height } = prepare(canvas);
  const ink = css("--vermilion");
  const compact = width < 720;
  const frame = compact ? 13 : 30;
  const edge = 8 + frame / 2;
  const outline = perimeter(edge, edge, width - edge * 2, height - edge * 2, compact ? 6 : 12);
  band(ctx, outline, { width: frame * 0.94, leaf: compact ? 22 : 58, lines: compact ? 6 : 11, color: ink, weight: 0.6, pinch: 0.18 });
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.roundRect(edge + frame / 2 + 3, edge + frame / 2 + 3, width - (edge + frame / 2 + 3) * 2, height - (edge + frame / 2 + 3) * 2, 4);
  ctx.stroke();
}

/** Every bearer's rosette is computed from their own address, so no two bonds match. */
export function paintHolding(canvas, address) {
  const { ctx, width, height } = prepare(canvas);
  const ink = css("--nasik");
  const seed = address ? BigInt(address) : 0x5ee95a6en;
  const pick = (shift, low, span) => low + Number((seed >> BigInt(shift)) % BigInt(span));
  const petals = pick(0, 7, 11);
  const r = Math.min(width, height) / 2 - 2;
  rosette(ctx, width / 2, height / 2, r, {
    petals,
    rings: pick(8, 18, 12),
    depth: 0.14 + pick(16, 0, 18) / 100,
    turns: pick(24, 1, 3),
    color: ink,
    weight: 0.55,
    inner: 0.34 + pick(32, 0, 20) / 100,
  });
}
