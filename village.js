"use strict";
// Stable screen-space scenery behind the rotating tree, in the shared depth buffer.
function drawVillage(view, time, put) {
  const {columns: w, rows: h} = view;
  const line = (x, y, text, color, depth=-8) => {
    for (let i=0;i<text.length;i++) if(text[i]!==" ") put(Math.round(x+i),Math.round(y),text[i],color,depth);
  };
  for(let y=-4;y<=4;y++) for(let x=-5;x<=5;x++) {
    if(x*x/25+y*y/16<=1 && (x-2)*(x-2)/25+(y+1)*(y+1)/16>1)
      put(Math.round(w*.82+x),12+y,"*",[185,194,192],-11);
  }
  for(let i=0;i<65;i++) {
    const x=(i*73+19)%w, y=(i*17+3)%45;
    put(x,y,i%7 ? "." : "+",[100+35*Math.sin(time*.5+i),115,145],-12);
  }
  for(let x=0;x<w;x++) {
    const y=70+Math.sin(x*.045)*5;
    put(x,Math.round(y),".",[65,83,101],-10);
  }
  for(let i=0;i<14;i++) {
    const x=i*w/13, y=72+Math.sin(i*2)*5;
    for(let j=0;j<5;j++) line(x-j,y+j,"/"+".".repeat(j*2)+String.fromCharCode(92),[48,81,73],-9);
  }
  const houses=[[.06,87,6],[.22,77,5],[.38,72,4],[.64,74,5],[.80,82,7],[.96,94,6]];
  houses.forEach(([u,y,size],i)=>{
    const x=Math.round(u*w), glow=150+20*Math.sin(time*.7+i*2);
    for(let r=0;r<size;r++) {
      line(x-r,y+r,"/"+"_".repeat(r*2)+String.fromCharCode(92),[157,175,185]);
    }
    for(let r=0;r<size+3;r++) {
      line(x-size+1,y+size+r,"|"+" ".repeat(size*2-2)+"|",[110,91,84]);
      if(r===2 || r===3) {
        line(x-size+3,y+size+r,"##",[glow+35,glow,75]);
        line(x+1,y+size+r,"##",[glow+35,glow,75]);
      }
      if(r>size-1) line(x-1,y+size+r,"|_|",[125,102,80]);
    }
    line(x-size,y+size*2+3,"_".repeat(size*2+2),[170,185,194]);
    line(x+2,y-1,"||",[123,108,102]);
    line(x+2,y,"||",[123,108,102]);
    for(let p=0;p<5;p++) {
      const age=(time*.8+p*1.7+i)%9;
      const shade=100-age*6;
      put(Math.round(x+3+Math.sin(age*.65+i)*2),Math.round(y-2-age),"~",[shade,shade+5,shade+10],-8.5);
    }
  });
  for(let i=0;i<35;i++) {
    const y=100+i*.8, x=w*.5+Math.sin(i*.1)*i*.8;
    line(x,y,".   .",[86,94,108],-7);
  }
  for(const u of [.12,.88]) {
    const x=Math.round(u*w);
    line(x-1,100,"(*)",[224,186,96],-6);
    for(let y=101;y<114;y++) line(x, y,"|",[115,119,128],-6);
    for(let i=-9;i<10;i+=3) {
      line(x+i,117,"+--",[159,166,171],-6);
      line(x+i,118,"|",[109,118,124],-6);
    }
  }
}
