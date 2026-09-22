import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const portal = read("src/platform/PlatformOwnerPortal.tsx");
const login = read("src/platform/PlatformOwnerLogin.tsx");
const membership = read("src/platform/PlatformMembershipPanel.tsx");
const route = read("src/routes/owner.tsx");
const css = read("src/platform/owner-liquid-glass.css");

test("owner portal uses the scoped liquid-glass design system", () => {
  assert.match(portal, /owner-liquid-glass\.css/);
  assert.match(portal, /className="owner-liquid-glass"/);
  assert.match(membership, /className="owner-membership-panel"/);
});

test("owner login and MFA surfaces share the glass treatment", () => {
  assert.match(login, /className="owner-login-glass"/);
  assert.match(css, /\.owner-login-glass/);
  assert.match(css, /backdrop-filter:blur\(28px\) saturate\(175%\)/);
});

test("owner UI has responsive desktop/tablet/mobile breakpoints", () => {
  assert.match(css, /@media \(max-width:1050px\)/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /@media \(max-width:460px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
});

test("owner route is no longer blocked by the desktop-only gate", () => {
  assert.doesNotMatch(route, /DesktopOnlyGate/);
  assert.match(route, /component: PlatformOwnerPortal/);
});

test("glass surfaces use translucency, blur, highlights and focus states", () => {
  assert.match(css, /rgba\(255,255,255,.58\)/);
  assert.match(css, /backdrop-filter:blur\(24px\) saturate\(165%\)/);
  assert.match(css, /inset 0 1px 0 rgba\(255,255,255,.95\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
