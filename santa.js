"use strict";
function drawSanta(view, time, put) {
  const phase=(time+18)%30;
  if(phase>=8) return;
  const x=view.columns+5-phase/8*(view.columns+70);
  const y=19+Math.sin(time*2)*1.2;
  const line=(dx,dy,text,color)=>{
    for(let i=0;i<text.length;i++) if(text[i]!==" ") put(Math.round(x+dx+i),Math.round(y+dy),text[i],color,-5);
  };
  for(let r=0;r<3;r++) {
    const offset=r*12, bounce=Math.sin(time*7+r)*.5;
    line(offset, bounce,"Y Y",[180,153,111]);
    line(offset-2,1+bounce,"o(__)>",[185,155,111]);
    line(offset,2+bounce,Math.floor(time*8+r)%2 ? "/ /" : String.fromCharCode(92)+" "+String.fromCharCode(92),[183,151,105]);
    line(offset+6,2,"----",[125,107,91]);
  }
  line(-2,1, "*",[240,65+25*Math.sin(time*4),55]);
  line(39,-2," /^^",[215,65,66]);
  line(39,-1," (o)",[232,209,178]);
  line(36,0,"[ /## ]",[209,61,65]);
  line(36,1,"[_____]",[200,55,58]);
  line(35,2,"\\_______/",[212,179,111]);
}
