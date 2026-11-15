const fs=require("node:fs"), vm=require("node:vm"), assert=require("node:assert/strict");
function test(width,height,sceneHeight,safeBottom=10) {
  const events={}, values={}, callbacks=[];
  let scroll=0;
  const input={addEventListener(name,fn){events[name]=fn;}};
  const panel={style:{setProperty(key,value){values[key]=value;},removeProperty(key){delete values[key];}}};
  const form={getBoundingClientRect(){return {bottom:sceneHeight+parseFloat(values["--chat-available-height"]||320)-scroll};}};
  const viewport={height,offsetTop:0,scale:1,addEventListener(name,fn){events["visual"+name]=fn;}};
  const media={matches:width<=760,addEventListener(name,fn){events["media"+name]=fn;}};
  const document={activeElement:null,querySelector(id){return {
    "#chat-panel":panel,"#chat-form":form,"#chat-input":input,
    main:{getBoundingClientRect:()=>({height:sceneHeight})},
  }[id];}};
  const context=vm.createContext({document,matchMedia:()=>media,
    getComputedStyle:()=>({marginBottom:safeBottom+"px"}),
    requestAnimationFrame(fn){callbacks.push(fn);return callbacks.length;},
    window:{innerHeight:height,visualViewport:viewport,
      addEventListener(name,fn){events[name]=fn;},scrollBy({top}){scroll+=top;}},
  });
  const flush=()=>{while(callbacks.length)callbacks.shift()();};
  vm.runInContext(fs.readFileSync("chat-layout.js","utf8"),context);flush();
  if(!media.matches){assert(!values["--chat-available-height"]);return;}
  const normal=parseFloat(values["--chat-available-height"]);
  assert(normal>=180 && normal<=650);
  if(height-sceneHeight-safeBottom-10>=180)assert(normal+sceneHeight+safeBottom+10<=height);
  document.activeElement=input;events.focus();
  viewport.height=280;events.visualresize();events.resize();
  assert.equal(callbacks.length,1,"Coalesce keyboard resize events");flush();
  assert(form.getBoundingClientRect().bottom+12<=viewport.height,"Composer must clear keyboard");
  const keyboardHeight=values["--chat-available-height"];
  viewport.scale=2;events.visualresize();flush();assert(!values["--chat-available-height"],"Do not fight pinch zoom");
  viewport.scale=1;viewport.height=height;document.activeElement=null;events.blur();flush();
  assert.equal(parseFloat(values["--chat-available-height"]),normal);
  assert(keyboardHeight);
  console.log(`${width}x${height}: viewport height, keyboard visibility, zoom and blur passed`);
}
for(const args of [[320,568,335],[390,844,498,34],[430,932,512,34],[760,390,230],[1280,800,800]])test(...args);
