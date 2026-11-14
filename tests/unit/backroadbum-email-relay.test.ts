import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlugin, deliverEmail } from "../../src/features/email-relay-plugin";

const message = { to: "shopper-test@backroadbum.com", subject: "Synthetic test", text: "Synthetic body",
  html: "<p>Synthetic body</p>", replyTo: "reply@example.test", cc: ["cc@example.test"] };
const event = { source: "system", message };
const endpoint = "https://backroadbum-email.tsaari71.workers.dev";
const fakeToken = "synthetic-test-token";

describe("native HTTPS email relay", () => {
  beforeEach(() => {
    vi.stubEnv("BACKROADBUM_EMAIL_RELAY_URL", endpoint);
    vi.stubEnv("BACKROADBUM_EMAIL_RELAY_TOKEN", fakeToken);
    vi.stubEnv("BACKROADBUM_EMAIL_FROM", "noreply@backroadbum.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("registers only an exclusive delivery hook with its native capability", () => {
    const plugin = createPlugin();
    expect(plugin.capabilities).toEqual(["hooks.email-transport:register"]);
    expect(plugin.hooks?.["email:deliver"]).toMatchObject({ exclusive: true, timeout: 20_000, handler: deliverEmail });
  });
  it("reads rotated credentials at delivery, preserves message fields and never retries", async () => {
    vi.stubEnv("BACKROADBUM_EMAIL_RELAY_TOKEN", "rotated-synthetic-token");
    await deliverEmail(event);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(`${endpoint}/send`);
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.headers).toEqual({ Authorization: "Bearer rotated-synthetic-token", "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({ from: { name: "Backroad Bum", email: "noreply@backroadbum.com" }, ...message });
  });
  it.each(["", "http://backroadbum-email.tsaari71.workers.dev", "https://other.example.test", `${endpoint}/unexpected`,
    `${endpoint}?secret=x`, `${endpoint}#fragment`, "https://user:pass@backroadbum-email.tsaari71.workers.dev"])("rejects an unsafe relay endpoint %s", async value => {
    vi.stubEnv("BACKROADBUM_EMAIL_RELAY_URL", value);
    await expect(deliverEmail(event)).rejects.toThrow("not configured correctly");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([["BACKROADBUM_EMAIL_RELAY_TOKEN", ""], ["BACKROADBUM_EMAIL_RELAY_TOKEN", " "],
    ["BACKROADBUM_EMAIL_FROM", ""], ["BACKROADBUM_EMAIL_FROM", "someone@example.test"],
    ["BACKROADBUM_EMAIL_FROM", "noreply@backroadbum.com\nBcc: private"]])("fails closed on invalid runtime configuration", async (name, value) => {
    vi.stubEnv(name, value);
    await expect(deliverEmail(event)).rejects.toThrow("not configured correctly");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([403, 429, 500])("redacts provider rejection %s", async status => {
    vi.mocked(fetch).mockResolvedValue(new Response(`private ${fakeToken} ${message.text}`, { status }));
    await expect(deliverEmail(event)).rejects.toThrow(/^Email relay could not deliver this message\./);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["bad-json", JSON.stringify({ ok: false }), JSON.stringify({})])("requires explicit success, not just HTTP 200", async body => {
    vi.mocked(fetch).mockResolvedValue(new Response(body));
    await expect(deliverEmail(event)).rejects.toThrow(/^Email relay could not deliver this message\./);
  });
  it("redacts network failures and does not attach a private cause", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error(`private ${fakeToken} ${message.text}`));
    try { await deliverEmail(event); expect.fail("should reject"); }
    catch (error) {
      expect(String(error)).not.toMatch(/synthetic-test-token|Synthetic body|private/);
      expect((error as Error).cause).toBeUndefined();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
