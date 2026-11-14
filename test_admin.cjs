const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const flush = () => new Promise(setImmediate);

function setup(initialStatus = 200) {
  const timers = new Map(), events = {}, requests = [];
  let sequence = 0, mode = initialStatus;
  let messages = [{id: 7, name: "anonymous", created: 1, text: "<script>untrusted</script>"}];
  const element = () => ({
    events: {}, children: [], textContent: "", value: "", disabled: false, hidden: false,
    addEventListener(name, callback) { this.events[name] = callback; },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
  });
  const elements = Object.fromEntries([
    "login-form", "manage", "admin-messages", "status", "password", "count", "refresh", "clear", "logout",
  ].map(id => ["#" + id, element()]));
  const buttons = [elements["#refresh"], elements["#clear"], elements["#logout"]];
  const document = {
    hidden: false, querySelector: id => elements[id], querySelectorAll: () => buttons,
    createElement: element, createDocumentFragment: element,
    addEventListener: (name, callback) => events[name] = callback,
  };
  let confirmed = true;
  const context = vm.createContext({
    document, AbortController, confirm: () => confirmed,
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, {callback, delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      requests.push({url, body: options.body && JSON.parse(options.body)});
      if (mode === "network") throw new Error("network unavailable");
      if (mode === "pending") return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("timeout"); error.name = "AbortError"; reject(error);
        });
      });
      return {ok: mode === 200, status: mode, headers: {get: () => "application/json"},
        json: async () => mode === 200 ? {messages} : {error: "login required"}};
    },
  });
  vm.runInContext(fs.readFileSync("admin.js", "utf8"), context);
  return {timers, events, requests, elements, buttons, document,
    mode(value) { mode = value; }, confirm(value) { confirmed = value; },
    async fire(delay) {
      const found = [...timers].find(([, value]) => value.delay === delay);
      assert(found, "Expected timer with delay " + delay);
      timers.delete(found[0]); found[1].callback(); await flush();
    },
  };
}

(async () => {
  const page = setup();
  const {elements, timers, requests, events, document} = page;
  await flush();
  assert.equal(requests.length, 1, "Restore a session with one request");
  assert.equal(timers.size, 1);
  const article = elements["#admin-messages"].children[0].children[0];
  assert.equal(article.children[1].textContent, "<script>untrusted</script>");
  assert.equal(article.children[1].children.length, 0);

  page.mode("network");
  await page.fire(10000);
  assert(elements["#status"].textContent);
  assert.equal(timers.size, 1, "Retry polling after a transient error");
  assert(page.buttons.every(button => !button.disabled));
  page.mode(200);
  await page.fire(10000);
  assert.equal(elements["#status"].textContent, "");

  document.hidden = true; events.visibilitychange();
  assert.equal(timers.size, 0, "Do not poll hidden tabs");
  document.hidden = false; events.visibilitychange(); await flush();
  assert.equal(timers.size, 1);

  page.mode("pending");
  const blocked = elements["#refresh"].events.click();
  assert(page.buttons.every(button => button.disabled));
  await page.fire(70000); await blocked;
  assert(page.buttons.every(button => !button.disabled), "Timeout unlocks controls");
  assert.equal(timers.size, 1, "Timeout remains retryable");

  page.mode(401);
  await page.fire(10000);
  assert.equal(elements["#manage"].hidden, true);
  assert.equal(elements["#admin-messages"].children.length, 0);
  assert.equal(timers.size, 0, "Expired session stops polling");

  page.mode(200); elements["#password"].value = "test-only";
  await elements["#login-form"].events.submit({preventDefault() {}});
  assert.equal(elements["#password"].value, "");
  assert.equal(elements["#manage"].hidden, false);
  page.confirm(false);
  const before = requests.length;
  await elements["#clear"].events.click();
  assert.equal(requests.length, before, "Cancelled deletion makes no request");
  page.confirm(true);
  await elements["#clear"].events.click();
  assert.deepEqual(requests.find(request => request.url.endsWith("/clear")).body,
    {confirm: "DELETE", throughId: 7});
  await elements["#logout"].events.click();
  assert.equal(timers.size, 0);
  assert.equal(elements["#manage"].hidden, true);

  const loggedOut = setup(401); await flush();
  assert.equal(loggedOut.elements["#status"].textContent, "", "Initial login page is not an error");
  assert.equal(loggedOut.timers.size, 0);
  console.log("Admin session, safe text, retries, visibility, timeout, expiry, confirmed deletion and logout passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
