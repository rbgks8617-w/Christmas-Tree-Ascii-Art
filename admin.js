"use strict";

const loginForm = document.querySelector("#login-form");
const manage = document.querySelector("#manage");
const list = document.querySelector("#admin-messages");
const status = document.querySelector("#status");
let busy = false, latestId = 0, timer;
let signedIn = false;

function setSignedIn(value) {
  signedIn = value;
  manage.hidden = !value;
  loginForm.hidden = value;
  if (!value) {
    clearTimeout(timer);
    list.replaceChildren();
    latestId = 0;
  }
}

async function api(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70000);
  try {
    const response = await fetch("/api/admin/" + path, {
      credentials: "same-origin", cache: "no-store", signal: controller.signal,
      ...(body === undefined ? {} : {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
      }),
    });
    if (response.status === 401) setSignedIn(false);
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("관리 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "요청에 실패했어요.");
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function refresh() {
  const data = await api("messages");
  setSignedIn(true);
  latestId = Math.max(0, ...data.messages.map(message => message.id));
  document.querySelector("#count").textContent = data.messages.length + "개 메시지";
  const fragment = document.createDocumentFragment();
  for (const message of data.messages) {
    const article = document.createElement("article");
    const meta = document.createElement("small");
    const text = document.createElement("p");
    const button = document.createElement("button");
    meta.textContent = message.name + " · " + new Date(message.created * 1000).toLocaleString("ko-KR");
    text.textContent = message.text;
    button.textContent = "삭제";
    button.className = "danger";
    button.addEventListener("click", () => run(async () => {
      if (!confirm("이 메시지를 삭제할까요?")) return;
      await api("delete", {id: message.id});
      await refresh();
      status.textContent = "삭제했어요.";
    }));
    article.append(meta, text, button);
    fragment.append(article);
  }
  list.replaceChildren(fragment);
}

async function run(action, initial = false) {
  if (busy) return;
  busy = true;
  clearTimeout(timer);
  status.textContent = "";
  for (const button of document.querySelectorAll("button")) button.disabled = true;
  try {
    await action();
  } catch (error) {
    // Visiting the login page without a session is expected.
    if (!initial || error.status !== 401)
      status.textContent = error.name === "AbortError"
        ? "서버 응답이 늦어지고 있어요. 다시 시도해 주세요." : error.message;
  } finally {
    busy = false;
    for (const button of document.querySelectorAll("button")) button.disabled = false;
    // Retry transient failures, but stop polling after logout or in a hidden tab.
    if (signedIn && !document.hidden) timer = setTimeout(() => run(refresh), 10000);
  }
}

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  return run(async () => {
    const password = document.querySelector("#password");
    await api("login", {password: password.value});
    password.value = "";
    setSignedIn(true);
    await refresh();
  });
});
document.querySelector("#refresh").addEventListener("click", () => run(refresh));
document.querySelector("#clear").addEventListener("click", () => run(async () => {
  const throughId = latestId;
  if (!confirm("현재 목록의 채팅을 전부 삭제할까요? 되돌릴 수 없어요.")) return;
  await api("clear", {confirm: "DELETE", throughId});
  await refresh();
  status.textContent = "삭제했어요.";
}));
document.querySelector("#logout").addEventListener("click", () => run(async () => {
  await api("logout", {});
  setSignedIn(false);
}));
document.addEventListener("visibilitychange", () => {
  clearTimeout(timer);
  if (!document.hidden && signedIn) run(refresh);
});

run(refresh, true);
