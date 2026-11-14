const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
function element() {
 return {textContent:"", value:"", hidden:false, disabled:false, children:[], events:{}, attributes:{},
  scrollTop:0,scrollHeight:100,clientHeight:100,
  addEventListener(name,fn){this.events[name]=fn},
  setAttribute(name,value){this.attributes[name]=value},
  append(...nodes){this.children.push(...nodes)},
  replaceChildren(...nodes){this.children=nodes}, remove(){}};
}
function musicEnv(protocol="https:") {
 const ids=["music-toggle","music-panel","music-status","music-mount","music-volume","volume-value"];
 const elements=Object.fromEntries(ids.map(id=>["#"+id,element()]));
 let options,state=-1,volume,stored="23",plays=0,pauses=0,seeks=0;
 const events={},window={location:{protocol,origin:"https://example.com"}};
 const player={getIframe:element,setVolume(v){volume=v},mute(){},unMute(){},
   playVideo(){plays++},pauseVideo(){pauses++},seekTo(){seeks++},destroy(){},getPlayerState:()=>state};
 const YT={PlayerState:{PLAYING:1,PAUSED:2,BUFFERING:3,ENDED:0},Player:function(id,opts){options=opts;return player}};
 const context=vm.createContext({window,document:{querySelector:id=>elements[id],createElement:element,
  addEventListener:(name,fn)=>events[name]=fn,head:{append(){}}},
  localStorage:{getItem:()=>stored,setItem:(key,value)=>stored=value},setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(fs.readFileSync("music.js","utf8"),context);
 return {elements, events, plays:()=>plays,pauses:()=>pauses,seeks:()=>seeks,volume:()=>volume,
  stored:()=>stored,options:()=>options,
  load(){context.YT=YT;window.YT=YT;window.onYouTubeIframeAPIReady();options.events.onReady({target:player})},
  event(name,data){state=data;options.events[name]({target:player,data})}};
}
const music=musicEnv();
assert.equal(music.elements["#music-toggle"].disabled,true,"Loads without a click");
music.load();assert.equal(music.plays(),1);assert.equal(music.volume(),23);
assert.equal(music.options().playerVars.loop,1);
music.elements["#music-volume"].value="8";music.elements["#music-volume"].events.input();
assert.equal(music.volume(),8);assert.equal(music.stored(),"8");
music.event("onAutoplayBlocked");music.events.pointerdown({target:element()});assert.equal(music.plays(),2);
music.event("onStateChange",1);music.event("onStateChange",0);assert.equal(music.seeks(),1);
music.event("onStateChange",1);music.elements["#music-toggle"].events.click();assert.equal(music.pauses(),1);
music.event("onError",150);const count=music.plays();music.events.pointerdown({target:element()});assert.equal(music.plays(),count);
assert.equal(music.elements["#music-toggle"].disabled,false);
console.log("Autoplay attempt, gesture fallback, volume, repeat, pause and embed denial passed");

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
