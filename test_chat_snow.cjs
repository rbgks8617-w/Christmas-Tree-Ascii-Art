const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
let words = [], outlines = [], composites = 0;
const pen = {setTransform(){},clearRect(){words=[];outlines=[];},save(){},restore(){},fillRect(){},
  measureText(text){return {width:Array.from(text).length*7};},
  strokeText(text,x,y){outlines.push({text,x,y});},
  fillText(text,x,y){words.push({text,x,y});}};
const target = {save(){},restore(){},drawImage(){composites++;}};
const scope = vm.createContext({devicePixelRatio:1, Intl,
  document:{createElement(){return {getContext(){return pen;}};}}});
vm.runInContext(fs.readFileSync('chat-snow.js','utf8'),scope);
vm.runInContext('Math.random=()=>.25',scope);
const effect = vm.runInContext('chatSnow',scope);
const view={width:320,height:400,rows:100,columns:80,cellHeight:4,cellWidth:4,
  depth:new Float32Array(8000).fill(-Infinity), opacity:new Float32Array(8000).fill(1),
  bloom:new Uint8Array(8000)};
view.depth.fill(0,25*80,26*80); // Synthetic solid tree branch at y=100.
const unchanged = Buffer.from(view.depth.buffer).toString('hex');
effect.update([{text:'Happy Christmas'}]);
effect.draw(target,view,0); effect.draw(target,view,5); effect.draw(target,view,9);
assert.equal(words.length,1,'One falling message on mobile');
assert.deepEqual(outlines,words,'Falling text has a contrasting outline');
assert(words[0].text.includes('Happy'),'Public message is visible before collision');
effect.draw(target,view,10);
assert.equal(words.length,18,'Tree contact must produce mobile particle burst');
assert.deepEqual(outlines,words,'Every impact fragment has a contrasting outline');
assert(words.every(word=>!word.text.includes('Happy')),'Whole message disappears on impact');
effect.draw(target,view,10.5);
const frozen=JSON.stringify(words);
effect.draw(target,view,10.5);
assert.equal(JSON.stringify(words),frozen,'Paused scene time freezes particles');
effect.update([]);
const count=composites;
effect.draw(target,view,10.6);
assert.equal(composites,count,'Deleted messages and fragments disappear');
assert.equal(Buffer.from(view.depth.buffer).toString('hex'),unchanged,'Tree depth remains unchanged');
effect.update([{text:'New snow'}]);
effect.draw(target,view,0); // Replay resets old particles.
effect.draw(target,view,5); effect.draw(target,view,6);
assert.equal(words.length,1);
assert(words[0].text.includes('New'),'Replay uses current snapshot');
view.width=756; view.cellWidth=756/80;
effect.draw(target,view,0); effect.draw(target,view,5); effect.draw(target,view,9); effect.draw(target,view,10);
assert.equal(words.length,28,'Desktop collision produces 28 particles');
console.log('Chat snow: visible message, tree collision, mobile/desktop particles, pause, deletion, replay and unchanged depth passed');
