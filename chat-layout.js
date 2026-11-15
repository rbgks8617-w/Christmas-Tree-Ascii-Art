"use strict";

// Keep the composer visible when mobile browser chrome or the keyboard changes
// the visual viewport. The canvas retains its original size and aspect ratio.
(() => {
  const panel = document.querySelector("#chat-panel");
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const scene = document.querySelector("main");
  const mobile = matchMedia("(max-width: 760px)");
  const viewport = window.visualViewport;
  let scheduled = null, reveal = false;

  function update() {
    scheduled = null;
    if (!mobile.matches || (viewport && viewport.scale !== 1)) {
      panel.style.removeProperty("--chat-available-height");
      reveal = false;
      return;
    }
    const focused = document.activeElement === input;
    const height = viewport ? viewport.height : window.innerHeight;
    const sceneHeight = focused ? 0 : scene.getBoundingClientRect().height;
    const safeBottom = parseFloat(getComputedStyle(panel).marginBottom) || 10;
    const available = Math.max(180, Math.min(650, height - sceneHeight - safeBottom - 10));
    panel.style.setProperty("--chat-available-height", available + "px");
    if (focused && reveal) {
      const bottom = form.getBoundingClientRect().bottom;
      const visibleBottom = (viewport ? viewport.offsetTop : 0) + height;
      const overflow = bottom + 12 - visibleBottom;
      if (overflow > 0) window.scrollBy({top: overflow, behavior: "instant"});
    }
    reveal = false;
  }
  function schedule(keepInputVisible = false) {
    reveal = reveal || keepInputVisible;
    if (scheduled === null) scheduled = requestAnimationFrame(update);
  }
  input.addEventListener("focus", () => schedule(true));
  input.addEventListener("blur", () => schedule());
  window.addEventListener("resize", () => schedule(true));
  viewport?.addEventListener("resize", () => schedule(true));
  mobile.addEventListener("change", () => schedule());
  schedule();
})();
