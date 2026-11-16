"use strict";

// Decorative excerpts only: reuse the public chat snapshot, never fetch or store it.
const chatSnow = (() => {
  let pool = [], flakes = [], previousText = "", lastTime = null, nextAt = null;
  let layer, pen;
  const segmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("ko", {granularity: "grapheme"}) : null;
  const letters = text => segmenter
    ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);
  function update(messages) {
    pool = [...new Set(messages.slice(-100).map(message =>
      typeof message.text === "string" ? message.text.replace(/\s+/gu, " ").trim() : ""
    ).filter(Boolean))];
    flakes = flakes.filter(flake => pool.includes(flake.source));
  }
  function draw(target, view, time) {
    if (lastTime !== null && time < lastTime) {
      flakes = []; nextAt = null;
    }
    lastTime = time;
    if (!pool.length) { flakes = []; nextAt = null; return; }
    if (nextAt === null) nextAt = time + 4 + Math.random() * 3;
    const mobile = view.width < 500, limit = mobile ? 1 : 2;
    flakes = flakes.filter(flake => flake.burstAt !== undefined
      ? time - flake.burstAt < 1.6 : time - flake.born < flake.duration).slice(-limit);
    if (time >= nextAt && flakes.length < limit) {
      const choices = pool.filter(text => text !== previousText);
      const candidates = choices.length ? choices : pool;
      const source = candidates[Math.floor(Math.random() * candidates.length)];
      previousText = source;
      flakes.push({source, born: time, duration: 16 + Math.random() * 5,
        lane: Math.random(), seed: Math.random() * Math.PI * 2});
      nextAt = time + 7 + Math.random() * 5;
    }
    if (!flakes.length) return;
    if (!layer) { layer = document.createElement("canvas"); pen = layer.getContext("2d"); }
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(view.width * ratio), height = Math.round(view.height * ratio);
    if (layer.width !== width || layer.height !== height) { layer.width = width; layer.height = height; }
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.clearRect(0, 0, view.width, view.height);
    pen.save();
    pen.font = `${mobile ? 12 : 15}px "Malgun Gothic", monospace`;
    pen.textBaseline = "middle";
    pen.strokeStyle = "#14253a";
    pen.lineWidth = 3;
    pen.lineJoin = "round";
    pen.fillStyle = "#e4eaf0";
    for (const flake of flakes) {
      if (flake.burstAt !== undefined) { drawBurst(flake, time); continue; }
      const age = (time - flake.born) / flake.duration;
      const parts = letters(flake.source);
      const maxWidth = view.width * (mobile ? .44 : .36);
      let excerpt = parts.slice(0, mobile ? 12 : 22).join("");
      let shortened = parts.length > (mobile ? 12 : 22);
      while (pen.measureText("❄ " + excerpt + (shortened ? "…" : "")).width > maxWidth && excerpt) {
        const units = letters(excerpt); units.pop(); excerpt = units.join(""); shortened = true;
      }
      const text = "❄ " + excerpt + (shortened ? "…" : "");
      const textWidth = pen.measureText(text).width;
      const drift = Math.sin(age * 5 + flake.seed) * 7;
      const x = Math.max(4, Math.min(view.width - textWidth - 4,
        8 + flake.lane * (view.width - textWidth - 16) + drift));
      const y = -16 + age * (view.height + 32);
      // Sweep the bottom edge since the previous frame to avoid skipping a thin branch.
      const top = Math.max(0, Math.floor((Math.min(flake.lastY ?? y, y) - 8) / view.cellHeight));
      const bottom = Math.min(view.rows - 1, Math.floor((y + 8) / view.cellHeight));
      const left = Math.max(0, Math.floor(x / view.cellWidth));
      const right = Math.min(view.columns - 1, Math.floor((x + textWidth) / view.cellWidth));
      let hit = null;
      for (let row = top; row <= bottom && !hit; row++) {
        for (let col = left; col <= right; col++) {
          const index = row * view.columns + col;
          if (view.depth[index] > -4 && view.depth[index] < 6 && view.opacity[index] > .1) {
            hit = {x: col * view.cellWidth, y: row * view.cellHeight}; break;
          }
        }
      }
      flake.lastY = y;
      if (hit) {
        flake.burstAt = time;
        // A few letter fragments mixed with tiny snow sparks; no change to the tree.
        const fragments = letters(excerpt).filter(letter => letter.trim()).slice(0, mobile ? 8 : 12);
        flake.particles = Array.from({length: mobile ? 18 : 28}, (_, i) => {
          const angle = Math.PI + Math.random() * Math.PI;
          const speed = 28 + Math.random() * 60;
          return {glyph: fragments[i] || (i % 3 ? "." : "*"),
            x: x + textWidth * (i + .5) / (mobile ? 18 : 28), y: Math.min(y, hit.y - 8),
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 10,
            gold: i % 4 === 0};
        });
        drawBurst(flake, time);
        continue;
      }
      pen.globalAlpha = .8 * Math.min(1, age * 8, (1 - age) * 5);
      pen.strokeText(text, x, y);
      pen.fillText(text, x, y);
    }
    // Do not mask nearby scenery: only an actual tree collision breaks a message.
    pen.restore();
    target.save();
    target.drawImage(layer, 0, 0, view.width, view.height);
    target.restore();
  }
  function drawBurst(flake, time) {
    const age = time - flake.burstAt;
    pen.save();
    pen.font = '11px "Malgun Gothic", monospace';
    pen.globalAlpha = .85 * (1 - age / 1.6) ** 2;
    for (const particle of flake.particles) {
      pen.fillStyle = particle.gold ? "#efd69b" : "#e4eaf0";
      const x = particle.x + particle.vx * age;
      const y = particle.y + particle.vy * age + 28 * age * age;
      pen.strokeText(particle.glyph, x, y);
      pen.fillText(particle.glyph, x, y);
    }
    pen.restore();
  }
  return {update, draw};
})();
