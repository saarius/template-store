#!/usr/bin/env node
/**
 * Offline merchant migration qualification, NOT a signed-plugin upgrade or Stripe proof.
 * Needs built, dependency-installed Commerce v0.8.0 and server-cart source checkouts.
 * Creates only disposable synthetic data; never accepts a database or capability argument.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const load = (root, path) => import(pathToFileURL(join(root, path)).href);
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export function options(args) {
  if (args.length === 0) return null;
  assert.ok(args.includes("--check"), "Explicit --check required");
  assert.equal(args.length, 3, "Use --check --old=<built v0.8.0 checkout> --candidate=<built server-cart checkout>");
  const old = args.find((arg) => arg.startsWith("--old="))?.slice(6);
  const candidate = args.find((arg) => arg.startsWith("--candidate="))?.slice(12);
  assert.ok(old && candidate, "Both source checkout paths are required");
  return { old: resolve(old), candidate: resolve(candidate) };
}

async function freePort() {
  const server = createServer();
  await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((done) => child.once("exit", done));
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  await Promise.race([exited, pause(4000)]);
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    await exited;
  }
}

export async function qualify({ old, candidate }) {
  const git = (root, ...args) => {
    const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, "Source identity unavailable");
    return result.stdout.trim();
  };
  const oldHead = git(old, "rev-parse", "HEAD");
  assert.equal(oldHead, git(old, "rev-parse", "v0.8.0^{commit}"), "Old checkout must be exact v0.8.0");
  assert.equal(git(old, "status", "--porcelain"), "", "Old source must be unchanged");
  assert.equal(git(candidate, "status", "--porcelain"), "", "Candidate source must be unchanged");
  const candidateHead = git(candidate, "rev-parse", "HEAD");
  const previous = await load(old, "dist/features/checkout/index.js");
  const next = await load(candidate, "dist/features/checkout/index.js");
  assert.equal(typeof next.cartGuestCheckout, "function", "Candidate needs server-cart support");
  const { createPaidOrderReceiver } = await load(old, "dist/features/orders/index.js");
  const { seedGuestCatalog, syntheticCheckoutHost } = await load(candidate, "tests/features/checkout/guest-dispatch.mjs");
  const require = createRequire(join(candidate, "package.json"));
  const { Kysely } = await import(pathToFileURL(require.resolve("kysely")).href);
  const { createDialect } = await import(pathToFileURL(require.resolve("emdash/db/sqlite")).href);
  const { runMigrations } = await import(pathToFileURL(require.resolve("emdash/db")).href);
  const { PluginStorageRepository } = await import(pathToFileURL(require.resolve("emdash")).href);
  const Database = require("better-sqlite3");
  const directory = mkdtempSync(join(tmpdir(), "backroadbum-cart-upgrade-"));
  // Keep this disposable Astro site under the merchant checkout so it resolves
  // the exact serving project's peers, never a copied node_modules tree.
  const merchant = resolve(import.meta.dirname, "..");
  mkdirSync(join(merchant, "runs"), { recursive: true });
  const site = mkdtempSync(join(merchant, "runs", "recovery-qualification-"));
  const runtimeId = "r_gshdrqaldna3r7sn";
  const file = join(directory, "synthetic.db");
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const db = new Kysely({ dialect: createDialect({ url: `file:${file}` }) });
  let server;
  let raw;
  try {
    await runMigrations(db);
    await db.insertInto("options").values({ name: "emdash:site_url", value: JSON.stringify(origin) }).execute();
    const collection = (name) => new PluginStorageRepository(db, runtimeId, name, []);
    const storage = Object.fromEntries([
      ["catalogItems", "catalog_items"], ["catalogPrices", "catalog_prices"],
      ["catalogBackorderPolicies", "catalog_backorder_policies"], ["catalogManualAvailability", "catalog_manual_availability"],
      ["storeInventoryConfigurations", "store_inventory_configurations"], ["storefrontAvailabilitySettings", "storefront_availability_settings"],
      ["storefrontOutOfStockListing", "storefront_out_of_stock_listing"],
    ].map(([key, name]) => [key, collection(name)]));
    await seedGuestCatalog(storage, { itemId: "legacy-hat", price: "1600" });
    const carts = collection("checkout_carts");
    const capabilities = collection("checkout_guest_capabilities");
    const orders = collection("orders");
    const numbers = collection("order_numbers");
    const now = Math.floor(Date.now() / 1000);
    const scenarios = [];
    const contact = { email: "fixture@example.test", billing: { name: "Test Shopper", line1: "1 Example Way", city: "Testville", postalCode: "00000", country: "US" } };
    for (const state of ["pending", "paid"]) {
      const synth = syntheticCheckoutHost({ managed: false, host: { siteUrl: origin } });
      synth.setNow(state === "pending" ? now - 4000 : now);
      const runtime = { carts, capabilities, catalog: {
        catalog: storage.catalogItems, prices: storage.catalogPrices, backorderPolicies: storage.catalogBackorderPolicies,
        configurations: storage.storeInventoryConfigurations, settings: storage.storefrontAvailabilitySettings,
        listing: storage.storefrontOutOfStockListing, manualAvailability: storage.catalogManualAvailability,
      }, constructorSiteUrl: origin, host: synth.host, paidOrders: createPaidOrderReceiver(orders, numbers) };
      const prepared = await previous.prepareGuestCheckout(runtime);
      assert.equal(prepared.ok, true);
      const headers = { "x-commerce-guest-capability": prepared.capability.capability };
      const started = await previous.startGuestCheckout(runtime, { lines: [{ catalogItemId: "legacy-hat", quantity: 2 }], contact }, headers);
      assert.equal(started.ok, true, "Actual 0.8.0 kernel must create the attempt");
      assert.equal(started.checkout.state, "pending", `Old start: ${started.checkout.failure?.code ?? JSON.stringify(started.checkout.failure)}`);
      if (state === "paid") synth.setPayment("paid");
      else synth.setNow(now); // Past the payment window; open provider evidence must not release it.
      const before = await previous.statusGuestCheckout(runtime, {}, headers);
      assert.equal(before.ok, true);
      if (state === "paid") assert.equal(before.checkout.state, "paid");
      else {
        assert.notEqual(before.checkout.state, "paid");
        assert.notEqual(before.checkout.state, "released-retry");
      }
      const cart = (await carts.query()).items.find(({ data }) => data.attempts.some((attempt) => attempt.attemptId === before.checkout.attemptId));
      assert.deepEqual(Object.keys(cart.data), ["attempts"], "Old kernel, not a hand-written old shape");
      scenarios.push({ state, synth, runtime, headers, before: before.checkout, id: cart.id });
    }
    // Current catalog price is not the frozen purchase price. No code reads a real merchant catalog.
    const price = await storage.catalogPrices.get("legacy-hat");
    await storage.catalogPrices.put("legacy-hat", { ...price, regular: { currency: "USD", minor: "1400" } });
    raw = new Database(file, { readonly: true });
    const business = () => raw.prepare("SELECT collection,id,data,revision FROM _plugin_storage WHERE plugin_id=? AND collection IN ('checkout_carts','orders','order_numbers') ORDER BY collection,id").all(runtimeId);
    assert.equal(business().filter(row => row.collection === "checkout_carts").length, 2);
    assert.equal(business().filter(row => row.collection === "orders").length, 1);
    const baseline = hash(business());
    // Actual merchant route and anonymous EmDash dispatcher, not an HTTP bridge
    // or a replacement handler. Unsigned descriptor uses our runtime namespace.
    mkdirSync(join(site, "src/pages/api/checkout"), { recursive: true });
    writeFileSync(join(site, "src/pages/api/checkout/status.ts"),
      `export { POST, prerender } from ${JSON.stringify(join(merchant, "src/pages/api/checkout/status.ts"))};\n`);
    writeFileSync(join(site, "src/pages/index.astro"), "<h1>Disposable recovery qualification</h1>");
    writeFileSync(join(site, "astro.config.mjs"), `
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';
import descriptor from ${JSON.stringify(pathToFileURL(join(candidate, "dist/sandbox/index.mjs")).href)};
export default defineConfig({ output:'server', adapter:node({mode:'standalone'}),
  integrations:[emdash({database:sqlite({url:${JSON.stringify(`file:${file}`)}}),
    storage:local({directory:'.artifacts/uploads',baseUrl:'/_emdash/api/media/file'}),
    siteUrl:${JSON.stringify(origin)},sandboxRunner:'@emdash-cms/sandbox-workerd/sandbox',
    sandboxed:[{...descriptor,id:${JSON.stringify(runtimeId)},entrypoint:${JSON.stringify(join(candidate, "dist/sandbox/plugin.mjs"))}}]})],
  vite:{server:{fs:{allow:[${JSON.stringify(merchant)},${JSON.stringify(candidate)}]}}},
  devToolbar:{enabled:false} });\n`);
    const startServer = async protocol => {
      server = spawn(process.execPath, [join(merchant, "node_modules/astro/bin/astro.mjs"), "dev", "--force", "--host", "127.0.0.1", "--port", String(port)], {
        cwd: site, detached: true, stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1100", ASTRO_DEV_BACKGROUND: "1",
          EMDASH_SITE_URL: origin, BACKROADBUM_MERCHANT_PROFILE: "1", BACKROADBUM_RECOVERY_PROTOCOL: protocol,
          NO_PROXY: "127.0.0.1,localhost,::1", no_proxy: "127.0.0.1,localhost,::1" },
      });
      // Retain no logs: they may contain generated fixture capabilities.
      server.stdout.resume(); server.stderr.resume();
      let ready = false;
      for (let i = 0; i < 180 && server.exitCode === null; i++) {
        try { ready = (await fetch(origin, { signal: AbortSignal.timeout(2000) })).status < 500; } catch {}
        if (ready) break;
        await pause(500);
      }
      assert.ok(ready, "Isolated EmDash runtime did not start");
    };
    const wrapperPost = async (capability, from = origin, input = {}) => {
      const response = await fetch(`${origin}/api/checkout/status`, { method: "POST",
        headers: { origin: from, "content-type": "application/json", "x-commerce-guest-capability": capability },
        body: JSON.stringify(input), signal: AbortSignal.timeout(60000) });
      return { response, data: await response.json().catch(() => null) };
    };
    await startServer("status-v1");
    const beforeWrapper = await wrapperPost(scenarios[0].headers["x-commerce-guest-capability"]);
    assert.equal(beforeWrapper.response.status, 503, "Default legacy recovery must not silently switch routes");
    await stop(server); server = null;
    await startServer("cart-v1");
    const post = async (route, capability, from = origin, input = {}) => {
      const response = await fetch(`${origin}/_emdash/api/plugins/${runtimeId}/checkout/guest/${route}`, {
        method: "POST", headers: { origin: from, "content-type": "application/json", "x-commerce-guest-capability": capability },
        body: JSON.stringify(input), signal: AbortSignal.timeout(60000),
      });
      const body = await response.json().catch(() => null);
      return { response, data: body?.data ?? body };
    };
    const installed = [];
    for (const scenario of scenarios) {
      const read = await post("cart", scenario.headers["x-commerce-guest-capability"]);
      assert.equal(read.response.status, 200);
      assert.equal(read.data?.ok, true, "Installed cart read refused the old capability");
      for (const fact of ["schema", "attemptId", "lines", "total"]) {
        assert.deepEqual(read.data.checkout[fact], scenario.before[fact], `Installed cart must preserve frozen ${fact}`);
      }
      if (scenario.before.order) {
        for (const fact of ["orderId", "receiptId", "lines", "total"]) {
          assert.deepEqual(read.data.checkout.order?.[fact], scenario.before.order[fact], `Installed cart must preserve frozen order ${fact}`);
        }
        // New candidate adds authorized frozen contact; whole-order equivalence
        // with the old projection is deliberately NOT asserted.
        if (read.data.checkout.order?.contact !== undefined) assert.equal(read.data.checkout.order.contact.email, contact.email);
      } else assert.equal(read.data.checkout.order, null);
      assert.equal(read.data.checkout.state, scenario.state);
      if (scenario.state === "pending") assert.equal(read.data.checkout.redirectUrl, null, "An elapsed payment window is not a payable redirect");
      assert.deepEqual(read.data.cart.lines, []);
      assert.equal(read.data.checkout.total.minor, "3200", "No repricing old purchases");
      assert.match(read.response.headers.get("cache-control"), /no-store/);
      const denied = await post("cart", "guessed.key");
      assert.equal(denied.data?.error?.code, "CAPABILITY_DENIED");
      const foreign = await post("cart", scenario.headers["x-commerce-guest-capability"], "https://foreign.example.test");
      assert.ok(["ORIGIN_DENIED", "CSRF_REJECTED"].includes(foreign.data?.error?.code), "Host or plugin must refuse the foreign origin");
      const frozen = await post("cart", scenario.headers["x-commerce-guest-capability"], origin, { version: read.data.cart.version, lines: [] });
      assert.equal(frozen.data?.error?.code, "CHECKOUT_FROZEN");
      const wrapped = await wrapperPost(scenario.headers["x-commerce-guest-capability"], origin, { attemptId: scenario.before.attemptId });
      assert.equal(wrapped.response.status, 200, "Actual merchant wrapper must recover the original capability");
      assert.equal(wrapped.data?.checkout?.state, scenario.state);
      for (const fact of ["schema", "attemptId"]) assert.deepEqual(wrapped.data.checkout[fact], scenario.before[fact]);
      // The existing merchant wire omits top-level total (it uses pricing when
      // available). Do not invent pricing for this unpriced legacy fixture.
      if (scenario.state === "paid") {
        assert.equal(wrapped.data.checkout.order?.orderId, scenario.before.order?.orderId);
        assert.equal(wrapped.data.checkout.order?.receiptId, scenario.before.order?.receiptId);
        assert.equal(wrapped.data.checkout.order?.total?.minor, "3200");
        assert.equal(wrapped.data.checkout.order?.lines?.[0]?.quantity, 2);
        assert.equal(wrapped.data.checkout.order?.contact?.email, read.data.checkout.order?.contact?.email);
      } else assert.equal(wrapped.data.checkout.redirectUrl, null);
      assert.equal(wrapped.data.cart, undefined, "Wrapper cannot expose mutable cart data");
      assert.match(wrapped.response.headers.get("cache-control"), /no-store/);
      for (const [cap, from, input, expected] of [
        ["guessed.key", origin, {}, 503], [scenario.headers["x-commerce-guest-capability"], "https://foreign.example.test", {}, 403],
        [scenario.headers["x-commerce-guest-capability"], origin, { lines: [], version: read.data.cart.version }, 400],
        [scenario.headers["x-commerce-guest-capability"], origin, { attemptId: "another-attempt" }, 503],
      ]) {
        const refused = await wrapperPost(cap, from, input);
        assert.equal(refused.response.status, expected);
        assert.equal(refused.data?.checkout, undefined);
      }
      installed.push({ priorAttempt: scenario.state, oldStatusState: scenario.before.state, currentState: read.data.checkout.state,
        frozenFactsEqual: true, frozenTotal: "3200", emptyNewCart: true, forgedDenied: true, foreignDenied: true, writeFrozen: true,
        merchantWrapperHTTP: wrapped.response.status, wrapperSameAttempt: true,
        wrapperPaidReceiptTotalPreserved: scenario.state === "paid" ? true : null, wrapperRefusesMutationAndOtherAttempt: true });
    }
    assert.equal(hash(business()), baseline, "Installed inspection must not rewrite old carts or Orders");
    const status = await post("status", scenarios[0].headers["x-commerce-guest-capability"]);
    assert.ok([401, 404].includes(status.response.status), "Removed Registry status route cannot return shopper status");
    await stop(server); server = null;
    const kernel = [];
    for (const scenario of scenarios) {
      const initialEnsures = scenario.synth.counts().paymentCreates;
      const initialSessions = scenario.synth.sessions.size;
      const replay = await next.startGuestCheckout(scenario.runtime, { contact }, scenario.headers);
      assert.equal(replay.ok, true);
      assert.equal(replay.checkout.attemptId, scenario.before.attemptId);
      assert.equal(replay.checkout.total.minor, "3200");
      assert.equal(replay.checkout.state, scenario.before.state);
      scenario.synth.setPayment("paid");
      const paid = await next.cartGuestCheckout(scenario.runtime, {}, scenario.headers);
      assert.equal(paid.ok, true);
      assert.equal(paid.checkout.state, "paid");
      assert.equal(paid.checkout.attemptId, scenario.before.attemptId);
      assert.equal(scenario.synth.sessions.size, initialSessions, "Never create a replacement provider session");
      kernel.push({ priorState: scenario.state, sameAttempt: true, sameTotal: true, reconciledPaid: true,
        ensureSessionCalls: scenario.synth.counts().paymentCreates - initialEnsures, newProviderSessions: 0 });
    }
    assert.equal((await orders.query()).items.length, 2, "One canonical order per legacy attempt");
    return { checkedAt: new Date().toISOString(), oldHead, candidateHead,
      candidatePluginSHA256: createHash("sha256").update(readFileSync(join(candidate, "dist/sandbox/plugin.mjs"))).digest("hex"),
      scope: "Actual 0.8.0 kernel writes; candidate installed Registry and actual merchant wrapper reads without Payments; candidate kernel replay with synthetic Payments. Frozen facts, not whole-response equivalence",
      installed, legacyStatusHTTP: status.response.status, defaultWrapperHTTP: beforeWrapper.response.status,
      installedBusinessUnchanged: true, kernel, canonicalOrders: 2,
      liveDataUsed: false, hostedPaymentsProven: false, signedUpgradeProven: false };
  } finally {
    await stop(server);
    raw?.close();
    await db.destroy();
    rmSync(directory, { recursive: true, force: true });
    rmSync(site, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    const input = options(process.argv.slice(2));
    if (input) console.log(JSON.stringify(await qualify(input), null, 2));
    else console.log("No action. Use --check --old=<built v0.8.0 checkout> --candidate=<built server-cart checkout>.");
  } catch {
    // Do not print assertion payloads: projections and headers contain synthetic private facts.
    console.error("Server-cart qualification failed; no live data was used. Inspect assertions privately.");
    process.exitCode = 1;
  }
}
