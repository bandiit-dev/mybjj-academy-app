import assert from "node:assert/strict";
import { test } from "node:test";

// Start the admin app on port 3010, or set AUTH_TEST_BASE_URL to another local URL.
const base = new URL(process.env.AUTH_TEST_BASE_URL || "http://localhost:3010");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error(
    "Authentication routing tests must target a local application server.",
  );
}

test("the root route is public and serves the portal instead of hosted authentication", async () => {
  const response = await fetch(new URL("/", base), { redirect: "manual" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
  assert.match(await response.text(), /Portal administrativo \| My BJJ Academy/);
});

for (const path of [
  "/assinatura",
  "/aluno",
  "/aluno/aulas",
  "/aluno/perfil",
  "/alunos",
  "/aulas/example-class",
  "/academia",
  "/onboarding",
  "/professores",
  "/professores/example-teacher",
  "/professores/meu-historico",
  "/sign-in",
  "/sign-up",
]) {
  test(`signed-out request to ${path} returns to the application root`, async () => {
    const response = await fetch(new URL(path, base), { redirect: "manual" });
    assert.ok([302, 303, 307, 308].includes(response.status));
    const target = new URL(response.headers.get("location"), base);
    assert.equal(target.origin, base.origin);
    assert.equal(target.pathname, "/");
  });
}

test("legacy invitation URLs preserve ticket parameters when redirected to the root", async () => {
  const response = await fetch(
    new URL(
      "/sign-in/factor-one?__clerk_ticket=regression-ticket&__clerk_status=sign_up",
      base,
    ),
    { redirect: "manual" },
  );
  assert.equal(response.status, 307);
  const target = new URL(response.headers.get("location"), base);
  assert.equal(target.origin, base.origin);
  assert.equal(target.pathname, "/");
  assert.equal(target.searchParams.get("__clerk_ticket"), "regression-ticket");
  assert.equal(target.searchParams.get("__clerk_status"), "sign_up");
});

test("a signed-out checkout link keeps the plan through the login redirect", async () => {
  const response = await fetch(new URL("/assinatura?plano=trial", base), {
    redirect: "manual",
  });
  assert.ok([302, 303, 307, 308].includes(response.status));
  const target = new URL(response.headers.get("location"), base);
  assert.equal(target.origin, base.origin);
  assert.equal(target.pathname, "/");
  assert.equal(target.searchParams.get("plano"), "trial");
});

test("a signed-out student photo request receives no image or cacheable response", async () => {
  const response = await fetch(new URL("/api/student-photos/example-student", base), {
    redirect: "manual",
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(await response.text(), "");
});
