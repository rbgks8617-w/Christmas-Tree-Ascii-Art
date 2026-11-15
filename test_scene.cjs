const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=["geometry.js","village.js","santa.js","scene.js"].map(file=>fs.readFileSync(file,"utf8")).join("\n");
function inspectAnimation(){
 const trunk=[],star=[],gifts=[];
 for(let i=0;i<model.length;i+=9){
  if(model[i+8]===8)trunk.push(i);
  if(model[i+8]===6)star.push(i);
  if(model[i+8]===5)gifts.push(i);
 }
 if(Math.max(...trunk.map(i=>model[i+1]))<3000)throw Error("Short trunk");
 if(trunk.some(i=>!animatePoint(i,0)))throw Error("Trunk missing");
 if(star.some(i=>model[i+3]!==42))throw Error("Star rays remain");
 const sp=star[0];
 if(!(animatePoint(sp,10.7)[1]>animatePoint(sp,12)[1]&&animatePoint(sp,12)[1]>animatePoint(sp,14)[1]))throw Error("Star descent");
 const gp=gifts[100],born=model[gp+7]/100+((gp/9*.61803398875)%1)*.9;
 const early=animatePoint(gp,born+.3),settled=animatePoint(gp,born+2.2);
 if(!(early[4]>0&&early[4]<1&&settled[4]===1))throw Error("Particle fade");
 if(early.slice(0,3).some((v,i)=>v!==settled[i]))throw Error("Particles must stay at their final position");
 let unseen=false; for(let i=0;i<model.length;i+=9){if(model[i+8]!==2)continue;const point=animatePoint(i,6);if(!point)unseen=true;else if(unseen)throw Error("Ribbon ordering");}
 if(!animatePoint(gp,20.1))throw Error("Tree resets");
}
for(const [width,height,reduced] of [[444,530,false],[360,429,false],[756,900,true]]){
 let commands=[],callback=null;const events={},elements={};
 const ctx={globalAlpha:1,save(){},restore(){},beginPath(){},rect(){},clip(){},setTransform(){},measureText(){return {width:height/145*.91*.6}},fillRect(){commands=[]},fillText(char,x,y){
  assert(char.charCodeAt(0)>=32&&char.charCodeAt(0)<=126);
  assert(Number.isFinite(x)&&x>=0&&x<width&&y>=0&&y<height);
  assert(this.globalAlpha>=0&&this.globalAlpha<=1);
  commands.push({char,x,y,color:this.fillStyle,alpha:this.globalAlpha});
 }};
 for(const id of ["#toggle","#replay","#time"])elements[id]={setAttribute(){},addEventListener(e,fn){events[id+e]=fn}};
 elements["#scene"]={getContext:()=>ctx,getBoundingClientRect:()=>({width,height})};
 const doc={hidden:false,querySelector:id=>elements[id],addEventListener(e,fn){events[e]=fn}};
 const env=vm.createContext({document:doc,devicePixelRatio:2,matchMedia:()=>({matches:reduced,addEventListener(){}}),
 ResizeObserver:class{observe(){}},requestAnimationFrame(fn){callback=fn;return 1},cancelAnimationFrame(){callback=null}});
 vm.runInContext(source,env);
 assert.equal(vm.runInContext("elapsed",env),reduced?15:0);
 if(reduced)assert.equal(callback,null);
 vm.runInContext("("+inspectAnimation.toString()+")()",env);
 for(const time of [0,4,9.6,12,14.5,20.1]){
  vm.runInContext("elapsed="+time+";draw()",env);assert(commands.length>500);
 }
 events["#replayclick"]();assert.equal(vm.runInContext("elapsed",env),0);
 console.log(width+"x"+height+" trunk, particles, star, persistent tree passed");
}

{
 const scope=vm.createContext({});
 vm.runInContext(fs.readFileSync("village.js","utf8")+fs.readFileSync("santa.js","utf8"),scope);
 const capture=(name,time)=>{
  scope.output=[];
  vm.runInContext(name+"({columns:260,rows:145},"+time+",(...point)=>output.push(point))",scope);
  return JSON.parse(JSON.stringify(scope.output));
 };
 const village=capture("drawVillage",0);
 assert(village.filter(p=>p[2]==="~").length>=15,"Chimney smoke");
 assert(village.every(p=>p[4]<0),"Scenery stays behind the tree");
 assert.notDeepEqual(village,capture("drawVillage",2),"Windows and smoke animate");
 const first=capture("drawSanta",12), later=capture("drawSanta",14);
 assert(first.length>50 && later.length>50);
 assert(later[0][0]<first[0][0],"Santa travels right to left");
 assert.equal(capture("drawSanta",22).length,0,"Flight has a rest interval");
 console.log("Village smoke, depth, changing lights and Santa flight passed");
}
