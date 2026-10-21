import { COMMERCE_RUNTIME_ID } from "../commerce-profile/selected.js";

export const SHOPPER_SESSION_STORAGE_KEY = "dinkus.shopper-session.v1";
export const SHOPPER_SESSION_HEADER = "x-commerce-customer-session";
export const DEMO_SHOPPER_EMAIL = "shopper@example.com";
export const DEMO_SHOPPER_ORDER_ID = "ord_demo_shopper_1001";
export const DEMO_SHOPPER_ORDER_NUMBER = 1001;

export const SHOPPER_SIGN_IN_START_ENDPOINT =
  `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/sign-in/start`;
export const SHOPPER_SIGN_IN_VERIFY_ENDPOINT =
  `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/sign-in/verify`;
export const SHOPPER_SIGN_OUT_ENDPOINT =
  `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/sign-out`;
export const SHOPPER_ORDERS_ENDPOINT =
  `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/orders`;
export const SHOPPER_PROFILE_ENDPOINT =
  `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/profile`;
export const PLAYGROUND_DEMO_SESSION_ENDPOINT = "/api/account/demo-session";
export const SHOPPER_CATALOG_SNAPSHOT_ENDPOINT = "/api/guest-cart/snapshot";

const MAX_SESSION_TOKEN_LENGTH = 256;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,96}\.[A-Za-z0-9_-]{16,128}$/u;

export type StoredShopperSession = Readonly<{
  sessionId: string;
  sessionToken: string;
  email: string;
  expiresAt: number;
}>;

export interface ShopperSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ShopperDeliveryAddress = Readonly<{
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
}>;

export type ShopperProfile = Readonly<{
  email: string;
  phone: string | null;
  delivery: ShopperDeliveryAddress | null;
}>;

export type ShopperOrderOptionSelection = Readonly<{
  optionId?: string;
  optionLabel: string;
  valueId?: string;
  valueLabel: string;
}>;

export type ShopperOrderVariantChoice = Readonly<{
  productId?: string;
  catalogItemId: string;
  selections: readonly ShopperOrderOptionSelection[];
  fulfillment?: "physical" | "digital";
}>;

export type ShopperOrderLine = Readonly<{
  catalogItemId: string;
  name: string;
  quantity: number;
  unitPrice: Readonly<{ currency: string; minor: string }>;
  sku?: string | null;
  variant?: string | null;
  variantLabel?: string | null;
  options?: readonly ShopperOrderOptionSelection[] | null;
  selections?: readonly ShopperOrderOptionSelection[] | null;
  fulfillment?: "physical" | "digital" | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  image?: string | Readonly<{ src?: string | null; alt?: string | null }> | null;
}>;

export type ShopperOrderItem = Readonly<{
  orderId: string;
  receiptId: string;
  number: number | null;
  status: "processing" | "completed";
  paidAt: string | null;
  total: Readonly<{ currency: string; minor: string }>;
  lines: readonly ShopperOrderLine[];
  choices?: readonly ShopperOrderVariantChoice[];
  variantSelections?: readonly ShopperOrderVariantChoice[];
  delivery: ShopperDeliveryAddress | null;
  phone: string | null;
}>;

export type ShopperOrderCatalogSnapshot = Readonly<{
  id: string;
  found: boolean;
  name?: string;
  sku?: string;
  fulfillment?: "physical" | "digital";
  variant?: string | null;
  variantLabel?: string | null;
  options?: readonly ShopperOrderOptionSelection[] | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  image?: string | Readonly<{ src?: string | null; alt?: string | null }> | null;
}>;

export type ShopperOrderLinePresentation = Readonly<{
  catalogItemId: string;
  name: string;
  quantity: number;
  unitPriceText: string;
  thumbnailUrl: string | null;
  thumbnailAlt: string;
  sku: string | null;
  variantLabel: string | null;
  fulfillmentLabel: string | null;
}>;

type KnownCatalogMetadata = Readonly<{
  sku: string;
  thumbnailUrl: string;
  variantLabel: string;
  fulfillment: "physical" | "digital";
}>;

const KNOWN_ORDER_LINE_METADATA: Readonly<Record<string, KnownCatalogMetadata>> = {
  "demo-hosted-shirt": {
    sku: "DEMO-HOSTED-SHIRT",
    thumbnailUrl: "/images/products/shirt.svg",
    variantLabel: "Heavyweight Cotton · Regular Fit",
    fulfillment: "physical",
  },
  "demo-hosted-cap": {
    sku: "DEMO-HOSTED-CAP",
    thumbnailUrl: "/images/products/cap.svg",
    variantLabel: "6-Panel Canvas · One Size",
    fulfillment: "physical",
  },
  "demo-hosted-hoodie": {
    sku: "DEMO-HOSTED-HOODIE",
    thumbnailUrl: "/images/products/hoodie.svg",
    variantLabel: "Fleece Pullover · Standard",
    fulfillment: "physical",
  },
  "demo-hosted-hoodie-s": {
    sku: "DEMO-HOSTED-HOODIE-S",
    thumbnailUrl: "/images/products/hoodie.svg",
    variantLabel: "Size: Small",
    fulfillment: "physical",
  },
  "demo-hosted-hoodie-m": {
    sku: "DEMO-HOSTED-HOODIE-M",
    thumbnailUrl: "/images/products/hoodie.svg",
    variantLabel: "Size: Medium",
    fulfillment: "physical",
  },
  "demo-hosted-mug": {
    sku: "DEMO-HOSTED-MUG",
    thumbnailUrl: "/images/products/mug.svg",
    variantLabel: "Stoneware · 12 oz",
    fulfillment: "physical",
  },
  "demo-hosted-tote": {
    sku: "DEMO-HOSTED-TOTE",
    thumbnailUrl: "/images/products/tote.svg",
    variantLabel: "Heavy Canvas · Gusseted",
    fulfillment: "physical",
  },
  "demo-hosted-throw": {
    sku: "DEMO-HOSTED-THROW",
    thumbnailUrl: "/images/products/throw.svg",
    variantLabel: "Woven Cotton · Standard",
    fulfillment: "physical",
  },
  "demo-hosted-tray": {
    sku: "DEMO-HOSTED-TRAY",
    thumbnailUrl: "/images/products/tray.svg",
    variantLabel: "Pressed Alloy · Desk Size",
    fulfillment: "physical",
  },
  "demo-hosted-socks": {
    sku: "DEMO-HOSTED-SOCKS",
    thumbnailUrl: "/images/products/socks.svg",
    variantLabel: "Ribbed Crew · One Size",
    fulfillment: "physical",
  },
  "demo-hosted-bottle": {
    sku: "DEMO-HOSTED-BOTTLE",
    thumbnailUrl: "/images/products/bottle.svg",
    variantLabel: "Insulated Steel · 20 oz",
    fulfillment: "physical",
  },
  "dinkus-template-managed-product": {
    sku: "DINKUS-DEMO-MANAGED",
    thumbnailUrl: "/merch/tee.svg",
    variantLabel: "Everyday Tee · Standard",
    fulfillment: "physical",
  },
  "dinkus-template-unmanaged-product": {
    sku: "DINKUS-DEMO-UNMANAGED",
    thumbnailUrl: "/merch/cap.svg",
    variantLabel: "Canvas Cap · One Size",
    fulfillment: "physical",
  },
  "dinkus-template-preview-boxy-tee": {
    sku: "DINKUS-PREVIEW-BOXY-TEE",
    thumbnailUrl: "/merch/tee.svg",
    variantLabel: "Boxy Tee · Relaxed",
    fulfillment: "physical",
  },
  "dinkus-template-preview-hoodie": {
    sku: "DINKUS-PREVIEW-HOODIE",
    thumbnailUrl: "/merch/hoodie.svg",
    variantLabel: "Pullover Hoodie · Standard",
    fulfillment: "physical",
  },
  "dinkus-template-preview-beanie": {
    sku: "DINKUS-PREVIEW-BEANIE",
    thumbnailUrl: "/merch/beanie.svg",
    variantLabel: "Ribbed Beanie · One Size",
    fulfillment: "physical",
  },
  "everyday-tee": {
    sku: "DINKUS-DEMO-MANAGED",
    thumbnailUrl: "/merch/tee.svg",
    variantLabel: "Everyday Tee · Standard",
    fulfillment: "physical",
  },
  "canvas-cap": {
    sku: "DINKUS-DEMO-UNMANAGED",
    thumbnailUrl: "/merch/cap.svg",
    variantLabel: "Canvas Cap · One Size",
    fulfillment: "physical",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeThumbnailUrl(value: unknown): string | null {
  if (isRecord(value)) {
    return safeThumbnailUrl(value.src);
  }
  const candidate = cleanText(value);
  if (!candidate) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) {
    return candidate;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return candidate;
    }
  } catch {
    return null;
  }
  return null;
}

function formatOptionSelections(
  selections: readonly ShopperOrderOptionSelection[] | null | undefined,
): string | null {
  if (!Array.isArray(selections) || selections.length === 0) return null;
  const parts: string[] = [];
  for (const item of selections) {
    if (!isRecord(item)) continue;
    const optionLabel = cleanText(item.optionLabel);
    const valueLabel = cleanText(item.valueLabel);
    if (optionLabel && valueLabel) {
      parts.push(`${optionLabel}: ${valueLabel}`);
    } else if (valueLabel) {
      parts.push(valueLabel);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function lookupKnownMetadata(
  ...keys: Array<string | null | undefined>
): KnownCatalogMetadata | null {
  for (const rawKey of keys) {
    const normalized = cleanText(rawKey)?.toLowerCase();
    if (!normalized) continue;
    const direct = KNOWN_ORDER_LINE_METADATA[normalized];
    if (direct) return direct;
  }
  return null;
}

function inferVariantFromCode(code: string | null | undefined): string | null {
  const normalized = cleanText(code)?.toUpperCase();
  if (!normalized) return null;
  if (normalized.endsWith("-XS")) return "Size: XS";
  if (normalized.endsWith("-S")) return "Size: Small";
  if (normalized.endsWith("-M")) return "Size: Medium";
  if (normalized.endsWith("-L")) return "Size: Large";
  if (normalized.endsWith("-XL")) return "Size: XL";
  return null;
}

function inferGarmentThumbnail(
  ...hints: Array<string | null | undefined>
): string | null {
  const combined = hints
    .map((hint) => cleanText(hint)?.toLowerCase() ?? "")
    .join(" ");
  if (!combined) return null;
  if (combined.includes("hoodie")) return "/images/products/hoodie.svg";
  if (combined.includes("beanie")) return "/merch/beanie.svg";
  if (combined.includes("cap") || combined.includes("hat")) return "/images/products/cap.svg";
  if (combined.includes("mug")) return "/images/products/mug.svg";
  if (combined.includes("tote")) return "/images/products/tote.svg";
  if (combined.includes("throw") || combined.includes("blanket")) return "/images/products/throw.svg";
  if (combined.includes("tray")) return "/images/products/tray.svg";
  if (combined.includes("sock")) return "/images/products/socks.svg";
  if (combined.includes("bottle")) return "/images/products/bottle.svg";
  if (combined.includes("shirt") || combined.includes("tee")) return "/images/products/shirt.svg";
  return null;
}

export function resolveOrderLinePresentation(
  line: ShopperOrderLine,
  context?: {
    order?: Pick<ShopperOrderItem, "choices" | "variantSelections"> | null;
    snapshot?: ShopperOrderCatalogSnapshot | null;
  },
): ShopperOrderLinePresentation {
  const snapshot = context?.snapshot?.found ? context.snapshot : null;
  const orderChoices = context?.order?.choices ?? context?.order?.variantSelections ?? [];
  const matchingChoice = Array.isArray(orderChoices)
    ? orderChoices.find((choice) => isRecord(choice) && choice.catalogItemId === line.catalogItemId)
    : undefined;

  const known = lookupKnownMetadata(
    line.catalogItemId,
    matchingChoice?.productId,
    line.sku,
    snapshot?.sku,
    snapshot?.id,
  );

  const sku =
    cleanText(line.sku) ??
    cleanText(snapshot?.sku) ??
    known?.sku ??
    null;

  const variantLabel =
    cleanText(line.variantLabel) ??
    cleanText(line.variant) ??
    formatOptionSelections(line.options ?? line.selections) ??
    formatOptionSelections(matchingChoice?.selections) ??
    cleanText(snapshot?.variantLabel) ??
    cleanText(snapshot?.variant) ??
    formatOptionSelections(snapshot?.options) ??
    known?.variantLabel ??
    inferVariantFromCode(sku ?? line.catalogItemId) ??
    null;

  const rawFulfillment =
    line.fulfillment ??
    matchingChoice?.fulfillment ??
    snapshot?.fulfillment ??
    known?.fulfillment ??
    null;
  const fulfillmentLabel =
    rawFulfillment === "physical"
      ? "Physical"
      : rawFulfillment === "digital"
        ? "Digital"
        : null;

  const explicitThumb =
    safeThumbnailUrl(line.thumbnailUrl) ??
    safeThumbnailUrl(line.imageUrl) ??
    safeThumbnailUrl(line.image) ??
    safeThumbnailUrl(snapshot?.thumbnailUrl) ??
    safeThumbnailUrl(snapshot?.imageUrl) ??
    safeThumbnailUrl(snapshot?.image);

  const hasCatalogOrLineMetadata = Boolean(
    snapshot ||
      known ||
      sku ||
      variantLabel ||
      fulfillmentLabel,
  );

  const thumbnailUrl =
    explicitThumb ??
    known?.thumbnailUrl ??
    inferGarmentThumbnail(line.catalogItemId, matchingChoice?.productId, sku, line.name, snapshot?.name) ??
    (hasCatalogOrLineMetadata ? "/merch/tee.svg" : null);

  const explicitAlt =
    (isRecord(line.image) ? cleanText(line.image.alt) : null) ??
    (isRecord(snapshot?.image) ? cleanText(snapshot.image.alt) : null);

  return {
    catalogItemId: line.catalogItemId,
    name: line.name,
    quantity: line.quantity,
    unitPriceText: formatOrderMoney(line.unitPrice),
    thumbnailUrl,
    thumbnailAlt: explicitAlt ?? `${line.name} thumbnail`,
    sku,
    variantLabel,
    fulfillmentLabel,
  };
}

export function isValidShopperSessionToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SESSION_TOKEN_LENGTH &&
    SESSION_TOKEN_PATTERN.test(value)
  );
}

export function readBrowserShopperStorage(): ShopperSessionStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredShopperSession(
  storage: ShopperSessionStorage | null = readBrowserShopperStorage(),
  nowSeconds = Math.floor(Date.now() / 1000),
): StoredShopperSession | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(SHOPPER_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const { sessionId, sessionToken, email, expiresAt } = parsed;
    if (
      typeof sessionId !== "string" ||
      sessionId.trim().length < 8 ||
      !isValidShopperSessionToken(sessionToken) ||
      typeof email !== "string" ||
      !email.includes("@") ||
      typeof expiresAt !== "number" ||
      !Number.isFinite(expiresAt)
    ) {
      return null;
    }
    if (expiresAt <= nowSeconds) {
      clearStoredShopperSession(storage);
      return null;
    }
    return {
      sessionId,
      sessionToken,
      email: email.trim().toLowerCase(),
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function saveStoredShopperSession(
  session: StoredShopperSession,
  storage: ShopperSessionStorage | null = readBrowserShopperStorage(),
): boolean {
  if (!storage || !isValidShopperSessionToken(session.sessionToken)) return false;
  try {
    storage.setItem(
      SHOPPER_SESSION_STORAGE_KEY,
      JSON.stringify({
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
        email: session.email.trim().toLowerCase(),
        expiresAt: session.expiresAt,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearStoredShopperSession(
  storage: ShopperSessionStorage | null = readBrowserShopperStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(SHOPPER_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors in restricted browser contexts.
  }
}

export function formatOrderMoney(money: Readonly<{ currency: string; minor: string }> | undefined | null): string {
  if (!money || money.currency !== "USD") return "$0.00";
  const minor = Number(money.minor);
  if (!Number.isSafeInteger(minor) || minor < 0) return "$0.00";
  return `$${(minor / 100).toFixed(2)}`;
}

export function unwrapPluginEnvelope(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.success === "boolean") {
    if (payload.success && isRecord(payload.data)) {
      return payload.data;
    }
    if (!payload.success && isRecord(payload.error)) {
      return { ok: false, error: payload.error };
    }
  }
  return payload;
}
