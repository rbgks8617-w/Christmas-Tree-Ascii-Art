"use strict";

// Environment only. One bounded cache; the tree's model, palette and projection
// remain owned by scene.js. Depths stay below -6 (Santa uses -5).
const villagePalette = {
  sky: [20, 37, 58], timber: [194, 117, 61], shadow: [80, 56, 46],
  plaster: [244, 213, 166], window: [255, 208, 121], red: [239, 63, 77],
  green: [52, 170, 91], gold: [250, 193, 83], snow: [238, 244, 250],
};
let villageCache = null;
let villageBuilds = 0;

function buildVillage(view) {
  const w = view.columns, h = view.rows, mobile = view.width <= 480;
  const cells = new Map(), lights = [], chimneys = [];
  const tint = (color, strength) => color.map(c => Math.round(c * strength));
  const p = villagePalette;
  const point = (x, y, char, color, depth) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const key = y * w + x, old = cells.get(key);
    if (!old || depth >= old.depth) cells.set(key, {x, y, char, color, depth});
  };
  const line = (x, y, text, color, depth) => {
    for (let i = 0; i < text.length; i++)
      if (text[i] !== " ") point(x + i, y, text[i], color, depth);
  };
  const lamp = (x, y, char, color, depth, phase, strength = 1, glow = true) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    lights.push({x: Math.round(x), y: Math.round(y), char, color: tint(color, strength),
      depth, phase, speed: .37 + (phase % 5) * .08, glow, ink: [0, 0, 0]});
  };

  // Distant cool contours and a quiet crescent. No full-canvas color adjustment.
  for (let x = 0; x < w; x++) {
    const y = 63 + Math.sin(x * .037) * 5 + Math.sin(x * .071) * 2;
    point(x, y, "_", [47, 67, 86], -12);
    if (x % 2 === 0) point(x, y + 2, ".", [32, 51, 73], -12);
  }
  for (let y = -5; y <= 5; y++) for (let x = -6; x <= 6; x++) {
    if (x*x/36 + y*y/25 < 1 && (x-3)**2/36 + (y+1)**2/25 > 1)
      point(w*.84+x, 13+y, ":", [172, 188, 192], -11);
  }
  for (let i = 0; i < 55; i++)
    lamp((i*73+19)%w, (i*17+3)%43, i%9 ? "." : "+", [109,137,163], -13, i*.8, .8, false);
  for (let i = 0; i < 17; i++) {
    const x = i*w/16, y = 60 + Math.sin(i*2)*4;
    for (let r = 0; r < 7; r++)
      line(x-r, y+r, "/"+":".repeat(r*2)+String.fromCharCode(92), [37,69,65], -10);
  }

  // Rear shops first; near corner buildings frame the central clearing.
  const buildings = [
    {u:.40, top:58, half:10, roof:12, wall:15, shade:.39, depth:-9.8},
    {u:.61, top:55, half:11, roof:14, wall:17, shade:.43, depth:-9.5},
    {u:.23, top:53, half:16, roof:19, wall:25, shade:.57, depth:-8.8},
    {u:.78, top:49, half:17, roof:21, wall:27, shade:.60, depth:-8.5},
    {u:.035, top:43, half:26, roof:26, wall:38, shade:.72, depth:-7.5},
    {u:.97, top:47, half:28, roof:24, wall:37, shade:.68, depth:-7.2},
  ];
  buildings.forEach((house, index) => {
    const cx = Math.round(w*house.u), top = house.top;
    const half = Math.max(8, Math.round(house.half*w/225));
    const {roof, wall, depth} = house;
    // Small glyphs lose coverage on phones: lift environment midtones only,
    // while retaining deep recesses and the distance ordering of the houses.
    const shade = Math.min(.94, house.shade * (mobile ? 1.25 : 1.12));
    const eave = top+roof, bottom = eave+wall;
    const beam = tint(p.timber, shade), dark = tint(p.shadow, house.shade*.72);
    const cream = tint(p.plaster, shade*.90), snow = tint(p.snow, shade);
    const ridge = cx + (index%2 ? 3 : -2);
    // A solid, shadowed side wall establishes volume beyond the front facade.
    for (let y = eave+2; y < bottom; y++) for (let x = cx+half; x < cx+half+5; x++)
      point(x, y, y%5 ? ":" : "=", dark, depth-.1);
    for (let y = 0; y <= roof; y++) {
      const left = Math.round(ridge+(cx-half-ridge)*y/roof);
      const right = Math.round(ridge+(cx+half-ridge)*y/roof);
      for (let x = left; x <= right; x++) {
        const edge = x-left < 2 || right-x < 2;
        const strut = Math.abs(x-ridge)<1 || y%7===0;
        if (edge || strut || (x+y)%2===0)
          point(x, top+y, edge ? "#" : strut ? "=" : ":", edge ? snow : strut ? beam : cream, depth);
      }
      // Snow caps on both steep roof slopes, green trim immediately beneath.
      point(left+2, top+y, "*", tint(p.green, shade), depth+.01);
      point(right-2, top+y, "*", tint(p.green, shade), depth+.01);
      if (y% (mobile ? 4 : 3) === 0) {
        lamp(left+2, top+y, "+", p.gold, depth+.02, index*7+y, shade*.8);
        lamp(right-2, top+y, "+", p.gold, depth+.02, index*9+y, shade*.8);
      }
    }
    for (let y = eave; y <= bottom; y++) for (let x = cx-half; x <= cx+half; x++) {
      const local = x-(cx-half), row = y-eave;
      const horizontal = row===0 || row===wall || row===Math.floor(wall*.48);
      const vertical = local%Math.max(6, Math.round(half/2))===0;
      const diagonal = row<wall*.48 && (local+row)%Math.max(12,half)===0;
      if (!horizontal && !vertical && !diagonal && (local+row)%(mobile ? 3 : 2)!==0) continue;
      point(x,y,horizontal ? "=" : vertical ? "|" : diagonal ? "/" : mobile ? "=" : ":",
        horizontal || vertical || diagonal ? beam : cream,depth);
    }
    const windowWidth = half>=17 ? 7 : 5;
    const windowRows = wall>22 ? [eave+4,eave+Math.floor(wall*.55)] : [eave+4];
    windowRows.forEach((wy, rowIndex) => {
      for (const side of [-1,1]) {
        const wx = cx+side*Math.round(half*.53)-Math.floor(windowWidth/2);
        for (let y = -1; y <= 7; y++) for (let x = -1; x <= windowWidth; x++) {
          if (y===-1 || y===7 || x===-1 || x===windowWidth)
            point(wx+x,wy+y,":",tint([180,116,61],shade*.68),depth+.05);
          else if (y===0 || y===6 || x===0 || x===windowWidth-1 || y===3 || x===Math.floor(windowWidth/2))
            point(wx+x,wy+y,y===3 ? "+" : "|",dark,depth+.1);
          else lamp(wx+x,wy+y,x===1 ? ":" : "#",x===1 ? [238,154,67] : p.window,
            depth+.1,index*4+rowIndex+side*.3,Math.min(.92,shade*1.25), y===2 && x===1);
        }
        line(wx-1,wy+7,"*".repeat(windowWidth+2),tint(p.green,shade),depth+.2);
        point(wx+1,wy+7,"@",tint(p.red,shade),depth+.3);
      }
    });
    // Recessed door, garland and a wreath with a red bow.
    for(let y=bottom-9;y<bottom;y++) line(cx-2,y,"|:::|",dark,depth+.2);
    line(cx-3,bottom-10,"**+****",tint(p.green,shade),depth+.3);
    line(cx-1,bottom-7,"(O)",tint(p.green,shade*1.1),depth+.3);
    point(cx,bottom-8,"@",tint(p.red,shade),depth+.4);
    point(cx+1,bottom-3,"*",tint(p.gold,shade),depth+.4);
    // A snowy chimney and phase-shifted particles.
    const chimneyX = cx+Math.floor(half*.45), chimneyY = top+Math.floor(roof*.25)-6;
    for(let y=0;y<8;y++) line(chimneyX,chimneyY+y,y===0 ? "####" : y%2 ? "|==|" : "|::|",
      y===0 ? snow : beam,depth+.5);
    chimneys.push({x:chimneyX+2,y:chimneyY,phase:index*1.87,depth:depth+.4,shade});
    // Decorated mini firs and planters, anchored beside the entrance.
    for(const side of [-1,1]) {
      const x=cx+side*5;
      for(let r=0;r<5;r++) line(x-r,bottom-5+r,"/"+"*".repeat(r*2)+String.fromCharCode(92),tint(p.green,shade),depth+.3);
      line(x-2,bottom,"[===]",tint(p.red,shade),depth+.4);
      if(!mobile) lamp(x,bottom-5,"+",p.gold,depth+.5,index+side,shade*.7);
    }
    line(cx-half,bottom+1,"_".repeat(half*2+2),snow,depth+.5);
  });

  // The path bends toward the clearing; existing rug and gifts stay in front.
  for(let i=0;i<26;i++) {
    const y=96+i, x=w*.5+Math.sin(i*.09)*i;
    point(x-i*.7,y,".",[94,114,132],-9);
    point(x+i*.7,y,".",[94,114,132],-9);
  }
  for(const u of [.15,.85]) {
    const x=Math.round(w*u), y=97;
    line(x-2,y," /_\\ ",p.timber,-6.8);
    line(x-2,y+1,"| : |",p.shadow,-6.8);
    lamp(x,y+1,"#",p.window,-6.7,u*10,.85);
    line(x-2,y+2,"'==='",p.gold,-6.8);
    for(let r=3;r<15;r++) point(x,y+r,"|",p.timber,-6.8);
    line(x-2,y+15,"__|__",p.shadow,-6.8);
    for(let i=-13;i<=13;i+=3) {
      line(x+i,115,"+--",tint(p.snow,.65),-6.6);
      line(x+i,116,"|--",tint(p.timber,.8),-6.6);
      point(x+i,117,"|",p.shadow,-6.6);
    }
  }
  villageBuilds++;
  return {key: `${w}:${h}:${mobile}`, points:[...cells.values()], lights, chimneys, mobile};
}

function drawVillage(view, time, put) {
  const key = `${view.columns}:${view.rows}:${view.width <= 480}`;
  if (!villageCache || villageCache.key !== key) villageCache = buildVillage(view);
  const {points,lights,chimneys,mobile} = villageCache;
  for (const p of points) put(p.x,p.y,p.char,p.color,p.depth);
  for (const light of lights) {
    const strength=.94+.06*Math.sin(time*light.speed+light.phase);
    for(let c=0;c<3;c++) light.ink[c]=Math.round(light.color[c]*strength);
    put(light.x,light.y,light.char,light.ink,light.depth,light.glow);
  }
  for(const chimney of chimneys) for(let i=0;i<(mobile ? 4 : 6);i++) {
    const age=(time*(.55+chimney.phase*.017)+i*2.1+chimney.phase)%13;
    const fade=(1-age/13)*chimney.shade;
    const shade=Math.round(40+100*fade);
    put(Math.round(chimney.x+Math.sin(age*.47+chimney.phase)*(1+age*.13)),
      Math.round(chimney.y-1-age),"~",[shade,shade+4,shade+7],chimney.depth);
  }
}
