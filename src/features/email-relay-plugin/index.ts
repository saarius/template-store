import { definePlugin } from "emdash";
import type { EmailDeliverEvent } from "emdash/plugin";

/** Node-native transport. Credentials are read only when EmDash delivers mail. */
export async function deliverEmail({ message }: EmailDeliverEvent): Promise<void> {
  const endpoint = process.env.BACKROADBUM_EMAIL_RELAY_URL;
  const token = process.env.BACKROADBUM_EMAIL_RELAY_TOKEN;
  const from = process.env.BACKROADBUM_EMAIL_FROM;
  let url: URL;
  try {
    url = new URL(endpoint ?? "");
    if (url.origin !== "https://backroadbum-email.tsaari71.workers.dev" ||
        url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
        !token?.trim() || !from || !/^[^\s@]+@backroadbum\.com$/.test(from)) throw Error();
  } catch {
    throw new Error("Email relay is not configured correctly.");
  }

  // No automatic retries: a timed-out delivery may already have sent an OTP.
  // Never propagate provider bodies/network errors, which may contain message data.
  try {
    const response = await fetch(new URL("/send", url), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, from: { name: "Backroad Bum", email: from } }),
    });
    if (!response.ok || (await response.json()).ok !== true) throw Error();
  } catch {
    throw new Error("Email relay could not deliver this message. Check the provider configuration and verified destinations.");
  }
}

export function createPlugin() {
  return definePlugin({
    id: "backroadbum-email-relay",
    version: "1.0.0",
    capabilities: ["hooks.email-transport:register"],
    hooks: { "email:deliver": { exclusive: true, timeout: 20_000, handler: deliverEmail } },
  });
}
