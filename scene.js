"use strict";

const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d", {alpha: false});
const button = document.querySelector("#toggle");
const replay = document.querySelector("#replay");
const timeLabel = document.querySelector("#time");
const stats = document.querySelector("#stats");
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
let elapsed = 13.4;
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
    depth: new Float32Array(cells), bloom: new Uint8Array(cells)};
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

function draw() {
  if (!view) return;
  const {width, height, columns, rows, cellWidth, cellHeight, scale, glyphs, ink, depth, bloom} = view;
  glyphs.fill(0);
  bloom.fill(0);
  depth.fill(-Infinity);
  const phase = elapsed % 20;
  const angle = phase * tau / 20;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const centerX = width / 2;
  const floorY = height * 0.79;
  let lights = 0;

  for (const flake of snow) {
    const drift = 0.007 * Math.sin(elapsed * 0.75 + flake.seed * 21);
    const col = Math.floor((1 + flake.x + drift) % 1 * columns);
    const row = Math.floor((flake.y + elapsed * flake.speed) % 1 * rows);
    const index = row * columns + col;
    const close = flake.seed > 0.96;
    const shine = 95 + 150 * flake.seed;
    glyphs[index] = close ? 42 : flake.seed > 0.85 ? 43 : 46;
    ink[index] = rgb(shine, shine + 5, shine + 9);
    if (close) {
      depth[index] = 6;
      bloom[index] = 1;
    }
  }

  for (let i = 0; i < model.length; i += 9) {
    const reveal = model[i + 7] / 100;
    if (phase < reveal) continue;
    const kind = model[i + 8];
    let x = model[i] / 1000;
    const y = model[i + 1] / 1000;
    let z = model[i + 2] / 1000;
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
    if (kind === 4 || kind === 6) {
      shade = 0.83 + 0.17 * Math.sin(elapsed * 4 + i * 0.033);
    }
    let color = rgb(model[i + 4] * shade, model[i + 5] * shade, model[i + 6] * shade);
    if (kind <= 1 && phase < 6.7 && phase - reveal < 0.16) {
      color = rgb(210, 221, 218);
    }
    glyphs[index] = model[i + 3];
    ink[index] = color;
    depth[index] = distance;
    bloom[index] = kind === 4 || kind === 6 ? 2 : 0;
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  let previous = -1;
  let count = 0;
  for (let i = 0; i < glyphs.length; i++) {
    if (!glyphs[i]) continue;
    if (ink[i] !== previous) {
      previous = ink[i];
      ctx.fillStyle = cssColor(previous);
    }
    ctx.fillText(String.fromCharCode(glyphs[i]),
      (i % columns) * cellWidth, Math.floor(i / columns) * cellHeight);
    count++;
  }

  // The glow is a second pass of the same ASCII glyphs.
  ctx.globalAlpha = 0.45;
  ctx.shadowBlur = height / 95;
  for (let i = 0; i < glyphs.length; i++) {
    if (!bloom[i] || !glyphs[i]) continue;
    ctx.shadowColor = cssColor(ink[i]);
    ctx.fillStyle = cssColor(ink[i]);
    ctx.fillText(String.fromCharCode(glyphs[i]),
      (i % columns) * cellWidth, Math.floor(i / columns) * cellHeight);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  for (let i = 7; i < model.length; i += 9) {
    if (model[i + 1] === 4 && phase >= model[i] / 100) lights++;
  }
  timeLabel.textContent = "t " + phase.toFixed(2).padStart(5, "0") + "s";
  stats.textContent = "rotation " + (phase * 18).toFixed(2) + "\u00b0   lights " + lights +
    "\nletters " + count.toLocaleString("en-US");
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
