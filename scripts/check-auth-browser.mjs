import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Actual browser cookie/history checks complement the production HTTP assertions. */
export async function checkAuthBrowser(origin, { setProtectedStatus, setCompanies, companyFixtures, createdCompanies, setCategoryStatus, setProductStatus, setVariantStatus, variantUpdates, recoveryRequests, products, getProductCategory }) {
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
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        const text = message.params.args.map((argument) => argument.value ?? argument.description ?? "").join(" ");
        if (/hydration|hydrating|server rendered|Minified React error #(418|425)/i.test(text)) errors.push(text);
      }
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
      if (text === "Sair") {
        await evaluate("(()=>{if(![...document.querySelectorAll('[data-user-menu] summary')].some(e=>e.getClientRects().length))document.querySelector('[aria-label=\"Abrir menu de navegação\"]')?.click()})()");
        await wait("[...document.querySelectorAll('[data-user-menu] summary')].some(e=>e.getClientRects().length)");
        await evaluate("(()=>{if(![...document.querySelectorAll('button')].some(e=>e.getClientRects().length&&e.textContent.trim()==='Sair'))[...document.querySelectorAll('[data-user-menu] summary')].find(e=>e.getClientRects().length)?.click()})()");
      }
      await wait(`[...document.querySelectorAll('button,a')].some(e=>e.getClientRects().length&&!e.disabled&&e.textContent.trim()===${JSON.stringify(text)})`);
      await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>e.getClientRects().length&&e.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Missing control');b.focus();b.click()})()`);
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
    await wait("document.querySelector('[role=status]')?.textContent==='Empresa b'");
    assert((await send("Storage.getCookies")).cookies.some((cookie) => cookie.name === "__Host-cartly_company" && cookie.httpOnly && cookie.secure));
    await navigate("Page.reload");
    assert.equal(await evaluate("document.querySelector('select').value"), "b", "Verified preference must restore after refresh");
    await evaluate("window.companySpecificCachedData='old-company-b'");
    await select("a");
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
    await evaluate("document.querySelector('header select').focus()");
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
    await evaluate("document.querySelector('dialog [aria-label=\"Minha conta\"]').click()");
    assert(await evaluate("document.querySelector('dialog').innerText.includes('test@example.com')"), "Mobile Minha conta must show the existing profile controls");
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
    assert.equal(await evaluate("document.querySelectorAll('aside nav a').length"), 3, "Only implemented modules must be links");
    assert.equal(await evaluate("document.querySelector('aside').getBoundingClientRect().width"), 224, "Desktop sidebar must use the reduced width");
    assert(await evaluate("!!document.querySelector('aside [aria-label=\"Minha conta\"]')"));
    assert(await evaluate("![...document.querySelectorAll('header [data-user-menu]')].some(element => !element.closest('dialog'))"), "Account controls must appear only in the sidebar");
    assert(await evaluate("(()=>{const summary=document.querySelector('aside summary');const arrow=summary.lastElementChild.getBoundingClientRect();const row=summary.getBoundingClientRect();return Math.abs(arrow.top+arrow.height/2-row.top-row.height/2)<1})()"), "Account chevron must be vertically centered");
    console.log("PASS dashboard shell: safe welcome/user menu, active company header, responsive sidebar/drawer, Escape, focus restoration, inert background, overlay and navigation close; screenshots " + profile);
    // F09: actual dialogs and same-origin CRUD through the production BFF.
    await click("Categorias");
    await wait("location.pathname==='/dashboard/categories' && document.querySelector('h1')?.textContent==='Categorias'");
    await navigate("Page.reload");
    await wait("document.querySelector('h1')?.textContent==='Categorias'");
    await click("Dashboard");
    await wait("location.pathname==='/dashboard' && document.querySelector('h1')?.textContent==='Dashboard'");
    await click("Categorias");
    await wait("location.pathname==='/dashboard/categories' && document.querySelector('h1')?.textContent==='Categorias'");
    await wait("document.body.innerText.includes('Selecione uma empresa no cabeçalho')");
    const chooseCompany = async (id) => {
      await wait("!!document.querySelector('select') && Object.keys(document.querySelector('select')).some(k=>k.startsWith('__reactProps$'))");
      await evaluate(`(()=>{const select=document.querySelector('select');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      await wait(`location.pathname==='/dashboard' && document.querySelector('select')?.value===${JSON.stringify(id)}`);
    };
    await chooseCompany("a"); await go("/dashboard/categories");
    await wait("document.body.innerText.includes('Nenhuma categoria cadastrada')");
    assert(await evaluate("!!document.querySelector('aside a[href=\"/dashboard/categories\"][aria-current=page]')"));
    await click("Nova categoria");
    await wait("document.querySelector('dialog[open] input')===document.activeElement");
    await evaluate("document.querySelector('header select').focus()");
    assert(await evaluate("document.querySelector('dialog[open]').contains(document.activeElement)"), "Category modal makes the company switcher inert");
    await click("Criar categoria"); await wait("document.body.innerText.includes('Informe o nome da categoria.')");
    await fill("name", "  Bebidas  "); await click("Criar categoria");
    await wait("!document.querySelector('dialog[open]') && !!document.querySelector('[aria-label=\"Editar Bebidas\"]:not(:disabled)')");
    assert(await evaluate("document.body.innerText.includes('Categoria criada com sucesso.')"));
    await click("Nova categoria"); await fill("name", "Bebidas"); await click("Criar categoria");
    await wait("document.body.innerText.includes('Já existe uma categoria com este nome')");
    assert.equal(await evaluate("document.querySelector('[name=name]').value"), "Bebidas");
    await click("Cancelar");
    await evaluate("document.querySelector('[aria-label=\"Editar Bebidas\"]').click()");
    await fill("name", "Sucos"); await click("Salvar alterações");
    await wait("!document.querySelector('dialog[open]') && !!document.querySelector('[aria-label=\"Editar Sucos\"]:not(:disabled)')");
    // One category name activates a deterministic linked-product 409 in the mock only.
    await click("Nova categoria"); await fill("name", "Vinculada"); await click("Criar categoria");
    await wait("!document.querySelector('dialog[open]') && !!document.querySelector('[aria-label=\"Excluir Vinculada\"]:not(:disabled)')");
    await evaluate("document.querySelector('[aria-label=\"Excluir Vinculada\"]').click()"); await click("Excluir categoria");
    await wait("document.body.innerText.includes('existem produtos vinculados')"); await click("Cancelar");
    setCategoryStatus(403);
    await evaluate("document.querySelector('[aria-label=\"Excluir Sucos\"]').click()"); await click("Excluir categoria");
    await wait("document.body.innerText.includes('Você não tem permissão para realizar esta ação.')");
    assert.equal((await sessionCookies()).length, 1, "Category 403 must preserve the session");
    setCategoryStatus(200); await click("Excluir categoria");
    await wait("!document.querySelector('dialog[open]') && !document.querySelector('[aria-label=\"Editar Sucos\"]')");
    assert(await evaluate("document.body.innerText.includes('Categoria excluída com sucesso.')"));
    for (const width of [320, 390, 768, 1280]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 640 });
      assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"), `Category overflow at ${width}px`);
      if (width === 390 || width === 1280) {
        const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        writeFileSync(join(profile, `categories-${width}.png`), Buffer.from(shot.data, "base64"));
      }
    }
    await click("Nova categoria");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await wait("!document.querySelector('dialog[open]') && document.activeElement.textContent==='Nova categoria'");
    await chooseCompany("b"); await go("/dashboard/categories");
    await wait("document.body.innerText.includes('Nenhuma categoria cadastrada')");
    assert(!(await evaluate("document.body.innerText.includes('Vinculada')")), "Switching companies discards category data");
    setCategoryStatus(401); await navigate("Page.reload");
    await wait("location.pathname==='/login' && !!document.querySelector('[name=password]')");
    assert.equal((await sessionCookies()).length, 0, "Category 401 must clear the session");
    setCategoryStatus(200);
    console.log("PASS browser categories: protected navigation, active scope, create/edit/delete 204, 409 conflicts, 403 preservation, 401 cleanup, modal focus/Escape, company isolation and responsive screenshots " + profile);
    // F10: numeric prices, exact upstream company placement and physical records retained on delete.
    setCompanies([companyFixtures[0]]); await go("/login"); await signIn();
    await click("Produtos");
    await wait("location.pathname==='/dashboard/products' && document.querySelector('h1')?.textContent==='Produtos' && document.body.innerText.includes('Nenhum produto cadastrado')");
    await click("Novo produto"); await wait("!!document.querySelector('dialog[open] [name=name]')");
    await click("Criar produto"); await wait("document.body.innerText.includes('Informe o nome do produto.')");
    await fill("name", "Produto teste"); await fill("description", "Descrição do produto"); await fill("price", "12,50");
    await evaluate("(()=>{const select=document.querySelector('dialog[open] select');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await click("Criar produto");
    await wait("!document.querySelector('dialog[open]') && !!document.querySelector('[aria-label=\"Editar Produto teste\"]:not(:disabled)')");
    assert.equal(products.length, 1); assert.equal(products[0].price, 12.5); assert.equal(products[0].type, "NORMAL");
    await fill("search", "nonexistent");
    await wait("document.body.innerText.includes('Nenhum produto encontrado')");
    await evaluate("(()=>{const input=document.querySelector('input[type=search]');input.focus();input.select()})()");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
    await wait("!!document.querySelector('[aria-label=\"Editar Produto teste\"]')");
    await evaluate("document.querySelector('[aria-label=\"Editar Produto teste\"]').click()");
    await fill("name", "Produto atualizado"); await click("Salvar alterações");
    await wait("!document.querySelector('dialog[open]') && !!document.querySelector('[aria-label=\"Editar Produto atualizado\"]:not(:disabled)')");
    const category = getProductCategory(); assert(category);
    for (const type of ["VARIANT", "VARIANT_WITH_PRICE"]) products.push({ id: type, name: type === "VARIANT" ? "Camiseta" : "Pizza", description: null, companyId: "a", categoryId: category.id, category: { id: category.id, name: category.name }, type, price: type === "VARIANT" ? 25 : null, variants: [{ id: `${type}-v`, name: "Pequena", price: type === "VARIANT" ? null : 19.5 }], createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" });
    await navigate("Page.reload"); await wait("!!document.querySelector('[aria-label=\"Detalhes de Pizza\"]:not(:disabled)')");
    await evaluate("document.querySelector('[aria-label=\"Detalhes de Pizza\"]').click()");
    await wait("document.querySelector('dialog[open]')?.innerText.includes('19,50')"); await click("Fechar");
    for (const width of [320, 390, 768, 1280]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 640 });
      assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"), `Product overflow at ${width}px`);
      if (width === 390 || width === 1280) { const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); writeFileSync(join(profile, `products-${width}.png`), Buffer.from(shot.data, "base64")); }
    }
    await click("Novo produto"); await wait("!!document.querySelector('dialog[open] [name=name]')");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1000, deviceScaleFactor: 1, mobile: true });
    assert(await evaluate("document.documentElement.scrollWidth<=innerWidth && document.querySelector('dialog[open]').scrollWidth<=document.querySelector('dialog[open]').clientWidth"), "Product form must fit mobile width");
    const productFormShot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(profile, "product-form-390.png"), Buffer.from(productFormShot.data, "base64"));
    await click("Cancelar");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    setProductStatus(403);
    await evaluate("document.querySelector('[aria-label=\"Excluir Produto atualizado\"]').click()"); await click("Excluir produto");
    await wait("document.querySelector('dialog[open]')?.innerText.includes('Você não tem permissão')"); assert.equal((await sessionCookies()).length, 1);
    setProductStatus(200); await click("Excluir produto");
    await wait("!document.querySelector('dialog[open]') && !document.querySelector('[aria-label=\"Editar Produto atualizado\"]')");
    assert(products[0].deletedAt, "Soft delete must retain the original record");
    setCompanies(companyFixtures); await go("/dashboard/products");
    await wait("document.body.innerText.includes('Selecione uma empresa no cabeçalho')");
    await chooseCompany("b"); await go("/dashboard/products"); await wait("document.body.innerText.includes('Nenhum produto cadastrado')");
    assert(!(await evaluate("document.body.innerText.includes('Pizza')")));
    setProductStatus(401); await navigate("Page.reload"); await wait("location.pathname==='/login'"); assert.equal((await sessionCookies()).length, 0); setProductStatus(200);
    console.log("PASS browser products: NORMAL create/numeric BRL, local search, details/variants, partial edit, soft DELETE with company JSON, 403 preservation, 401 cleanup, company isolation and responsive screenshots " + profile);
    // F11/F12: initial strategies and focused variant mutations through the actual BFF.
    setCompanies([companyFixtures[0]]); await go("/login"); await signIn(); await click("Produtos");
    await wait("location.pathname==='/dashboard/products' && !!document.querySelector('[data-modal-fallback]')");
    const selectType = async (type) => evaluate(`(()=>{const field=document.querySelector('dialog[open] select[name=type]');field.value=${JSON.stringify(type)};field.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    for (const type of ["VARIANT", "VARIANT_WITH_PRICE"]) {
      await click("Novo produto"); await fill("name", type === "VARIANT" ? "Camiseta nova" : "Pizza nova"); await fill("description", "Produto com variantes");
      await evaluate("(()=>{const select=document.querySelector('dialog[open] select[name=categoryId]');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}))})()");
      await selectType(type);
      if (type === "VARIANT") await fill("price", "59,90");
      await click("Adicionar variante"); await fill("variants.0.name", "P"); if (type === "VARIANT_WITH_PRICE") await fill("variants.0.price", "30,10");
      await click("Adicionar variante"); await fill("variants.1.name", "M"); if (type === "VARIANT_WITH_PRICE") await fill("variants.1.price", "40,50");
      await click("Criar produto");
      await wait(`!document.querySelector('dialog[open]') && !!document.querySelector('[aria-label="Detalhes de ${type === "VARIANT" ? "Camiseta nova" : "Pizza nova"}"]:not(:disabled)')`);
    }
    const sharedProduct = products.find((item) => item.name === "Camiseta nova"); assert.equal(sharedProduct.variants.length, 2); assert(sharedProduct.variants.every((variant) => variant.price === null));
    const individualProduct = products.find((item) => item.name === "Pizza nova"); assert.equal(individualProduct.price, null); assert.equal(individualProduct.variants[0].price, 30.1);
    await evaluate("document.querySelector('[aria-label=\"Detalhes de Pizza nova\"]').click()"); await wait("document.querySelector('dialog[open]')?.innerText.includes('30,10')");
    await click("Adicionar variante"); await fill("name", "G"); await fill("price", "50,25"); await click("Salvar variante");
    await wait("/G.*50,25/.test(document.querySelector('dialog[open]')?.innerText ?? '') && !document.querySelector('form[aria-label=\"Adicionar variante\"]')");
    assert.equal(individualProduct.variants.length, 3);
    await wait("!document.querySelector('dialog[open] button[disabled]')");
    await click("Adicionar variante"); await fill("name", "G"); await fill("price", "50,25"); await click("Salvar variante");
    await wait("document.querySelector('dialog[open]')?.innerText.includes('Já existe uma variante')"); assert.equal(await evaluate("document.querySelector('dialog[open] [name=name]').value"), "G"); await click("Cancelar");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1000, deviceScaleFactor: 1, mobile: true });
    assert(await evaluate("document.documentElement.scrollWidth<=innerWidth && document.querySelector('dialog[open]').scrollWidth<=document.querySelector('dialog[open]').clientWidth"));
    const variantsShot = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(profile, "variants-390.png"), Buffer.from(variantsShot.data, "base64"));
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const name of ["G", "M", "P"]) {
      await evaluate(`document.querySelector('[aria-label="Excluir variante ${name}"]').click()`);
      if (name === "P") assert(await evaluate("document.querySelector('dialog[open]').innerText.includes('última variante')"));
      if (name === "G") { setVariantStatus(403); await click("Excluir variante"); await wait("document.querySelector('dialog[open]')?.innerText.includes('Você não tem permissão')"); assert.equal((await sessionCookies()).length, 1); setVariantStatus(200); }
      await click("Excluir variante");
      await wait(`!document.querySelector('[aria-label="Excluir variante ${name}"]') && !document.querySelector('[aria-label="Confirmar exclusão da variante"]')`);
      await wait("!document.querySelector('dialog[open] button[disabled]')");
    }
    assert.equal(individualProduct.variants.length, 0); await wait("document.querySelector('dialog[open]')?.innerText.includes('Este produto está sem variantes')");
    await click("Adicionar variante"); await fill("name", "Restaurada"); await fill("price", "30,10"); await click("Salvar variante"); await wait("/Restaurada.*30,10/.test(document.querySelector('dialog[open]')?.innerText ?? '')");
    await wait("!document.querySelector('dialog[open] button[disabled]')");
    await click("Adicionar variante"); await fill("name", "Expirada"); await fill("price", "20,00"); setVariantStatus(401); await click("Salvar variante"); await wait("location.pathname==='/login'"); assert.equal((await sessionCookies()).length, 0); setVariantStatus(200);
    console.log("PASS browser variants: both initial pricing strategies, preserved details, add/409/403/401, permanent bodyless DELETE, last-variant warning/empty recovery, native modal and mobile screenshot " + profile);
    // F12: shared-price name-only PATCH, individual price updates, nested native modal behavior.
    setCompanies([companyFixtures[0]]); await go("/login"); await signIn(); await click("Produtos");
    await wait("!!document.querySelector('[aria-label=\"Detalhes de Camiseta nova\"]:not(:disabled)')");
    await evaluate("document.querySelector('[aria-label=\"Detalhes de Camiseta nova\"]').click()");
    await wait("!!document.querySelector('[aria-label=\"Editar variante P\"]:not(:disabled)')");
    await evaluate("document.querySelector('[aria-label=\"Editar variante P\"]').click()");
    await wait("document.querySelector('form[aria-label=\"Editar variante\"]')?.closest('dialog')?.matches(':modal')");
    assert(!(await evaluate("!!document.querySelector('form[aria-label=\"Editar variante\"] [name=price]')")), "Shared variant must not expose a price field");
    await click("Salvar alterações");
    await wait("!document.querySelector('form[aria-label=\"Editar variante\"]')"); assert.equal(variantUpdates.length, 0, "Unchanged variant must not PATCH");
    await evaluate("document.querySelector('[aria-label=\"Editar variante P\"]').click()");
    await fill("name", "Pequena renomeada"); await click("Salvar alterações");
    await wait("!document.querySelector('form[aria-label=\"Editar variante\"]') && !!document.querySelector('[aria-label=\"Editar variante Pequena renomeada\"]:not(:disabled)')");
    assert.deepEqual(variantUpdates[0].body, { name: "Pequena renomeada" }); assert.equal(sharedProduct.price, 59.9);
    await click("Fechar");
    await evaluate("document.querySelector('[aria-label=\"Detalhes de Pizza nova\"]').click()");
    await wait("!!document.querySelector('[aria-label=\"Editar variante Restaurada\"]:not(:disabled)')");
    await evaluate("document.querySelector('[aria-label=\"Editar variante Restaurada\"]').click()");
    await wait("!!document.querySelector('form[aria-label=\"Editar variante\"] [name=price]')");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await wait("!document.querySelector('form[aria-label=\"Editar variante\"]') && document.activeElement.getAttribute('aria-label')==='Editar variante Restaurada'");
    assert(await evaluate("!!document.querySelector('dialog[open]')"), "Escape on edit must preserve details");
    await evaluate("document.querySelector('[aria-label=\"Editar variante Restaurada\"]').click()");
    await fill("name", "Especial"); await fill("price", "45,50");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1000, deviceScaleFactor: 1, mobile: true });
    assert(await evaluate("(()=>{const d=document.querySelector('form[aria-label=\"Editar variante\"]').closest('dialog');return d.scrollWidth<=d.clientWidth && document.documentElement.scrollWidth<=innerWidth})()"));
    const editShot = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(profile, "variant-edit-390.png"), Buffer.from(editShot.data, "base64"));
    setVariantStatus(403); await click("Salvar alterações");
    await wait("document.querySelector('form[aria-label=\"Editar variante\"]')?.innerText.includes('Você não tem permissão')"); assert.equal((await sessionCookies()).length, 1); assert.equal(await evaluate("document.querySelector('form[aria-label=\"Editar variante\"] [name=name]').value"), "Especial");
    setVariantStatus(200); await click("Salvar alterações");
    await wait("!document.querySelector('form[aria-label=\"Editar variante\"]') && !!document.querySelector('[aria-label=\"Editar variante Especial\"]:not(:disabled)')");
    assert.deepEqual(variantUpdates[1].body, { name: "Especial", price: 45.5 }); assert.equal(individualProduct.price, null);
    await navigate("Page.reload"); await wait("!!document.querySelector('[aria-label=\"Detalhes de Pizza nova\"]:not(:disabled)')");
    await evaluate("document.querySelector('[aria-label=\"Detalhes de Pizza nova\"]').click()"); await wait("/Especial.*45,50/.test(document.querySelector('dialog[open]')?.innerText ?? '')");
    await evaluate("document.querySelector('[aria-label=\"Editar variante Especial\"]').click()"); await fill("name", "Sessão inválida"); setVariantStatus(401); await click("Salvar alterações"); await wait("location.pathname==='/login'"); assert.equal((await sessionCookies()).length, 0); setVariantStatus(200);
    console.log("PASS browser variant updates: corrected PATCH/partial DTO, unchanged skip, shared-price preservation, individual price, 403/401, nested Escape/focus, reload persistence and mobile screenshot " + profile);
    // F13: public recovery through real Server Actions; only the upstream API is mocked.
    await click("Esqueci minha senha?");
    await wait("location.pathname==='/forgot-password' && !!document.querySelector('[name=email]')");
    await click("Enviar código");
    await wait("document.body.innerText.includes('Informe seu e-mail.')");
    await fill("email", "test@example.com"); await click("Enviar código");
    await wait("document.body.innerText.includes('Se o e-mail estiver cadastrado, você receberá um código')");
    assert(!(await evaluate("document.body.innerText")).includes("private upstream"));
    assert.equal((await sessionCookies()).length, 0);
    await click("Continuar para redefinir senha");
    await wait("location.pathname==='/reset-password' && !!document.querySelector('[name=otp]')");
    assert.equal(await evaluate("document.querySelector('[name=email]').value"), "test@example.com", "Email persists only within the recovery layout");
    await fill("otp", "11111111"); await fill("password", "synthetic-new-password"); await fill("confirmPassword", "synthetic-new-password");
    await click("Redefinir senha");
    await wait("document.body.innerText.includes('Código inválido, expirado ou indisponível')");
    assert.equal(await evaluate("document.querySelector('[name=password]').value"), "synthetic-new-password");
    await fill("otp", "00001234");
    for (const width of [320, 390, 768, 1280]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
      assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"), "Recovery page must fit the viewport");
      if (width === 390) {
        const shot = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(join(profile, "password-reset-390.png"), Buffer.from(shot.data, "base64"));
      }
    }
    await click("Redefinir senha");
    await wait("location.pathname==='/login' && document.body.innerText.includes('Senha redefinida com sucesso')");
    assert.equal((await sessionCookies()).length, 0, "Reset must not authenticate");
    assert.deepEqual(recoveryRequests.at(-1).body, { email: "test@example.com", otp: "00001234", password: "synthetic-new-password" });
    await go("/reset-password"); await wait("!!document.querySelector('[name=otp]')");
    assert.equal(await evaluate("document.querySelector('[name=email]').value"), "", "Full navigation discards recovery data");
    await click("Solicitar outro código"); await fill("email", "unknown@example.com"); await click("Enviar código");
    await wait("document.body.innerText.includes('Se o e-mail estiver cadastrado, você receberá um código')");
    await click("Voltar ao login"); await fill("email", "test@example.com"); await fill("password", "synthetic-new-password"); await click("Entrar");
    await wait("location.pathname==='/dashboard'");
    const existingSession = (await sessionCookies())[0]?.value;
    assert(existingSession, "New password must work with the mock login endpoint");
    await go("/reset-password"); await fill("email", "test@example.com"); await fill("otp", "00001234");
    await fill("password", "synthetic-new-password"); await fill("confirmPassword", "synthetic-new-password"); await click("Redefinir senha");
    await wait("location.pathname==='/login' && document.body.innerText.includes('Senha redefinida com sucesso')");
    assert.equal((await sessionCookies())[0]?.value, existingSession, "Reset must not alter an existing session");
    assert(urls.every((url) => !url.includes("00001234") && !url.includes("11111111") && !url.includes("synthetic-new-password") && !url.includes("test%40example.com") && !url.includes("unknown%40example.com")), "Recovery data must not enter URLs");
    console.log("PASS browser password recovery: public Server Actions, generic confirmation, memory-only email, exact DTO/leading zeros, invalid OTP, responsive form, reset/login and unchanged existing session; screenshot " + profile);
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
