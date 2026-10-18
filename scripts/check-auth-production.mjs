import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";

// Loopback-only NestJS mock. All credentials/tokens are synthetic test fixtures.
const safeUser = {
  id: "test-user", name: "Pessoa de teste", email: "test@example.com", lockedAt: null,
  createdAt: "2026-10-16T12:00:00Z", updatedAt: "2026-10-16T12:00:00Z",
};
const jwt = (exp, sub = "test-user") => [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ exp, sub })).toString("base64url"),
  Buffer.from("synthetic-test-signature").toString("base64url"),
].join(".");
const token = jwt(Math.floor(Date.now() / 1000) + 300);
let protectedStatus = 200;
const companyFixtures = ["a", "b"].map((id) => ({
  id, name: `Empresa ${id}`, document: id, createdAt: "2026-10-16T12:00:00Z", updatedAt: "2026-10-16T12:00:00Z",
}));
let accessibleCompanies = [companyFixtures[0]];
const upstreamPaths = [];
const createdCompanies = [];
const categories = new Map();
let categorySequence = 0;
let categoryStatus = 200;
const products = [];
let productSequence = 0;
let productStatus = 200;
let variantStatus = 200;
let variantSequence = 0;
const variantUpdates = [];
const backend = createServer(async (request, response) => {
  upstreamPaths.push(request.url);
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/auth/login" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    if (input.email === safeUser.email && input.password === "synthetic-password") {
      response.end(JSON.stringify({ accessToken: token, user: safeUser }));
    } else {
      response.writeHead(401).end(JSON.stringify({ message: "private diagnostic" }));
    }
  } else if (request.url === "/companies" && request.method === "POST") {
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    assert.deepEqual(Object.keys(input).sort(), ["address", "document", "name"]);
    assert.deepEqual(Object.keys(input.address).sort(), ["city", "country", "number", "state", "street", "zipCode"]);
    assert.equal(input.document, "11222333000181");
    assert.equal(input.address.zipCode, "01001000");
    createdCompanies.push(input);
    const company = { ...input, id: "created-company", createdAt: "2026-10-17T12:00:00Z", address: { ...input.address, id: "new-address" } };
    accessibleCompanies = [...accessibleCompanies, { id: company.id, name: company.name, document: company.document, createdAt: company.createdAt, updatedAt: company.createdAt }];
    response.writeHead(201).end(JSON.stringify(company));
  } else if (request.url === "/companies" && request.method === "GET") {
    const status = request.headers.authorization === `Bearer ${token}` ? protectedStatus : 401;
    response.writeHead(status).end(JSON.stringify(status === 200 ? accessibleCompanies : { message: "private diagnostic" }));
  } else if (/^\/companies\/[^/]+\/categories(?:\/[^/]+)?$/.test(request.url)) {
    const [, , companyId, , categoryId] = request.url.split("/");
    if (request.headers.authorization !== `Bearer ${token}`) { response.writeHead(401).end("{}"); return; }
    if (!accessibleCompanies.some((company) => company.id === companyId)) { response.writeHead(403).end("{}"); return; }
    if (categoryStatus !== 200) { response.writeHead(categoryStatus).end(JSON.stringify({ message: "private category diagnostic" })); return; }
    const list = categories.get(companyId) ?? [];
    if (request.method === "GET" && !categoryId) { response.end(JSON.stringify(list)); return; }
    if (request.method === "DELETE" && categoryId) {
      const category = list.find((item) => item.id === categoryId);
      if (!category) { response.writeHead(404).end("{}"); return; }
      if (category.name === "Vinculada") { response.writeHead(409).end("{}"); return; }
      categories.set(companyId, list.filter((item) => item.id !== categoryId));
      response.writeHead(204).end(); return;
    }
    if (request.method === "POST" || request.method === "PATCH") {
      let body = ""; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body); assert.deepEqual(Object.keys(input), ["name"]);
      if (list.some((item) => item.name === input.name && item.id !== categoryId)) { response.writeHead(409).end("{}"); return; }
      const existing = categoryId ? list.find((item) => item.id === categoryId) : undefined;
      if (categoryId && !existing) { response.writeHead(404).end("{}"); return; }
      const category = { id: existing?.id ?? `category-${++categorySequence}`, name: input.name, companyId, createdAt: existing?.createdAt ?? "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" };
      categories.set(companyId, [...list.filter((item) => item.id !== category.id), category]);
      response.writeHead(existing ? 200 : 201).end(JSON.stringify(category)); return;
    }
    response.writeHead(405).end("{}");
  } else if (/^\/products\/[^/]+\/variants(?:\/[^/?]+)?\?companyId=[^&]+$/.test(request.url)) {
    if (request.headers.authorization !== `Bearer ${token}`) { response.writeHead(401).end("{}"); return; }
    if (variantStatus !== 200) { response.writeHead(variantStatus).end(JSON.stringify({ message: "private variant diagnostic" })); return; }
    const url = new URL(request.url, "http://mock.invalid");
    const [, , productId, , variantId] = url.pathname.split("/");
    const companyId = url.searchParams.get("companyId");
    const product = products.find((item) => item.id === productId && item.companyId === companyId && !item.deletedAt);
    if (!product || !accessibleCompanies.some((company) => company.id === companyId)) { response.writeHead(404).end("{}"); return; }
    if (request.method === "POST" && !variantId) {
      let body = ""; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body); assert.deepEqual(Object.keys(input).sort(), ["name", "price"]);
      if (product.type === "NORMAL" || (product.type === "VARIANT" ? input.price !== null : typeof input.price !== "number" || input.price <= 0)) { response.writeHead(400).end("{}"); return; }
      if (product.variants.some((variant) => variant.name === input.name)) { response.writeHead(409).end("{}"); return; }
      const variant = { ...input, id: `variant-${++variantSequence}`, productId, createdAt: product.createdAt, updatedAt: product.updatedAt };
      product.variants.push(variant); response.writeHead(201).end(JSON.stringify(variant)); return;
    }
    if (request.method === "PATCH" && variantId) {
      let body = ""; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      assert(Object.keys(input).length && Object.keys(input).every((key) => key === "name" || key === "price"));
      const variant = product.variants.find((item) => item.id === variantId);
      if (!variant) { response.writeHead(404).end("{}"); return; }
      if (product.type === "NORMAL" || (product.type === "VARIANT" && "price" in input) || ("price" in input && (typeof input.price !== "number" || input.price <= 0))) { response.writeHead(400).end("{}"); return; }
      variantUpdates.push({ productId, variantId, companyId, body: input });
      Object.assign(variant, input); response.end(JSON.stringify(variant)); return;
    }
    if (request.method === "DELETE" && variantId) {
      let body = ""; for await (const chunk of request) body += chunk;
      assert.equal(body, "", "Variant DELETE must not carry a body");
      const index = product.variants.findIndex((variant) => variant.id === variantId);
      if (index < 0) { response.writeHead(404).end("{}"); return; }
      product.variants.splice(index, 1); response.end(JSON.stringify({ message: "Product variant deleted successfully." })); return;
    }
    response.writeHead(405).end("{}");
  } else if (/^\/products(?:\/[^/?]+)?(?:\?companyId=[^&]+)?$/.test(request.url)) {
    if (request.headers.authorization !== `Bearer ${token}`) { response.writeHead(401).end("{}"); return; }
    if (productStatus !== 200) { response.writeHead(productStatus).end(JSON.stringify({ message: "private product diagnostic" })); return; }
    const url = new URL(request.url, "http://mock.invalid");
    const productId = url.pathname.split("/")[2];
    let input;
    if (request.method !== "GET") { let body = ""; for await (const chunk of request) body += chunk; input = JSON.parse(body); }
    const companyId = request.method === "GET" ? url.searchParams.get("companyId") : input.companyId;
    assert(companyId, "All product operations require company context");
    if (!accessibleCompanies.some((company) => company.id === companyId)) { response.writeHead(403).end("{}"); return; }
    const product = products.find((item) => item.id === productId && item.companyId === companyId && !item.deletedAt);
    if (request.method === "GET") {
      if (productId && !product) { response.writeHead(404).end("{}"); return; }
      response.end(JSON.stringify(productId ? product : products.filter((item) => item.companyId === companyId && !item.deletedAt))); return;
    }
    if (request.method === "DELETE") {
      assert.deepEqual(Object.keys(input), ["companyId"]);
      if (!product) { response.writeHead(404).end("{}"); return; }
      product.deletedAt = "2026-10-17T12:00:00Z";
      response.end(JSON.stringify({ message: "Product deleted successfully." })); return;
    }
    if (request.method === "PATCH") assert(!("variants" in input), "Variant updates are outside product PATCH");
    if (input.price !== undefined && input.price !== null) assert.equal(typeof input.price, "number");
    const category = (categories.get(companyId) ?? []).find((item) => item.id === (input.categoryId ?? product?.categoryId));
    if (!category) { response.writeHead(404).end("{}"); return; }
    if (request.method === "POST") {
      assert.deepEqual(Object.keys(input).sort(), ["categoryId", "companyId", "description", "name", "price", "type", ...(input.type === "NORMAL" ? [] : ["variants"])].sort());
      if (input.type === "NORMAL") { assert(input.price > 0); assert(!("variants" in input)); }
      else { assert(input.variants.length > 0); if (input.type === "VARIANT") { assert(input.price > 0); assert(input.variants.every((variant) => variant.price === null)); } else { assert.equal(input.price, null); assert(input.variants.every((variant) => typeof variant.price === "number" && variant.price > 0)); } }
      const id = `product-${++productSequence}`;
      const created = { ...input, id, category: { id: category.id, name: category.name }, variants: (input.variants ?? []).map((variant) => ({ ...variant, id: `variant-${++variantSequence}`, productId: id, createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" })), createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" };
      products.push(created); response.writeHead(201).end(JSON.stringify(created)); return;
    }
    if (request.method === "PATCH" && product) { Object.assign(product, input, { category: { id: category.id, name: category.name } }); response.end(JSON.stringify(product)); return; }
    response.writeHead(404).end("{}");
  } else {
    response.writeHead(404).end("{}");
  }
});

let app;
let output = "";
try {
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const backendAddress = backend.address();
  assert(backendAddress && typeof backendAddress === "object");
  const portReservation = createServer();
  portReservation.listen(0, "127.0.0.1");
  await once(portReservation, "listening");
  const appAddress = portReservation.address();
  assert(appAddress && typeof appAddress === "object");
  await new Promise((resolve) => portReservation.close(resolve));
  const origin = `http://127.0.0.1:${appAddress.port}`;
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appAddress.port)], {
    windowsHide: true,
    env: { ...process.env, NODE_ENV: "production", APP_ORIGIN: origin, API_BASE_URL: `http://127.0.0.1:${backendAddress.port}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on("data", (chunk) => { output = (output + chunk).slice(-6000); });
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const response = await fetch(origin);
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for the local production server only. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "Production server did not become ready");
  const request = (path, init = {}) => fetch(origin + path, { redirect: "manual", ...init });
  const cookieHeader = `__Host-cartly_session=${token}`;

  for (const path of ["/login", "/register", "/activate-account"]) {
    assert.equal((await request(path)).status, 200, "Authentication pages must remain public");
  }

  let response = await request("/dashboard");
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location"), origin).pathname, "/login");
  assert(!(await response.text()).includes("Visão geral do dashboard"));

  for (const path of ["/api/auth/login", "/api/auth/logout"]) {
    assert.equal((await request(path)).status, 405, "State changes must not accept GET");
    response = await request(path, { method: "POST", headers: { Origin: "https://evil.test" } });
    assert.equal(response.status, 403);
    assert(!response.headers.has("set-cookie"));
  }

  response = await request("/api/auth/login", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: safeUser.email, password: "synthetic-password", returnTo: "https://evil.test" }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie") ?? "";
  for (const flag of ["__Host-cartly_session=", "HttpOnly", "Secure", "SameSite=lax", "Path=/"]) {
    assert(cookie.includes(flag), "Missing cookie security attribute");
  }
  assert.match(response.headers.get("cache-control"), /no-store/);

  const loginBody = await response.text();
  assert(!loginBody.includes(token) && !loginBody.includes("synthetic-password"));
  assert.deepEqual(JSON.parse(loginBody), { user: safeUser, returnTo: "/dashboard" });

  const companyReads = upstreamPaths.filter((path) => path === "/companies").length;
  response = await request("/dashboard", { headers: { Cookie: cookieHeader } });
  assert.equal(response.status, 200);
  const protectedHtml = await response.text();
  assert(protectedHtml.includes("Visão geral do dashboard"), "Valid session must reach the protected dashboard");
  assert.equal(upstreamPaths.filter((path) => path === "/companies").length - companyReads, 1, "Layout and page must share one request-scoped access check");
  assert(!protectedHtml.includes(token), "JWT must not reach HTML/RSC payloads");
  assert.match(response.headers.get("cache-control"), /no-store/);

  accessibleCompanies = [];
  response = await request("/dashboard", { headers: { Cookie: cookieHeader } });
  assert((await response.text()).includes("/dashboard/onboarding"), "No companies must lead to onboarding boundary");
  response = await request("/dashboard/onboarding", { headers: { Cookie: cookieHeader } });
  assert((await response.text()).includes("Cadastre sua empresa"));
  assert.equal((await request("/dashboard/onboarding")).status, 303);
  accessibleCompanies = [companyFixtures[0]];

  const forgedCookie = `__Host-cartly_session=${jwt(Math.floor(Date.now() / 1000) + 300, "forged")}`;
  response = await request("/dashboard", { headers: { Cookie: forgedCookie } });
  const invalidHtml = await response.text();
  assert(!invalidHtml.includes("Visão geral do dashboard"), "Forged claims cannot authorize protected rendering");
  assert(response.status === 303 || invalidHtml.includes("/login?"), "Server rendering must redirect invalid sessions");
  response = await request("/login?reason=expired", { headers: { Cookie: forgedCookie } });
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert((await response.text()).includes("Sua sessão expirou"));

  response = await request("/api/auth/session", { headers: { Cookie: forgedCookie } });
  assert.equal(response.status, 401);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await response.json()).error.status, 401);

  protectedStatus = 403;
  response = await request("/api/auth/session", { headers: { Cookie: cookieHeader } });
  assert.equal(response.status, 403);
  assert(!response.headers.has("set-cookie"), "403 must not clear a session");
  response = await request("/dashboard", { headers: { Cookie: cookieHeader } });
  const deniedHtml = await response.text();
  assert(deniedHtml.includes("Acesso negado") && !deniedHtml.includes("Visão geral do dashboard"));
  assert(!response.headers.has("set-cookie"));
  protectedStatus = 200;

  response = await request("/dashboard", { headers: { Cookie: `__Host-cartly_session=${jwt(1)}` } });
  assert.equal(response.status, 303);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);

  response = await request("/api/auth/logout", { method: "POST", headers: { Origin: origin, Cookie: cookieHeader } });
  assert.equal(response.status, 303);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(new URL(response.headers.get("location"), origin).pathname, "/login");
  assert.equal((await request("/dashboard")).status, 303);
  if (process.argv.includes("--browser")) {
    const { checkAuthBrowser } = await import("./check-auth-browser.mjs");
    await checkAuthBrowser(origin, {
      setProtectedStatus: (status) => { protectedStatus = status; },
      setCompanies: (companies) => { accessibleCompanies = companies; },
      companyFixtures,
      createdCompanies,
      setCategoryStatus: (status) => { categoryStatus = status; },
      setProductStatus: (status) => { productStatus = status; },
      setVariantStatus: (status) => { variantStatus = status; },
      variantUpdates,
      products,
      getProductCategory: () => (categories.get("a") ?? [])[0],
    });
  }
  assert(upstreamPaths.every((path) => path === "/auth/login" || path === "/companies" || /^\/companies\/[^/]+\/categories(?:\/[^/]+)?$/.test(path) || /^\/products(?:\/[^/?]+)?(?:\?companyId=[^&]+)?$/.test(path) || /^\/products\/[^/]+\/variants(?:\/[^/?]+)?\?companyId=[^&]+$/.test(path)));
  console.log("PASS production auth: login, secure cookies, CSRF, GET 405, protected SSR, forged/expired JWT, 401 cleanup, 403 preservation, no-store, no token leakage, logout");
} catch (error) {
  console.error(error);
  if (output) console.error(output);
  process.exitCode = 1;
} finally {
  if (app) {
    const stopped = once(app, "exit");
    app.kill();
    await stopped;
  }
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
}
