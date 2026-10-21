import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const proofRoot = resolve("runs/shopper-account-20261020/browser");

test("storefront /account supports both instant demo opt-out and verified email OTP opt-in, plus /cart prefill", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const root = resolve(proofRoot, testInfo.project.name);
  await mkdir(root, { recursive: true });
  expect((await request.get("/_emdash/api/setup/dev-bypass")).ok()).toBe(true);

  await page.goto("/");
  const headerAccountLink = page.locator("[data-store-header] [data-shopper-account-nav]");
  await expect(headerAccountLink).toBeVisible();
  await expect(headerAccountLink).toHaveAttribute("href", "/account");
  await headerAccountLink.click();

  await expect(page).toHaveURL(/\/account$/u);
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await expect(page.locator("[data-account-demo-card]")).toBeVisible();

  const signedOutLayout = await page.evaluate(() => {
    const stamp = document.querySelector("[data-account-signed-out] [data-account-stamp-card]");
    const vault = document.querySelector("[data-account-signed-out] [data-account-vault-card]");
    if (!(stamp instanceof HTMLElement) || !(vault instanceof HTMLElement)) return null;
    const stampStyle = getComputedStyle(stamp);
    const vaultStyle = getComputedStyle(vault);
    const stampRect = stamp.getBoundingClientRect();
    const vaultRect = vault.getBoundingClientRect();
    const horizontalGap = Math.max(vaultRect.left - stampRect.right, stampRect.left - vaultRect.right);
    const verticalGap = Math.max(vaultRect.top - stampRect.bottom, stampRect.top - vaultRect.bottom);
    return {
      stampBg: stampStyle.backgroundColor,
      vaultBg: vaultStyle.backgroundColor,
      vaultShadow: vaultStyle.boxShadow,
      separated: horizontalGap >= 20 || verticalGap >= 20,
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(signedOutLayout).toEqual({
    stampBg: "rgb(252, 251, 248)",
    vaultBg: "rgb(27, 42, 74)",
    vaultShadow: "rgb(217, 56, 30) 0px 7px 0px 0px",
    separated: true,
    noOverflow: true,
  });

  await page.screenshot({ path: resolve(root, "account-signed-out.png") });

  // 1. Path 2: Opt-Out Instant Demo Account (No PIN required, zero marketing lead capture)
  await page.locator("[data-account-demo-signin]").click();
  await expect(page.locator("[data-account-signed-in]")).toBeVisible();
  await expect(page.locator("[data-account-signed-out]")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Welcome, shopper@example.com" })).toBeFocused();
  await expect(page.locator("[data-account-current-email]")).toHaveText("shopper@example.com");
  await expect(page.locator('[data-account-order="ord_demo_shopper_1001"]')).toBeVisible();
  await expect(page.locator("[data-account-order-number]")).toContainText("Order #1001");
  await expect(page.locator("[data-account-order-total]")).toHaveText("$38.00");

  const orderLine = page.locator(
    '.account-order-card__lines [data-account-order-line="demo-hosted-shirt"]',
  );
  await expect(orderLine).toBeVisible();
  const orderLineImage = orderLine.locator("[data-account-order-line-image]");
  await expect(orderLineImage).toBeVisible();
  await expect(orderLineImage).toHaveAttribute("src", "/images/products/shirt.svg");
  const thumbLoaded = await orderLineImage.evaluate(
    (img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0,
  );
  expect(thumbLoaded).toBe(true);
  await expect(orderLine.locator("[data-account-order-line-sku]")).toHaveText(
    "SKU: DEMO-HOSTED-SHIRT",
  );
  await expect(orderLine.locator("[data-account-order-line-variant]")).toHaveText(
    "Heavyweight Cotton · Regular Fit",
  );

  const signedInLayout = await page.evaluate(() => {
    const vault = document.querySelector("[data-account-signed-in] [data-account-vault-card]");
    const ordersStamp = document.querySelector("[data-account-signed-in] [data-account-orders]");
    if (!(vault instanceof HTMLElement) || !(ordersStamp instanceof HTMLElement)) return null;
    const vaultStyle = getComputedStyle(vault);
    const stampStyle = getComputedStyle(ordersStamp);
    const vaultRect = vault.getBoundingClientRect();
    const stampRect = ordersStamp.getBoundingClientRect();
    return {
      stampBg: stampStyle.backgroundColor,
      vaultBg: vaultStyle.backgroundColor,
      vaultShadow: vaultStyle.boxShadow,
      verticalSeparation: stampRect.top - vaultRect.bottom >= 20,
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(signedInLayout).toEqual({
    stampBg: "rgb(252, 251, 248)",
    vaultBg: "rgb(27, 42, 74)",
    vaultShadow: "rgb(217, 56, 30) 0px 7px 0px 0px",
    verticalSeparation: true,
    noOverflow: true,
  });

  await expect(page.locator("[data-account-profile-name]")).toHaveValue("Alex Rivera");
  await expect(page.locator("[data-account-profile-line1]")).toHaveValue("742 Evergreen Terrace");
  await page.screenshot({ path: resolve(root, "account-demo-signed-in.png") });

  const leadsAfterDemo = (await (await request.get("/api/proof/shopper-account")).json()) as {
    leads: Array<{ email: string }>;
  };
  expect(leadsAfterDemo.leads.some((lead) => lead.email === "shopper@example.com")).toBe(false);

  // Verify /cart prefill from signed-in shopper profile
  await page.goto("/cart");
  await expect(page.locator("[data-guest-cart-email]")).toHaveValue("shopper@example.com");
  await expect(page.locator("[data-guest-cart-delivery-name]")).toHaveValue("Alex Rivera");
  await expect(page.locator("[data-guest-cart-delivery-line1]")).toHaveValue("742 Evergreen Terrace");
  await expect(page.locator("[data-guest-cart-delivery-city]")).toHaveValue("Springfield");
  await expect(page.locator("[data-guest-cart-delivery-postal-code]")).toHaveValue("97477");
  await page.screenshot({ path: resolve(root, "cart-prefilled-from-account.png") });

  // Return to /account, update default shipping address, restore Springfield, and sign out
  await page.goto("/account");
  await expect(page.locator("[data-account-signed-in]")).toBeVisible();
  await page.locator("[data-account-profile-city]").fill("Portland");
  await page.locator("[data-account-profile-postal-code]").fill("97201");
  await page.locator("[data-account-profile-save]").click();
  await expect(page.locator("[data-account-status]")).toContainText("Saved your default shipping address");
  await page.locator("[data-account-profile-city]").fill("Springfield");
  await page.locator("[data-account-profile-postal-code]").fill("97477");
  await page.locator("[data-account-profile-save]").click();
  await expect(page.locator("[data-account-status]")).toContainText("Saved your default shipping address");

  await page.locator("[data-account-signout]").click();
  await expect(page.locator("[data-account-signed-out]")).toBeVisible();

  // 2. Path 1: Verified Email Sign-In + Updates Opt-In (6-digit PIN required)
  const testEmail = `shopper.${testInfo.project.name.replaceAll(/[^a-z0-9]+/giu, "")}@example.com`;
  await page.locator("[data-account-email]").fill(testEmail);

  // Submitting without checking opt-in box is refused
  await page.locator("[data-account-start]").click();
  await expect(page.locator("[data-account-status]")).toContainText("Check the updates opt-in box");
  await expect(page.locator("[data-account-verify-form]")).toBeHidden();

  // Check opt-in box and request 6-digit PIN
  await page.locator("[data-account-opt-in]").check();
  await page.locator("[data-account-start]").click();
  await expect(page.locator("[data-account-verify-form]")).toBeVisible();

  const proofState = (await (
    await request.get(`/api/proof/shopper-account?email=${encodeURIComponent(testEmail)}`)
  ).json()) as {
    email: { code: string | null } | null;
    leads: Array<{ email: string }>;
  };
  expect(proofState.email?.code).toMatch(/^\d{6}$/u);
  // Unverified email is not recorded in leads yet
  expect(proofState.leads.some((lead) => lead.email === testEmail)).toBe(false);

  await page.locator("[data-account-code]").fill(proofState.email!.code!);
  await page.locator("[data-account-verify]").click();

  await expect(page.locator("[data-account-signed-in]")).toBeVisible();
  await expect(page.getByRole("heading", { name: `Welcome, ${testEmail}` })).toBeFocused();
  await expect(page.locator("[data-account-current-email]")).toHaveText(testEmail);
  await expect(page.locator("[data-account-orders-empty]")).toBeVisible();
  await page.screenshot({ path: resolve(root, "account-verified-otp-signed-in.png") });

  const leadsAfterVerify = (await (await request.get("/api/proof/shopper-account")).json()) as {
    leads: Array<{ email: string; optInSource: string; verificationCount: number }>;
  };
  expect(leadsAfterVerify.leads).toContainEqual(
    expect.objectContaining({
      email: testEmail,
      optInSource: "playground-account-otp",
      verificationCount: 1,
    }),
  );
});
