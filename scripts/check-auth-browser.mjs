import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Actual browser cookie/history checks complement the production HTTP assertions. */
export async function checkAuthBrowser(origin, { setProtectedStatus }) {
  const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
  assert(existsSync(chrome), "Set CHROME_PATH to a local Chrome/Chromium executable");
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const profile = mkdtempSync(join(tmpdir(), "cartly-auth-browser-"));
  const browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
  { windowsHide: true, stdio: "ignore" });
  let ws;
  try {
    let pages;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        if (pages.some((page) => page.type === "page")) break;
      } catch { /* Wait for the isolated browser. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(pages?.some((page) => page.type === "page"), "Browser did not start");
    ws = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let sequence = 0;
    let navigations = 0;
    const pending = new Map();
    const errors = [];
    const urls = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Page.frameNavigated" && !message.params.frame.parentId) navigations++;
      if (message.id) {
        const handler = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) handler.reject(message.error); else handler.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.method === "Network.requestWillBeSent") urls.push(message.params.request.url);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      assert(!result.exceptionDetails, "Browser evaluation failed");
      return result.result.value;
    };
    const wait = async (expression) => {
      for (let attempt = 0; attempt < 150; attempt++) {
        if (await evaluate(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Browser condition failed: ${expression}`);
    };
    const fill = async (name, text) => {
      await wait(`[...document.querySelectorAll('[name=${name}]')].some(e=>e.getClientRects().length)`);
      await evaluate(`(()=>{const e=[...document.querySelectorAll('[name=${name}]')].find(e=>e.getClientRects().length);e.focus();e.select()})()`);
      await send("Input.insertText", { text });
    };
    const click = (text) => evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>e.getClientRects().length&&e.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Missing control');b.click()})()`);
    const navigate = async (method, params = {}) => {
      const previous = navigations;
      await send(method, params);
      for (let attempt = 0; attempt < 150 && navigations === previous; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert(navigations > previous, "Browser navigation must commit before assertions");
      await wait("document.readyState==='complete'");
    };
    const go = (path) => navigate("Page.navigate", { url: origin + path });
    const sessionCookies = async () => (await send("Storage.getCookies")).cookies.filter((cookie) => cookie.name === "__Host-cartly_session");
    const signIn = async () => {
      await fill("email", "test@example.com");
      await fill("password", "synthetic-password");
      await click("Entrar");
      await wait("location.pathname==='/dashboard' && document.body.innerText.includes('Sua sessão está ativa.')");
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await go("/dashboard?tab=summary");
    await wait("location.pathname==='/login' && !!document.querySelector('[name=password]')");
    assert.equal(await evaluate("new URLSearchParams(location.search).get('returnTo')"), "/dashboard?tab=summary");
    await click("Entrar");
    await wait("document.body.innerText.includes('Informe seu e-mail.')");
    await fill("email", "test@example.com");
    await fill("password", "synthetic-wrong");
    await click("Entrar");
    await wait("document.body.innerText.includes('E-mail ou senha inválidos.')");
    assert.equal((await sessionCookies()).length, 0);
    await signIn();
    assert.equal(await evaluate("location.search"), "?tab=summary");
    const [cookie] = await sessionCookies();
    assert(cookie?.httpOnly && cookie.secure && cookie.sameSite === "Lax");
    assert(!(await evaluate("document.cookie")).includes("cartly_session"), "JWT must be invisible to JavaScript");
    assert.equal(await evaluate("fetch('/api/auth/session').then(r=>r.status)"), 200);
    await navigate("Page.reload");
    await wait("document.readyState==='complete' && document.body.innerText.includes('Sua sessão está ativa.')");
    assert.equal((await sessionCookies())[0]?.value, cookie.value, "Refresh must retain the bounded session");

    setProtectedStatus(403);
    assert.equal(await evaluate("fetch('/api/auth/session').then(r=>r.status)"), 403);
    assert.equal((await sessionCookies())[0]?.value, cookie.value, "403 must retain the cookie");
    await navigate("Page.reload");
    await wait("document.body.innerText.includes('Acesso negado')");
    setProtectedStatus(200);
    await navigate("Page.reload");
    await wait("document.body.innerText.includes('Sua sessão está ativa.')");
    const history = await send("Page.getNavigationHistory");
    const protectedEntry = history.entries[history.currentIndex].id;
    await click("Sair");
    await wait("location.pathname==='/login' && !!document.querySelector('[name=password]')");
    assert.equal((await sessionCookies()).length, 0, "Logout must delete the session");
    await navigate("Page.navigateToHistoryEntry", { entryId: protectedEntry });
    await wait("location.pathname==='/login' && document.readyState==='complete'");
    assert(!(await evaluate("document.body.innerText")).includes("Sua sessão está ativa."), "History must not expose protected content after logout");
    assert.equal(await evaluate("fetch('/api/auth/session').then(r=>r.status)"), 401);

    await signIn();
    setProtectedStatus(401);
    await navigate("Page.reload");
    await wait("location.pathname==='/login' && document.body.innerText.includes('Sua sessão expirou.')");
    assert.equal((await sessionCookies()).length, 0, "Backend 401 must invalidate the session");
    setProtectedStatus(200);
    await go("/login?returnTo=https://evil.test");
    await wait("!!document.querySelector('[name=password]') && document.readyState==='complete'");
    await signIn();
    assert.equal(await evaluate("location.search"), "", "Unsafe return URLs must fall back to the dashboard");
    await click("Sair");
    await wait("location.pathname==='/login' && !!document.querySelector('[name=password]')");
    for (const width of [320, 390, 768, 1280]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 640 });
      assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"), `Overflow at ${width}px`);
    }
    assert(urls.every((url) => !url.includes("synthetic-password") && !url.includes("synthetic-wrong")), "Passwords must not enter URLs");
    assert.deepEqual(errors, [], "No browser JavaScript exceptions");
    console.log("PASS browser auth: login UI, invalid credentials, HttpOnly/Secure cookie, return URLs, refresh, protected access, 401 cleanup, 403 preservation, logout, history isolation, responsive layout");
  } finally {
    setProtectedStatus(200);
    ws?.close();
    const stopped = once(browser, "exit");
    browser.kill();
    await stopped;
  }
}
