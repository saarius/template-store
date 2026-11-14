// Operator-only relay access. Never return message content in a public report.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function emailTestConfig() {
  const env = parseEnv(readFileSync('/etc/backroadbum/email.env', 'utf8'));
  if (env.BACKROADBUM_EMAIL_RELAY_URL !== 'https://backroadbum-email.tsaari71.workers.dev' ||
      !env.BACKROADBUM_EMAIL_RELAY_TOKEN || env.BACKROADBUM_TEST_SHOPPER_EMAIL !== 'shopper-test@backroadbum.com') {
    throw Error('Verified test inbox configuration unavailable');
  }
  return { url: env.BACKROADBUM_EMAIL_RELAY_URL, token: env.BACKROADBUM_EMAIL_RELAY_TOKEN,
    to: env.BACKROADBUM_TEST_SHOPPER_EMAIL };
}

export async function inboxRequest(config, method = 'GET') {
  try {
    const response = await fetch(`${config.url}/inbox?to=${encodeURIComponent(config.to)}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${config.token}` },
    });
    const body = await response.json();
    if (!response.ok || body.ok !== true) throw Error();
    return body;
  } catch { throw Error('Verified test inbox unavailable; private response withheld'); }
}

export async function waitForInbox(config, accept, since) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const body = await inboxRequest(config);
    const match = (body.messages ?? []).find(message => {
      // Worker timestamp is a Unix millisecond value or an ISO timestamp.
      const received = typeof message.receivedAt === 'number' ? message.receivedAt : Date.parse(message.receivedAt);
      return received >= since - 2000 && accept(message);
    });
    if (match) return match;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw Error('Timed out awaiting real inbound test mail; no automatic resend');
}
