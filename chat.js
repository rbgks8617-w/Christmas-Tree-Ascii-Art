"use strict";
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatSend = document.querySelector("#chat-send");
const chatList = document.querySelector("#messages");
const chatStatus = document.querySelector("#chat-status");
const chatName = document.querySelector("#chat-name");
const chatCount = document.querySelector("#chat-count");
let chatTimer, chatBusy = false, chatConnected = false, sending = false;
let pendingMessage = null, lastSnapshot = "";
async function chatRequest(options) {
  const response = await fetch("/api/chat", {credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.timeout(12000), ...options});
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("채팅 서버에 연결할 수 없어요.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "잠시 후 다시 시도해 주세요.");
  return data;
}
function showMessages(messages) {
  const snapshot = JSON.stringify(messages);
  if (snapshot === lastSnapshot) return;
  const stick = !lastSnapshot || chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 60;
  const oldScroll = chatList.scrollTop;
  lastSnapshot = snapshot;
  const fragment = document.createDocumentFragment();
  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = "조용한 겨울밤, 첫 인사를 남겨 주세요.";
    fragment.append(empty);
  }
  for (const message of messages) {
    const item = document.createElement("article");
    item.className = "message" + (message.mine ? " mine" : "");
    const meta = document.createElement("div");
    meta.className = "message-meta";
    const name = document.createElement("span");
    name.textContent = message.name + (message.mine ? " · 나" : "");
    const time = document.createElement("time");
    const date = new Date(message.created * 1000);
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleTimeString("ko-KR", {hour: "2-digit", minute: "2-digit", hour12: false});
    const text = document.createElement("p");
    text.textContent = message.text;
    meta.append(name, time); item.append(meta, text); fragment.append(item);
  }
  chatList.replaceChildren(fragment);
  chatList.scrollTop = stick ? chatList.scrollHeight : oldScroll;
}
async function pollChat() {
  clearTimeout(chatTimer);
  if (chatBusy || document.hidden) return;
  chatBusy = true;
  try {
    const data = await chatRequest();
    chatConnected = true;
    chatName.textContent = data.name;
    showMessages(data.messages);
    if (!sending) chatStatus.textContent = "연결됨 · 모두에게 보이는 대화";
  } catch (_) {
    chatConnected = false;
    chatStatus.textContent = "연결을 기다리고 있어요. 잠시 후 자동으로 다시 연결해요.";
  } finally {
    chatBusy = false;
    chatSend.disabled = !chatConnected || sending;
    chatTimer = setTimeout(pollChat, chatConnected ? 2500 : 8000);
  }
}
chatInput.addEventListener("input", () => { chatCount.textContent = chatInput.value.length + "/300"; });
chatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || sending || !chatConnected) return;
  sending = true; chatSend.disabled = true;
  if (!pendingMessage || pendingMessage.text !== text)
    pendingMessage = {text, requestId: crypto.randomUUID()};
  try {
    await chatRequest({method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(pendingMessage)});
    if (chatInput.value.trim() === text) chatInput.value = "";
    chatCount.textContent = chatInput.value.length + "/300";
    pendingMessage = null;
    chatStatus.textContent = "보냈어요.";
    await pollChat();
    chatList.scrollTop = chatList.scrollHeight;
  } catch (error) {
    chatStatus.textContent = error.message || "보내지 못했어요. 다시 시도해 주세요.";
  } finally {
    sending = false; chatSend.disabled = !chatConnected;
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) pollChat(); else clearTimeout(chatTimer);
});
pollChat();
