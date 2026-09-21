import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHostname } from "../src/lg/tenant.ts";

test("tenant hostname normalization removes protocol, slash and case differences", () => {
  assert.equal(normalizeHostname("HTTPS://Portal.Example.com/"), "portal.example.com");
  assert.equal(normalizeHostname(" portal.example.com "), "portal.example.com");
  assert.equal(normalizeHostname(""), "");
});
