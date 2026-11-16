"use strict";

const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d", {alpha: false});
const button = document.querySelector("#toggle");
const replay = document.querySelector("#replay");
const timeLabel = document.querySelector("#time");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const tau = 2 * Math.PI;
const tilt = 18 * Math.PI / 180;
const sinTilt = Math.sin(tilt);
const cosTilt = Math.cos(tilt);
const background = "#181c24";
const palette = new Map();

let randomState = 31;
function random() {
  randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
  return randomState / 4294967296;
}
const snow = Array.from({length: 520}, () => ({
  x: random(), y: random(), speed: 0.025 + random() * 0.08, seed: random(),
}));

let view;
let elapsed = motion.matches ? 15 : 0;
let lastFrame = null;
let frameBudget = 0;
let scheduled = null;
let paused = motion.matches;

function resize() {
  const {width, height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const fontSize = height / 145 * 0.91;
  ctx.font = fontSize + "px Consolas, 'Courier New', monospace";
  ctx.textBaseline = "top";
  const cellWidth = ctx.measureText("M").width;
  const cellHeight = height / 145;
  const columns = Math.floor(width / cellWidth);
  const rows = 145;
  const cells = columns * rows;
  view = {width, height, columns, rows, cellWidth, cellHeight,
    scale: Math.min(width / 3.95, height / 4.15),
    glyphs: new Uint8Array(cells), ink: new Uint32Array(cells),
    depth: new Float32Array(cells), bloom: new Uint8Array(cells),
    opacity: new Float32Array(cells)};
  draw();
}

function rgb(red, green, blue) {
  // Quantize tiny text colors to reduce Canvas state changes and cache size.
  return ((Math.min(31, red >> 3) << 19) |
    (Math.min(31, green >> 3) << 11) | (Math.min(31, blue >> 3) << 3)) >>> 0;
}

function cssColor(color) {
  let value = palette.get(color);
  if (!value) {
    value = "#" + color.toString(16).padStart(6, "0");
    palette.set(color, value);
  }
  return value;
}

function smoothstep(value) {
  value = Math.max(0, Math.min(1, value));
  return value * value * (3 - 2 * value);
}

function animatePoint(offset, time) {
  let x = model[offset] / 1000;
  let y = model[offset + 1] / 1000;
  let z = model[offset + 2] / 1000;
  let char = model[offset + 3];
  const kind = model[offset + 8];
  let age = time - model[offset + 7] / 100;
  if (kind >= 7 || age >= 3.6) return [x, y, z, char, 1];
  // The ribbon is drawn along its ordered spiral, with a small bright leading tip.
  if (kind === 2) {
    if (age <= 0) return null;
    return [x, y, z, age < 0.12 ? 42 : char, smoothstep(age / 0.22)];
  }
  if (kind === 6) {
    if (age <= 0) return null;
    const progress = smoothstep(age / 3.2);
    x += 0.16 * Math.sin(Math.PI * progress) * (1 - progress);
    y += 1.35 * (1 - progress);
    return [x, y, z, char, smoothstep(age / 0.45)];
  }
  const index = offset / 9;
  const seed = index * 0.61803398875 % 1;
  const foliage = kind <= 1;
  age -= seed * (foliage ? 0.4 : 0.9);
  if (age <= 0) return null;
  const progress = Math.min(1, age / (foliage ? 1 : 1.6));
  const ease = smoothstep(progress);
  const remaining = 1 - ease;
  if (foliage) {
    x *= ease;
    z *= ease;
    y += 0.10 * Math.sin(seed * tau + progress * 8) * remaining;
  }
  if (progress < 0.55) char = 46;
  else if (progress < 0.85) char = 58;
  return [x, y, z, char, ease];
}

function draw() {
  if (!view) return;
  const {width, height, columns, rows, cellWidth, cellHeight, scale, glyphs, ink, depth, bloom, opacity} = view;
  glyphs.fill(0);
  bloom.fill(0);
  depth.fill(-Infinity);
  opacity.fill(1);
  const phase = Math.max(0, elapsed);
  const angle = (elapsed % 20) * tau / 20;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const centerX = width / 2;
  const floorY = height * 0.79;

  const put = (col, row, char, color, distance, environmentGlow = false) => {
    if(col<0 || col>=columns || row<0 || row>=rows) return;
    const index=row*columns+col;
    if(distance<depth[index]) return;
    glyphs[index]=char.charCodeAt(0);
    ink[index]=rgb(...color);
    depth[index]=distance;
    bloom[index]=environmentGlow ? 4 : 0;
  };
  drawVillage(view, phase, put);
  drawSanta(view, phase, put);

  for (const flake of snow) {
    const drift = 0.007 * Math.sin(elapsed * 0.75 + flake.seed * 21);
    const col = Math.floor((1 + flake.x + drift) % 1 * columns);
    const row = Math.floor((flake.y + elapsed * flake.speed) % 1 * rows);
    const index = row * columns + col;
    const close = flake.seed > 0.96;
    const shine = 95 + 150 * flake.seed;
    if (!close && depth[index] > -Infinity) continue;
    glyphs[index] = close ? 42 : flake.seed > 0.85 ? 43 : 46;
    ink[index] = rgb(shine, shine + 5, shine + 9);
    if (close) {
      depth[index] = 6;
      bloom[index] = 1;
    }
  }

  for (let i = 0; i < model.length; i += 9) {
    const state = animatePoint(i, phase);
    if (!state) continue;
    const kind = model[i + 8];
    let [x, y, z, char, alpha] = state;
    if (kind !== 6) {
      const rotatedX = x * cosine - z * sine;
      z = x * sine + z * cosine;
      x = rotatedX;
    }
    const col = Math.round((centerX + x * scale) / cellWidth);
    const row = Math.round((floorY + (-y * cosTilt + z * sinTilt) * scale) / cellHeight);
    if (col < 0 || col >= columns || row < 0 || row >= rows) continue;
    const index = row * columns + col;
    const distance = z * cosTilt + y * sinTilt;
    if (distance < depth[index]) continue;

    let shade = 1;
    if (kind <= 3) {
      shade = Math.max(0.38, 0.8 + 0.4 * (z + 0.35 * x) / (Math.hypot(x, z) || 1));
    }
    if (kind === 4) {
      shade = 0.83 + 0.17 * Math.sin(elapsed * 4 + i * 0.033);
    }
    if (kind === 6) {
      shade = 0.95 + 0.35 * Math.sin(elapsed * 3.3) ** 8 + 0.15 * Math.sin(elapsed * 2);
      shade += 0.12 * Math.sin(elapsed * 8 + i / 9 * 0.731) ** 16;
    }
    glyphs[index] = char;
    ink[index] = rgb(model[i + 4] * shade, model[i + 5] * shade, model[i + 6] * shade);
    opacity[index] = alpha;
    depth[index] = distance;
    bloom[index] = kind === 6 ? 3 : kind === 4 ? 2 : 0;
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  let previous = -1;
  for (let i = 0; i < glyphs.length; i++) {
    if (!glyphs[i]) continue;
    if (ink[i] !== previous) {
      previous = ink[i];
      ctx.fillStyle = cssColor(previous);
    }
    ctx.globalAlpha = opacity[i];
    ctx.fillText(String.fromCharCode(glyphs[i]),
      (i % columns) * cellWidth, Math.floor(i / columns) * cellHeight);
  }

  // The glow is a second pass of the same ASCII glyphs.
  for (let i = 0; i < glyphs.length; i++) {
    if (!bloom[i] || !glyphs[i]) continue;
    if (bloom[i] === 4) {
      // Environment light is confined to its own cell. Tree writes above replace
      // this flag, so a village glow never overwrites a tree cell.
      const x = (i % columns) * cellWidth, y = Math.floor(i / columns) * cellHeight;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellWidth, cellHeight);
      ctx.clip();
      ctx.globalAlpha = .16;
      ctx.shadowBlur = height / 160;
      ctx.shadowColor = ctx.fillStyle = cssColor(ink[i]);
      ctx.fillText(String.fromCharCode(glyphs[i]), x, y);
      ctx.restore();
      continue;
    }
    const star = bloom[i] === 3;
    ctx.globalAlpha = opacity[i] * (star ? 0.45 + 0.18 * Math.sin(elapsed * 3.3) ** 8 : 0.45);
    ctx.shadowBlur = height / (star ? 60 : 95);
    ctx.shadowColor = cssColor(ink[i]);
    ctx.fillStyle = cssColor(ink[i]);
    ctx.fillText(String.fromCharCode(glyphs[i]),
      (i % columns) * cellWidth, Math.floor(i / columns) * cellHeight);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  // Chat snow and impact fragments stay visible in front of the scenery.
  if (typeof chatSnow !== "undefined") chatSnow.draw(ctx, view, elapsed);
  timeLabel.textContent = "t " + phase.toFixed(2).padStart(5, "0") + "s";
}

function tick(timestamp) {
  if (lastFrame === null) lastFrame = timestamp;
  const delta = timestamp - lastFrame;
  lastFrame = timestamp;
  elapsed += delta / 1000;
  frameBudget += delta;
  if (frameBudget >= 1000 / 30) {
    frameBudget %= 1000 / 30;
    draw();
  }
  scheduled = requestAnimationFrame(tick);
}

function setPaused(next) {
  paused = next;
  button.textContent = paused ? "재생" : "일시정지";
  button.setAttribute("aria-label", paused ? "애니메이션 재생" : "애니메이션 일시정지");
  if (scheduled !== null) cancelAnimationFrame(scheduled);
  scheduled = null;
  lastFrame = null;
  frameBudget = 0;
  if (!paused && !document.hidden) scheduled = requestAnimationFrame(tick);
}

button.addEventListener("click", () => setPaused(!paused));
replay.addEventListener("click", () => {
  elapsed = 0;
  draw();
  setPaused(false);
});
document.addEventListener("visibilitychange", () => setPaused(paused));
motion.addEventListener("change", (event) => setPaused(event.matches));
new ResizeObserver(resize).observe(canvas);
resize();
setPaused(paused);
