"use strict";
const loginForm=document.querySelector("#login-form"),manage=document.querySelector("#manage"),
list=document.querySelector("#admin-messages"),status=document.querySelector("#status");
let busy=false, latestId=0, timer;
async function api(path,body){
 const response=await fetch("/api/admin/"+path,{credentials:"same-origin",cache:"no-store",
 ...(body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})});
 const data=await response.json();
 if(!response.ok){if(response.status===401){manage.hidden=true;loginForm.hidden=false;clearTimeout(timer);}throw new Error(data.error||"요청에 실패했어요.");}
 return data;
}
async function refresh(){
 clearTimeout(timer);
 const data=await api("messages");
 manage.hidden=false;loginForm.hidden=true;latestId=Math.max(0,...data.messages.map(m=>m.id));
 document.querySelector("#count").textContent=data.messages.length+"개 메시지";
 const fragment=document.createDocumentFragment();
 for(const message of data.messages){
  const article=document.createElement("article"),meta=document.createElement("small"),text=document.createElement("p"),button=document.createElement("button");
  meta.textContent=message.name+" · "+new Date(message.created*1000).toLocaleString("ko-KR");
  text.textContent=message.text;button.textContent="삭제";button.className="danger";
  button.addEventListener("click",()=>run(async()=>{
   if(!confirm("이 메시지를 삭제할까요?"))return;
   await api("delete",{id:message.id});await refresh();status.textContent="삭제했어요.";
  }));
  article.append(meta,text,button);fragment.append(article);
 }
 list.replaceChildren(fragment);
 timer=setTimeout(()=>{if(!busy&&!document.hidden)run(refresh);else timer=setTimeout(()=>run(refresh),10000);},10000);
}
async function run(action){
 if(busy)return;busy=true;status.textContent="";
 for(const button of document.querySelectorAll("button"))button.disabled=true;
 try{await action();}catch(error){status.textContent=error.message;}
 finally{busy=false;for(const button of document.querySelectorAll("button"))button.disabled=false;}
}
loginForm.addEventListener("submit",event=>{event.preventDefault();run(async()=>{
 const password=document.querySelector("#password");
 await api("login",{password:password.value});password.value="";await refresh();
});});
document.querySelector("#refresh").addEventListener("click",()=>run(refresh));
document.querySelector("#clear").addEventListener("click",()=>run(async()=>{
 const throughId=latestId;
 if(!confirm("현재 목록의 채팅을 전부 삭제할까요? 되돌릴 수 없어요."))return;
 await api("clear",{confirm:"DELETE",throughId});await refresh();status.textContent="삭제했어요.";
}));
document.querySelector("#logout").addEventListener("click",()=>run(async()=>{
 await api("logout",{});clearTimeout(timer);manage.hidden=true;loginForm.hidden=false;list.replaceChildren();
}));
api("messages").then(()=>run(refresh)).catch(()=>{});
