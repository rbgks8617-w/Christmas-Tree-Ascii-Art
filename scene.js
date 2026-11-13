"use strict";

const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d", {alpha: false});
const button = document.querySelector("#toggle");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const tau = 2 * Math.PI;
const tilt = 18 * Math.PI / 180;
const sinTilt = Math.sin(tilt);
const cosTilt = Math.cos(tilt);
const greens = [22, 28, 34, 35, 42, 78];
const golds = [178, 220, 226, 229, 230];
const levels = [0, 95, 135, 175, 215, 255];
const background = "#050b09";

const colors = Array.from({length: 256}, (_, index) => {
  if (index < 16) return background;
  if (index >= 232) {
    const gray = 8 + 10 * (index - 232);
    return "rgb(" + [gray, gray, gray].join(",") + ")";
  }
  const n = index - 16;
  return "rgb(" + [levels[Math.floor(n / 36)], levels[Math.floor(n / 6) % 6],
    levels[n % 6]].join(",") + ")";
});

const snow = Array.from({length: 380}, () => ({
  x: Math.random(),
  y: Math.random(),
  speed: 0.035 + Math.random() * 0.055,
  seed: Math.random(),
}));

let view;
let elapsed = 0;
let lastFrame = null;
let scheduled = null;
let paused = motion.matches;

function resize() {
  const {width, height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const fontSize = Math.max(6, width / 180, height / 75);
  ctx.font = fontSize + "px Consolas, 'Courier New', monospace";
  ctx.textBaseline = "top";
  const cellWidth = ctx.measureText("M").width;
  const cellHeight = fontSize * 1.13;
  const columns = Math.floor(width / cellWidth);
  const rows = Math.floor(height / cellHeight);
  const cells = columns * rows;
  view = {width, height, columns, rows, cellWidth, cellHeight,
    scale: Math.max(0, Math.min((columns - 4) / 72, (rows - 3) / 35)),
    glyphs: new Uint8Array(cells), ink: new Uint8Array(cells),
    depth: new Float32Array(cells)};
  draw();
}

function draw() {
  if (!view) return;
  const {width, height, columns, rows, cellWidth, cellHeight, scale, glyphs, ink, depth} = view;
  glyphs.fill(0);
  depth.fill(-Infinity);
  const centerX = (columns - 1) / 2;
  const centerY = (rows - 1) / 2 - 0.8 * scale;

  function plot(x, y, z, char, color, bias) {
    const col = Math.round(centerX + x * 2 * scale);
    const row = Math.round(centerY + (-y * cosTilt + z * sinTilt) * scale);
    if (col < 0 || col >= columns || row < 0 || row >= rows) return;
    const index = row * columns + col;
    const distance = z * cosTilt + y * sinTilt + bias;
    if (distance >= depth[index]) {
      depth[index] = distance;
      glyphs[index] = char;
      ink[index] = color;
    }
  }

  const snowCount = Math.min(snow.length, Math.floor(glyphs.length / 30));
  for (let i = 0; i < snowCount; i++) {
    const flake = snow[i];
    const drift = 0.018 * Math.sin(elapsed * 0.85 + flake.seed * 21);
    const col = Math.floor((1 + flake.x + drift) % 1 * columns);
    const row = Math.floor((flake.y + elapsed * flake.speed) % 1 * rows);
    const index = row * columns + col;
    const close = flake.seed > 0.92;
    glyphs[index] = close ? 42 : flake.seed > 0.32 ? 46 : 39;
    ink[index] = close ? 253 : 244;
    if (close) depth[index] = 30;
  }

  function rotate(points, angle, kind) {
    const cosine = Math.cos(angle) / 100;
    const sine = Math.sin(angle) / 100;
    const pulse = (1 + Math.sin(elapsed * tau / 1.6)) / 2;
    for (let i = 0; i < points.length; i += 5) {
      const x = points[i] * cosine - points[i + 2] * sine;
      const z = points[i] * sine + points[i + 2] * cosine;
      let y = points[i + 1] / 100;
      let char = points[i + 3];
      let color = points[i + 4];
      let bias = 0;
      if (color === -1) {
        const radius = Math.hypot(x, z) || 1;
        const shade = Math.floor(2.4 + (z + 0.63 * x) * 2.4 / radius);
        color = greens[Math.max(0, Math.min(5, shade))];
      }
      if (kind === "ornaments") {
        bias = 0.55;
        if (char === 42 && Math.sin(elapsed * 5.6 + i * 0.122) > 0.52) {
          char = 43;
          color = 230;
        }
      }
      if (kind === "star") {
        y += 12.15;
        bias = 0.2;
        color = golds[Math.floor(pulse * 3) + Number(char === 42)];
      }
      plot(x, y, z, char, color, bias);
    }
  }

  const angle = tau * elapsed / 8;
  rotate(stage, angle);
  rotate(tree, angle);
  rotate(ornaments, angle, "ornaments");
  rotate(star, 2 * angle + 0.25, "star");

  for (let i = 0; i < 8; i++) {
    const orbit = elapsed * 1.2 + i * tau / 8;
    const glow = Math.sin(elapsed * 4 + i);
    if (glow <= 0.25) continue;
    const radius = 3 + i % 3 * 0.65;
    plot(radius * Math.cos(orbit), 12.15 + 2.6 * Math.sin(orbit),
      1.4 * Math.sin(orbit * 2), glow > 0.75 ? 43 : 46, 229, 0);
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  let previous = -1;
  for (let i = 0; i < glyphs.length; i++) {
    if (!glyphs[i]) continue;
    if (ink[i] !== previous) {
      previous = ink[i];
      ctx.fillStyle = colors[previous];
    }
    ctx.fillText(String.fromCharCode(glyphs[i]),
      (i % columns) * cellWidth, Math.floor(i / columns) * cellHeight);
  }
}

function tick(timestamp) {
  if (lastFrame === null) lastFrame = timestamp;
  const delta = timestamp - lastFrame;
  if (delta >= 32) {
    elapsed += Math.min(delta, 100) / 1000;
    lastFrame = timestamp;
    draw();
  }
  scheduled = requestAnimationFrame(tick);
}

function setPaused(next) {
  paused = next;
  button.textContent = paused ? "재생" : "일시정지";
  if (scheduled !== null) cancelAnimationFrame(scheduled);
  scheduled = null;
  lastFrame = null;
  if (!paused) scheduled = requestAnimationFrame(tick);
}

button.addEventListener("click", () => setPaused(!paused));
motion.addEventListener("change", (event) => setPaused(event.matches));
new ResizeObserver(resize).observe(canvas);
resize();
setPaused(paused);
