"use strict";
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatSend = document.querySelector("#chat-send");
const chatList = document.querySelector("#messages");
const chatStatus = document.querySelector("#chat-status");
let chatTimer, chatFlight = null, chatConnected = false, sending = false;
let pendingMessage = null, lastSnapshot = "", chatError = "";
async function chatRequest(options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70000);
  try {
    const response = await fetch("/api/chat", {credentials: "same-origin", cache: "no-store",
      ...options, signal: controller.signal});
    if (!response.headers.get("content-type")?.includes("application/json")) {
      const error = new Error(response.status === 404
        ? "이 주소에는 채팅 서버가 없어요. Web Service 주소로 접속해 주세요."
        : "채팅 서버가 응답하지 않아요. 잠시 후 다시 보내 주세요.");
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "채팅 연결에 실패했어요.");
      error.status = response.status;
      throw error;
    }
    return data;
  } finally { clearTimeout(timer); }
}
function showMessages(messages) {
  const snapshot = JSON.stringify(messages);
  if (snapshot === lastSnapshot) return;
  const stick = !lastSnapshot || chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 60;
  const oldScroll = chatList.scrollTop;
  lastSnapshot = snapshot;
  if (typeof chatSnow !== "undefined") {
    chatSnow.update(messages);
    // Refresh removals even when animation time is paused.
    if (typeof paused !== "undefined" && paused && typeof draw === "function") draw();
  }
  const fragment = document.createDocumentFragment();
  for (const message of messages) {
    const item = document.createElement("p");
    item.className = "message" + (message.mine ? " mine" : "");
    const name = document.createElement("span");
    name.className = "message-name"; name.textContent = "익명 : ";
    const text = document.createElement("span"); text.textContent = message.text;
    item.append(name, text); fragment.append(item);
  }
  chatList.replaceChildren(fragment);
  chatList.scrollTop = stick ? chatList.scrollHeight : oldScroll;
}
function connectChat() {
  if (chatFlight) return chatFlight;
  chatFlight = (async () => {
    try {
      const data = await chatRequest();
      if (!Array.isArray(data.messages)) throw new Error("채팅 서버 응답을 확인해 주세요.");
      showMessages(data.messages); chatConnected = true; chatError = "";
      chatSend.title = "";
      return true;
    } catch (error) {
      chatConnected = false;
      chatError = error.name === "AbortError" ? "서버 시작이 지연되고 있어요. 다시 보내 주세요." : error.message;
      chatSend.title = chatError;
      return false;
    } finally { chatFlight = null; }
  })();
  return chatFlight;
}
async function pollChat() {
  clearTimeout(chatTimer);
  if (document.hidden) return;
  await connectChat();
  // Visibility and online events can await the same request. Keep one timer.
  clearTimeout(chatTimer);
  if (!document.hidden) chatTimer = setTimeout(pollChat, chatConnected ? 2500 : 8000);
}
function requestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, "0")).join("");
}
chatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || sending) return;
  sending = true; chatSend.disabled = true; chatSend.textContent = "…";
  chatStatus.textContent = ""; chatStatus.hidden = true;
  try {
    if (!chatConnected && !await connectChat()) throw new Error(chatError);
    if (!pendingMessage || pendingMessage.text !== text)
      pendingMessage = {text, requestId: requestId()};
    const options = {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(pendingMessage)};
    try { await chatRequest(options); }
    catch (error) {
      if (error.status !== 401) throw error;
      if (!await connectChat()) throw new Error(chatError);
      await chatRequest(options);
    }
    if (chatInput.value.trim() === text) chatInput.value = "";
    pendingMessage = null;
    // Wait for an older poll, then fetch again so the sent message is included.
    if (chatFlight) await chatFlight;
    await connectChat();
    chatList.scrollTop = chatList.scrollHeight;
  } catch (error) {
    chatStatus.textContent = error.name === "AbortError" ? "전송이 지연됐어요. 다시 보내 주세요." : error.message;
    chatStatus.hidden = false;
  } finally {
    sending = false; chatSend.disabled = false; chatSend.textContent = "보내기";
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) pollChat(); else clearTimeout(chatTimer);
});
window.addEventListener("online", pollChat);
pollChat();
