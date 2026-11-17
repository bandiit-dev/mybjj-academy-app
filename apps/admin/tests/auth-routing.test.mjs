import assert from "node:assert/strict";
import { test } from "node:test";

// Start the admin app on port 3010, or set AUTH_TEST_BASE_URL to another local URL.
const base = new URL(process.env.AUTH_TEST_BASE_URL || "http://localhost:3010");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error("Authentication routing tests must target a local application server.");
}

test("the root route is public and serves the portal instead of hosted authentication", async () => {
  const response = await fetch(new URL("/", base), { redirect: "manual" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.match(await response.text(), /MyBJJAcademy Admin/);
});

for (const path of ["/alunos", "/academia", "/onboarding", "/professores", "/sign-in", "/sign-up"]) {
  test(`signed-out request to ${path} returns to the application root`, async () => {
    const response = await fetch(new URL(path, base), { redirect: "manual" });
    assert.ok([302, 303, 307, 308].includes(response.status));
    const target = new URL(response.headers.get("location"), base);
    assert.equal(target.origin, base.origin);
    assert.equal(target.pathname, "/");
  });
}

test("legacy invitation URLs preserve ticket parameters when redirected to the root", async () => {
  const response = await fetch(new URL("/sign-in/factor-one?__clerk_ticket=regression-ticket&__clerk_status=sign_up", base), { redirect: "manual" });
  assert.equal(response.status, 307);
  const target = new URL(response.headers.get("location"), base);
  assert.equal(target.origin, base.origin);
  assert.equal(target.pathname, "/");
  assert.equal(target.searchParams.get("__clerk_ticket"), "regression-ticket");
  assert.equal(target.searchParams.get("__clerk_status"), "sign_up");
});
