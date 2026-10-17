import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Actual browser cookie/history checks complement the production HTTP assertions. */
export async function checkAuthBrowser(origin, { setProtectedStatus, setCompanies, companyFixtures, createdCompanies }) {
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
    let lookupCalls = 0;
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Fetch.requestPaused") {
        // Mock the BFF lookup boundary only: provider Route Handlers are covered by unit tests.
        // No automated browser test contacts public ReceitaWS/ViaCEP services.
        lookupCalls++;
        void send("Fetch.fulfillRequest", {
          requestId: message.params.requestId, responseCode: 502,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from(JSON.stringify({ error: { message: "Lookup unavailable in isolated browser check" } })).toString("base64"),
        });
      }
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
      assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const wait = async (expression) => {
      for (let attempt = 0; attempt < 150; attempt++) {
        if (await evaluate(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Browser condition failed: ${expression}; visible text: ${await evaluate("document.body.innerText")}`);
    };
    const fill = async (name, text) => {
      const selector = JSON.stringify(`[name="${name}"]`);
      await wait(`[...document.querySelectorAll(${selector})].some(e=>e.getClientRects().length)`);
      await wait(`[...document.querySelectorAll(${selector})].some(e=>e.getClientRects().length&&Object.keys(e).some(k=>k.startsWith('__reactProps$')))`);
      await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      await evaluate(`(()=>{const e=[...document.querySelectorAll(${selector})].find(e=>e.getClientRects().length);e.focus();e.select()})()`);
      await send("Input.insertText", { text });
    };
    const click = async (text) => {
      if (text === "Sair") await evaluate("(()=>{if(![...document.querySelectorAll('button')].some(e=>e.getClientRects().length&&e.textContent.trim()==='Sair'))document.querySelector('[data-user-menu] summary')?.click()})()");
      await wait(`[...document.querySelectorAll('button,a')].some(e=>e.getClientRects().length&&!e.disabled&&e.textContent.trim()===${JSON.stringify(text)})`);
      await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>e.getClientRects().length&&e.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Missing control');b.click()})()`);
    };
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
      await wait("location.pathname==='/dashboard' && document.body.innerText.includes('Organize a gestão do seu negócio por aqui.')");
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await send("Fetch.enable", { patterns: [{ urlPattern: origin + "/api/lookups/*" }] });
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
    assert(!(await evaluate("document.cookie")).includes("cartly_user"), "Display profile cookie must remain HttpOnly");
    assert.equal(await evaluate("fetch('/api/auth/session').then(r=>r.status)"), 200);
    await navigate("Page.reload");
    await wait("document.readyState==='complete' && document.body.innerText.includes('Organize a gestão do seu negócio por aqui.')");
    assert(await evaluate("document.body.innerText.includes('Olá, Pessoa de teste!')"), "Welcome must use the safe login profile after refresh");
    assert.equal((await sessionCookies())[0]?.value, cookie.value, "Refresh must retain the bounded session");

    setProtectedStatus(403);
    assert.equal(await evaluate("fetch('/api/auth/session').then(r=>r.status)"), 403);
    assert.equal((await sessionCookies())[0]?.value, cookie.value, "403 must retain the cookie");
    await navigate("Page.reload");
    await wait("document.body.innerText.includes('Acesso negado')");
    setProtectedStatus(200);
    await navigate("Page.reload");
    await wait("document.body.innerText.includes('Organize a gestão do seu negócio por aqui.')");
    const history = await send("Page.getNavigationHistory");
    const protectedEntry = history.entries[history.currentIndex].id;
    await click("Sair");
    await wait("location.pathname==='/login' && !!document.querySelector('[name=password]')");
    assert.equal((await sessionCookies()).length, 0, "Logout must delete the session");
    assert(!(await send("Storage.getCookies")).cookies.some((item) => item.name === "__Host-cartly_user"), "Logout must delete the display profile");
    await navigate("Page.navigateToHistoryEntry", { entryId: protectedEntry });
    await wait("location.pathname==='/login' && document.readyState==='complete'");
    assert(!(await evaluate("document.body.innerText")).includes("Organize a gestão do seu negócio por aqui."), "History must not expose protected content after logout");
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

    // F06: actual native POST switching, restored preferences and complete document isolation.
    setCompanies(companyFixtures);
    await navigate("Page.reload");
    await wait("!!document.querySelector('select[name=companyId]')");
    assert.equal(await evaluate("document.querySelector('select').value"), "");
    const select = async (id) => {
      await wait("!!document.querySelector('select[name=companyId]') && Object.keys(document.querySelector('select[name=companyId]')).some(k=>k.startsWith('__reactProps$'))");
      await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      await evaluate(`(()=>{const e=document.querySelector('select[name=companyId]');e.value=${JSON.stringify(id)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    };
    await select("b");
    await click("Continuar");
    await wait("document.querySelector('[role=status]')?.textContent==='Empresa b'");
    assert((await send("Storage.getCookies")).cookies.some((cookie) => cookie.name === "__Host-cartly_company" && cookie.httpOnly && cookie.secure));
    await navigate("Page.reload");
    assert.equal(await evaluate("document.querySelector('select').value"), "b", "Verified preference must restore after refresh");
    await evaluate("window.companySpecificCachedData='old-company-b'");
    await select("a");
    await click("Trocar empresa");
    await wait("document.querySelector('[role=status]')?.textContent==='Empresa a'");
    assert(await evaluate("window.companySpecificCachedData===undefined"), "Full navigation must discard the previous company cache");
    setCompanies([companyFixtures[1]]);
    await navigate("Page.reload");
    await wait("document.querySelector('[role=status]')?.textContent==='Empresa b'");
    assert.equal(await evaluate("!!document.querySelector('select')"), false, "Single accessible company is automatic");
    setCompanies([]);
    await navigate("Page.reload");
    await wait("location.pathname==='/dashboard/onboarding' && document.body.innerText.includes('Cadastre sua empresa')");
    // Existing-company users can open the same form and cancel without changing selection.
    setCompanies([companyFixtures[1]]);
    await click("Verificar empresas novamente");
    await wait("location.pathname==='/dashboard' && document.querySelector('[role=status]')?.textContent==='Empresa b'");
    await click("Criar nova empresa");
    await wait("location.pathname==='/dashboard/onboarding' && document.body.innerText.includes('Cadastre sua empresa')");
    await click("Voltar ao dashboard");
    await wait("location.pathname==='/dashboard' && document.querySelector('[role=status]')?.textContent==='Empresa b'");
    await click("Criar nova empresa");
    await wait("location.pathname==='/dashboard/onboarding' && document.body.innerText.includes('Cadastre sua empresa')");
    await fill("document", "11.222.333/0001-81");
    await fill("name", "Empresa de teste");
    await click("Consultar CNPJ");
    await wait("document.body.innerText.includes('Não foi possível consultar o CNPJ')");
    await click("Continuar");
    await fill("address.zipCode", "01001-000");
    await fill("address.street", "Rua manual");
    await wait("document.body.innerText.includes('CEP não encontrado ou indisponível')");
    await fill("address.number", "12");
    await fill("address.city", "São Paulo");
    await fill("address.state", "SP");
    await click("Voltar");
    assert.equal(await evaluate("document.querySelector('[name=name]').value"), "Empresa de teste");
    await click("Continuar");
    assert.equal(await evaluate("document.querySelector('[name=\"address.number\"]').value"), "12");
    for (const width of [320, 390, 768, 1280]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1100, deviceScaleFactor: 1, mobile: width < 640 });
      assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"), `Onboarding overflow at ${width}px`);
      if (width === 390) {
        const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        writeFileSync(join(profile, "onboarding-mobile.png"), Buffer.from(screenshot.data, "base64"));
        console.log("Onboarding screenshot: " + join(profile, "onboarding-mobile.png"));
      }
    }
    await click("Criar empresa");
    await wait("location.pathname==='/dashboard' && document.querySelector('[role=status]')?.textContent==='Empresa de teste'");
    assert.equal(createdCompanies.length, 1, "Company must be created only once");
    assert.equal(lookupCalls, 2, "No redundant lookup requests");
    await navigate("Page.reload");
    await wait("document.querySelector('[role=status]')?.textContent==='Empresa de teste'");
    assert.equal(await evaluate("document.querySelector('[role=status]').textContent"), "Empresa de teste");
    console.log("PASS browser onboarding: two steps, manual fallback, preserved values, exact normalized POST, active company synchronization, dashboard redirect, responsive layout");
    await click("Sair");
    await wait("location.pathname==='/login' && !!document.querySelector('[name=password]')");
    assert(!(await send("Storage.getCookies")).cookies.some((cookie) => cookie.name === "__Host-cartly_company"), "Logout clears the company preference");
    setCompanies(companyFixtures);
    await signIn();
    assert.equal(await evaluate("document.querySelector('select').value"), "", "A new session must not inherit a company choice");
    // F08: native modal focus, inert background, navigation and account disclosure.
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1000, deviceScaleFactor: 1, mobile: true });
    await wait("document.querySelector('[aria-label=\"Abrir menu de navegação\"]')?.getClientRects().length>0");
    const openDrawer = async () => {
      await evaluate("document.querySelector('[aria-label=\"Abrir menu de navegação\"]').click()");
      await wait("document.querySelector('dialog')?.matches(':modal')");
      assert(await evaluate("document.querySelector('dialog').contains(document.activeElement)"));
    };
    const closedDrawer = async () => {
      await wait("!document.querySelector('dialog').open && document.activeElement.getAttribute('aria-label')==='Abrir menu de navegação'");
      assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Abrir menu de navegação");
    };
    await openDrawer();
    await evaluate("document.querySelector('[data-user-menu] summary').focus()");
    assert(await evaluate("document.querySelector('dialog').contains(document.activeElement)"), "Modal must keep background inert");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert(await evaluate("document.querySelector('dialog').contains(document.activeElement)"));
    const drawerShot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(profile, "dashboard-drawer.png"), Buffer.from(drawerShot.data, "base64"));
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await closedDrawer();
    await openDrawer();
    await click("Dashboard");
    await closedDrawer();
    await openDrawer();
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 380, y: 300, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 380, y: 300, button: "left", clickCount: 1 });
    await closedDrawer();
    for (const width of [320, 390, 768, 1280]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 640 });
      assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"), `Overflow at ${width}px`);
      if (width === 390 || width === 1280) {
        const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        writeFileSync(join(profile, `dashboard-${width}.png`), Buffer.from(shot.data, "base64"));
      }
    }
    assert(await evaluate("!!document.querySelector('aside nav a[aria-current=page]')"), "Desktop navigation must highlight the dashboard");
    assert.equal(await evaluate("document.querySelectorAll('aside nav a').length"), 1, "Unimplemented modules must not be links");
    console.log("PASS dashboard shell: safe welcome/user menu, active company header, responsive sidebar/drawer, Escape, focus restoration, inert background, overlay and navigation close; screenshots " + profile);
    assert(urls.every((url) => !url.includes("synthetic-password") && !url.includes("synthetic-wrong")), "Passwords must not enter URLs");
    assert.deepEqual(errors, [], "No browser JavaScript exceptions");
    console.log("PASS browser companies: zero/one/multiple companies, native selection/switch, refresh restoration, removal, document cache reset, onboarding boundary, logout/new-session isolation");
    console.log("PASS browser auth: login UI, invalid credentials, HttpOnly/Secure cookie, return URLs, refresh, protected access, 401 cleanup, 403 preservation, logout, history isolation, responsive layout");
  } finally {
    setProtectedStatus(200);
    ws?.close();
    const stopped = once(browser, "exit");
    browser.kill();
    await stopped;
  }
}
