// Native Canvas raster comparison. Install @napi-rs/canvas outside the app and
// set CANVAS_MODULE to its absolute directory. No production dependency added.
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const {performance} = require("node:perf_hooks");
const {createCanvas} = require(process.env.CANVAS_MODULE || "@napi-rs/canvas");
const baseline = "ccd910183fccaab1f4ef4e969278edb34e210d4e";
const old = file => execFileSync("git", ["show", baseline + ":" + file], {maxBuffer: 8e6});
for (const file of ["geometry.js", "christmas_tree_3d.py", "santa.js"])
  assert.equal(require("node:crypto").createHash("sha256").update(fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n")).digest("hex"),
    require("node:crypto").createHash("sha256").update(old(file).toString().replace(/\r\n/g,"\n")).digest("hex"),
    file + " must remain identical (normalizing Git checkout line endings)");

function setup(width, height, before, isolated) {
  const canvas = createCanvas(width, height), events = {};
  canvas.getBoundingClientRect = () => ({width, height});
  const controls = {};
  for (const id of ["#toggle", "#replay", "#time"])
    controls[id] = {setAttribute() {}, addEventListener(e, fn) { events[id + e] = fn; }};
  controls["#scene"] = canvas;
  const document = {hidden: false, querySelector: id => controls[id], addEventListener(e, fn) {events[e] = fn;}};
  let frame = null;
  const scope = vm.createContext({document, devicePixelRatio: 1,
    matchMedia: () => ({matches: false, addEventListener() {}}),
    ResizeObserver: class {observe() {}},
    requestAnimationFrame(fn) {frame = fn; return 1;}, cancelAnimationFrame() {frame = null;},
  });
  const files = ["geometry.js", "village.js", "santa.js", "scene.js"];
  for (const file of files) {
    const content = isolated && ["village.js", "santa.js"].includes(file)
      ? (file === "village.js" ? "function drawVillage() {}" : "function drawSanta() {}")
      : (before ? old(file).toString() : fs.readFileSync(file, "utf8"));
    vm.runInContext(content, scope);
  }
  return {scope, canvas, document, events, get frame() {return frame;},
    draw(t) {vm.runInContext(`elapsed=${t};draw()`, scope);},
    pixels() {return Buffer.from(canvas.getContext("2d").getImageData(0, 0, width, height).data);},
    cells() {return JSON.parse(vm.runInContext(`JSON.stringify(Array.from(view.depth, (d,i)=>
      [d,view.glyphs[i],view.ink[i],view.opacity[i],view.bloom[i]]))`, scope));},
  };
}

for (const [width,height] of [[320,381],[390,464],[756,900]]) {
  const oldTree = setup(width,height,true,true), newTree = setup(width,height,false,true);
  const oldScene = setup(width,height,true,false), newScene = setup(width,height,false,false);
  let protectedCells = 0;
  for (const time of [0,2,4,7,9.6,10.7,12,14.5,20.1,42]) {
    oldTree.draw(time); newTree.draw(time);
    assert.deepEqual(newTree.pixels(), oldTree.pixels(), `Tree pixels changed at ${width}, ${time}`);
    assert.deepEqual(newTree.cells(), oldTree.cells(), "Tree glyph/RGB/depth/opacity/bloom changed");
    oldScene.draw(time); newScene.draw(time);
    const before = oldScene.cells(), after = newScene.cells();
    for (let i=0;i<before.length;i++) if(before[i][0] !== null && before[i][0] > -4 && before[i][0] < 6) {
      assert.deepEqual(after[i],before[i],`Environment altered tree cell ${i}`);
      protectedCells++;
    }
  }
  assert.equal(vm.runInContext("villageBuilds",newScene.scope),1,"Cache rebuilds per frame");
  newScene.events["#toggleclick"](); assert.equal(newScene.frame,null,"Pause must stop frames");
  newScene.events["#toggleclick"](); assert(newScene.frame);
  newScene.document.hidden=true; newScene.events.visibilitychange(); assert.equal(newScene.frame,null);
  newScene.document.hidden=false; newScene.events.visibilitychange(); assert(newScene.frame);
  for (const [label,scene] of [["before",oldScene],["after",newScene]]) {
    const samples=[];
    for(let i=0;i<35;i++) {const start=performance.now(); scene.draw(15+i/30); if(i>=5)samples.push(performance.now()-start);}
    samples.sort((a,b)=>a-b);
    console.log(`${width}x${height} ${label}: median=${samples[15].toFixed(2)}ms p95=${samples[28].toFixed(2)}ms`);
  }
  if(process.env.VISUAL_OUTPUT) {
    oldScene.draw(15); newScene.draw(15);
    for(const [label,scene] of [["before",oldScene],["after",newScene]])
      fs.writeFileSync(require("node:path").join(process.env.VISUAL_OUTPUT,`${label}-${width}.png`),scene.canvas.toBuffer("image/png"));
  }
  console.log(`${width}x${height}: exact tree pixels across 10 times; ${protectedCells} protected scene cells passed`);
}
