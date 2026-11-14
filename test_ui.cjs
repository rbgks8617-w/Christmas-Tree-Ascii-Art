const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
function element() {
 return {textContent:"", value:"", hidden:false, disabled:false, children:[], events:{}, attributes:{},
  scrollTop:0,scrollHeight:100,clientHeight:100,
  addEventListener(name,fn){this.events[name]=fn},
  setAttribute(name,value){this.attributes[name]=value},
  append(...nodes){this.children.push(...nodes)},
  replaceChildren(...nodes){this.children=nodes}, remove(){}};
}

(async()=>{
 const ids=["music-toggle","music-status","music-volume","volume-value","background-music"];
 const elements=Object.fromEntries(ids.map(id=>["#"+id,element()]));
 const events={}, audio=elements["#background-music"];
 let stored="23", plays=0, deny=true;
 audio.paused=true; audio.error=null;
 audio.play=async()=>{
   plays++;
   if(deny){const error=new Error("blocked");error.name="NotAllowedError";throw error;}
   audio.paused=false;audio.events.play();
 };
 audio.pause=()=>{audio.paused=true;audio.events.pause()};
 audio.load=()=>{audio.error=null};
 const context=vm.createContext({document:{querySelector:id=>elements[id],
   addEventListener:(name,fn)=>events[name]=fn},
   localStorage:{getItem:()=>stored,setItem:(key,value)=>stored=value}});
 vm.runInContext(fs.readFileSync("music.js","utf8"),context);
 await new Promise(setImmediate);
 assert.equal(plays,1,"Autoplay attempted at entry");
 assert.equal(audio.volume,.23);
 deny=false;events.pointerdown({target:element()});await new Promise(setImmediate);
 assert.equal(plays,2);assert.equal(audio.paused,false);
 elements["#music-volume"].value="8";elements["#music-volume"].events.input();
 assert.equal(audio.volume,.08);assert.equal(stored,"8");
 elements["#music-volume"].value="0";elements["#music-volume"].events.input();assert.equal(audio.muted,true);
 elements["#music-toggle"].events.click();assert.equal(audio.paused,true);
 events.pointerdown({target:element()});assert.equal(plays,2,"Do not resume manual pause");
 elements["#music-toggle"].events.click();await Promise.resolve();assert.equal(plays,3);
 audio.events.error();assert(elements["#music-status"].textContent.length>0);
 const html=fs.readFileSync("index.html","utf8");
 assert(html.includes('src="./assets/christmas.mp3" loop'));
 assert(!html.includes("music-player"));
 assert(!fs.readFileSync("music.js","utf8").includes("youtube"));
 console.log("Local audio, autoplay fallback, saved volume, mute, pause, replay and error passed");
})().catch(error=>{console.error(error);process.exitCode=1});
(async()=>{
 const ids=["chat-form","chat-input","chat-send","messages","chat-status"];
 const elements=Object.fromEntries(ids.map(id=>["#"+id,element()]));
 const messages=[], requests=[],window={addEventListener(){}};
 let offline=true, failPost=false;
 const context=vm.createContext({window,AbortController,crypto:{randomUUID:()=>"test-request-123"},
  document:{hidden:false,querySelector:id=>elements[id],createElement:element,
    createDocumentFragment:element,addEventListener(){}},
  setTimeout:()=>1,clearTimeout(){},
  async fetch(url,options){
   requests.push(options);
   if(offline)return {status:404,ok:false,headers:{get:()=>"text/html"}};
   if(options.method==="POST"){
    if(failPost)throw new Error("network lost");
    const sent=JSON.parse(options.body);
    messages.push({id:1,mine:true,text:sent.text});
    return {ok:true,headers:{get:()=>"application/json"},json:async()=>({id:1})};
   }
   return {ok:true,headers:{get:()=>"application/json"},json:async()=>({messages})};
  }});
 vm.runInContext(fs.readFileSync("chat.js","utf8"),context);
 await vm.runInContext("chatFlight",context);
 assert.equal(elements["#chat-send"].disabled,false,"Offline state must not lock the send button");
 elements["#chat-input"].value="<img src=x onerror=alert(1)>";
 await elements["#chat-form"].events.submit({preventDefault(){}});
 assert.equal(elements["#chat-status"].hidden,false);assert(elements["#chat-input"].value);
 offline=false;failPost=true;
 await elements["#chat-form"].events.submit({preventDefault(){}});
 assert(elements["#chat-input"].value,"Keep input after failure");
 const attempted=JSON.parse(requests.filter(r=>r.method==="POST").at(-1).body).requestId;
 failPost=false;await elements["#chat-form"].events.submit({preventDefault(){}});
 assert.equal(elements["#chat-input"].value,"");
 const retried=JSON.parse(requests.filter(r=>r.method==="POST").at(-1).body).requestId;
 assert.equal(retried,attempted,"Reuse request ID on retry");
 const item=elements["#messages"].children[0].children[0];
 assert.equal(item.children[1].textContent,"<img src=x onerror=alert(1)>");
 assert.equal(item.children[1].children.length,0,"User text is not HTML");
 assert.equal(elements["#chat-send"].disabled,false);
 console.log("Missing API, reconnect-on-send, retry identity, retained input and safe minimal chat passed");
})().catch(error=>{console.error(error);process.exitCode=1});
