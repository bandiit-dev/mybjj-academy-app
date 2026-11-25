import assert from "node:assert/strict";
import { test } from "node:test";
import { createStudent, createStudentWithoutAccount, getGraduationHistory, getStudentDetailsForStaff, updateStudent } from "../convex/students";
import { getOnboardingStatus, listAcademyAccess, selectAcademy, linkExistingProfile, resolvePortalAccount, resolveVerifiedProfile } from "../convex/onboarding";
import { assertInvitationAllowed, insertInvitedStudent, insertInvitedTeacher, inviteExistingStudent, inviteStudent, inviteTeacher, updateInvitedStudent } from "../convex/provisioning";
import { getCurrentPrincipal, requireAdmin } from "../convex/lib/auth";
import { BELTS, assertDateOfBirth, beltValidator, teacherClassTypeValidator } from "../convex/lib/validators";

const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
const profile = { name: "Aluno infantil", belt: "GrayWhite", degree: 0, gymId: "gym_1", unityId: "unity_1", picture: "", dateOfBirth: "2018-05-12" };

function context({ admin = true, authenticated = true, email = "owner@example.com" } = {}) {
  const tables: Record<string, any[]> = {
    billingAccounts: ["gym_1", "gym_2"].map(gymId => ({
      gymId, status: "active", priceId: "price_test", paidThrough: Date.UTC(2199,0,1),
    })),
    teachers: admin ? [{ _id: "teacher_1", clerkUserId: "user_1", userType: "Admin", gymIds: ["gym_1"] }] : [],
    academySelections: [], gyms: [{ _id: "gym_1", name: "Academia A", teacherIds: [] }],
    students: [], studentGraduations: [], unities: [{ _id: "unity_1", gymId: "gym_1" }]
  };
  const db = {
    query(table: string) {
      let rows = tables[table] ?? [];
      const chain = {
        withIndex(_name: string, apply: any) {
          const index = { eq(field: string, value: any) { rows = rows.filter(row => row[field] === value); return index; } };
          apply(index); return chain;
        },
        filter(apply: any) {
          const expression = { field: (field: string) => field, neq: (field: string, value: any) => (row: any) => row[field] !== value };
          rows = rows.filter(apply(expression)); return chain;
        },
        order(direction: string) {
          if (direction === "desc") rows = [...rows].reverse();
          return chain;
        },
        collect: async () => rows,
        first: async () => rows[0] ?? null,
        unique: async () => { assert.ok(rows.length <= 1); return rows[0] ?? null; }
      };
      return chain;
    },
    get: async (id: string) => Object.values(tables).flat().find(row => row._id === id) ?? null,
    insert: async (table: string, record: any) => {
      const _id = `${table}_${tables[table].length + 1}`;
      tables[table].push({ ...record, _id }); return _id;
    },
    patch: async (id: string, patch: any) => Object.assign(await db.get(id), patch)
  };
  return { tables, db, auth: { getUserIdentity: async () => authenticated ? { subject: "user_1", email, emailVerified: true } : null } };
}

test("registers a child with date of birth and no credentials or contact details", async () => {
  const ctx = context();
  await handler(createStudentWithoutAccount)(ctx, profile);
  const student = ctx.tables.students[0];
  assert.equal(student.clerkUserId, undefined);
  assert.equal(student.email, "");
  assert.equal(student.phone, "");
  assert.equal(student.dateOfBirth, "2018-05-12");
  assert.equal(student.belt, "GrayWhite");
  assert.equal(student.userType, "Normal");
});

test("registration requires an admin and a unit in an accessible academy", async () => {
  await assert.rejects(handler(createStudentWithoutAccount)(context({ authenticated: false }), profile), /Unauthorized/);
  await assert.rejects(handler(createStudentWithoutAccount)(context({ admin: false }), profile), /admin role required/);
  await assert.rejects(handler(createStudentWithoutAccount)(context(), { ...profile, gymId: "other_gym" }), /academy access required/);
  await assert.rejects(handler(createStudentWithoutAccount)(context(), { ...profile, unityId: "other_unit" }), /does not belong/);
});

test("students without accounts cannot be linked by a matching contact email", async () => {
  const ctx = context({ admin: false, email: "parent@example.com" });
  ctx.tables.students.push({ ...profile, _id: "child_1", email: "parent@example.com", gymIds: ["gym_1"] });
  assert.equal((await handler(getOnboardingStatus)(ctx, {})).status, "needs_academy");
  await assert.rejects(handler(linkExistingProfile)(ctx, {}), /No profile matches/);
  assert.equal(ctx.tables.students[0].clerkUserId, undefined);
});

test("invited students can still link their Clerk identity", async () => {
  const ctx = context({ admin: false, email: "student@example.com" });
  ctx.tables.students.push({ ...profile, _id: "student_1", email: "student@example.com", clerkUserId: "invitation:inv_1", gymIds: ["gym_1"] });
  assert.equal((await handler(getOnboardingStatus)(ctx, {})).status, "link_required");
  await handler(linkExistingProfile)(ctx, {});
  assert.equal(ctx.tables.students[0].clerkUserId, "user_1");
});

test("account invitations require a valid email", async () => {
  for (const email of ["", "   ", "invalid-email"]) {
    await assert.rejects(handler(assertInvitationAllowed)(context(), { ...profile, email }), /valid email/);
  }
});

test("invitations preserve student birth dates and omit redirectUrl from internal mutations", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = "test-secret";
  const invitations: any[] = [];
  globalThis.fetch = async (_url, init) => {
    if (!init?.method) return Response.json([]);
    invitations.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: "inv_1" }), { status: 200 });
  };
  try {
    const mutations: any[] = [];
    const ctx = { ...context(), runQuery: async () => true, runMutation: async (_fn: any, args: any) => { mutations.push(args); return "new_profile"; } };
    await handler(inviteStudent)(ctx, { ...profile, email: "child@example.com", redirectUrl: "https://example.com/sign-in" });
    assert.equal(mutations[0].dateOfBirth, profile.dateOfBirth);
    assert.equal(mutations[0].phone, undefined);
    assert.equal(mutations[0].invitationId, "inv_1");
    assert.equal("redirectUrl" in mutations[0], false);
    await handler(inviteTeacher)(ctx, { ...profile, email: "teacher@example.com", phone: "123", role: "Professor", classType: "GI_NOGI", userType: "Normal", redirectUrl: "https://example.com/sign-in" });
    assert.equal(mutations[1].classType, "GI_NOGI");
    assert.equal("redirectUrl" in mutations[1], false);
    assert.equal(invitations.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalSecret;
  }
});

test("editing a student without an account keeps contact details optional", async () => {
  const ctx = context();
  const studentId = await handler(createStudentWithoutAccount)(ctx, profile);
  await handler(updateStudent)(ctx, { studentId, dateOfBirth: "2019-01-20", email: "", phone: "" });
  assert.equal(ctx.tables.students[0].dateOfBirth, "2019-01-20");
  assert.equal(ctx.tables.students[0].clerkUserId, undefined);
});

test("student rank changes are recorded once and visible only to the student and academy staff", async (t) => {
  const now = Date.parse("2026-11-24T15:00:00Z");
  t.mock.method(Date, "now", () => now);
  const ctx = context();
  const studentId = await handler(createStudentWithoutAccount)(ctx, profile);
  const student = ctx.tables.students[0];
  student.clerkUserId = "student_user";
  const view = (subject: string) => ({
    ...ctx,
    auth: { getUserIdentity: async () => ({ subject }) },
  });
  ctx.tables.teachers.push(
    { _id: "teacher_2", clerkUserId: "local_teacher", gymIds: ["gym_1"], userType: "Normal" },
    { _id: "teacher_3", clerkUserId: "outside_teacher", gymIds: ["gym_2"], userType: "Normal" },
  );
  const history = handler(getGraduationHistory);
  const update = handler(updateStudent);
  assert.deepEqual(await history(ctx, { studentId }), []);
  await update(ctx, { studentId, degree: 1 });
  await update(ctx, { studentId, degree: 1, phone: "123" });
  await update(ctx, { studentId, belt: "Gray", degree: 0 });

  const events = await history(ctx, { studentId });
  assert.equal(events.length, 2);
  assert.equal(events[0].previousBelt, "GrayWhite");
  assert.equal(events[0].previousDegree, 1);
  assert.equal(events[0].belt, "Gray");
  assert.equal(events[0].degree, 0);
  assert.equal(events[0].recordedAt, now);
  assert.equal(events[1].degree, 1);
  assert.deepEqual(await history(view("student_user"), {}), events);
  assert.deepEqual(await history(view("local_teacher"), { studentId }), events);
  assert.deepEqual(await history(view("outside_teacher"), { studentId }), []);
  const peerId = await handler(createStudentWithoutAccount)(ctx, { ...profile, name: "Outro aluno" });
  assert.deepEqual(await history(view("student_user"), { studentId: peerId }), []);

  const details = handler(getStudentDetailsForStaff);
  assert.deepEqual(await details(view("local_teacher"), { studentId }), {
    role: "teacher",
    student: { name: profile.name, picture: profile.picture, belt: "Gray", degree: 0 },
  });
  assert.equal(await details(view("outside_teacher"), { studentId }), null);
  assert.equal(await details(view("student_user"), { studentId }), null);
});

test("self-service student creation cannot assign admin privileges", async () => {
  await assert.rejects(handler(createStudent)(context({ admin: false }), { ...profile, clerkUserId: "user_1", userType: "Admin" }), /cannot assign admin/);
});

test("birth dates accept leap days and reject invalid or future dates", () => {
  for (const date of [undefined, "", "2018-05-12", "2020-02-29"]) assert.doesNotThrow(() => assertDateOfBirth(date));
  for (const date of ["2021-02-29", "2020-02-30", "2020-13-01", "01/01/2020", "9999-01-01"]) assert.throws(() => assertDateOfBirth(date), /Invalid dateOfBirth/);
});

test("all nineteen belts and the combined teacher modality are supported", () => {
  assert.equal(BELTS.length, 19);
  assert.equal((beltValidator.json as any).value.length, 19);
  assert.ok((teacherClassTypeValidator.json as any).value.some((entry: any) => entry.value === "GI_NOGI"));
});

test("inviting an existing student updates the same record with the edited details", async () => {
  const ctx = context();
  const studentId = await handler(createStudentWithoutAccount)(ctx, { ...profile, email: "student@example.com" });
  const createdAt = ctx.tables.students[0].createdAt;
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = "test-secret";
  let sent = 0;
  globalThis.fetch = async (_url, init) => {
    if (!init?.method) return Response.json([]);
    sent++;
    assert.equal(JSON.parse(String(init?.body)).email_address, "student@example.com");
    return new Response(JSON.stringify({ id: "existing_invitation" }), { status: 200 });
  };
  try {
    const actionCtx = {
      ...ctx,
      runQuery: async (_fn: any, args: any) => handler(assertInvitationAllowed)(ctx, args),
      runMutation: async (_fn: any, args: any) => {
        assert.equal("redirectUrl" in args, false);
        return handler(updateInvitedStudent)(ctx, args);
      }
    };
    const result = await handler(inviteExistingStudent)(actionCtx, {
      ...profile, studentId, email: " STUDENT@example.com ", phone: "", name: "Nome atualizado",
      dateOfBirth: "2019-07-14", degree: 1, redirectUrl: "https://example.com/sign-in"
    });
    assert.equal(result, studentId);
    assert.equal(ctx.tables.students.length, 1);
    assert.equal(ctx.tables.students[0]._id, studentId);
    assert.equal(ctx.tables.students[0].createdAt, createdAt);
    assert.equal(ctx.tables.students[0].clerkUserId, "invitation:existing_invitation");
    assert.equal(ctx.tables.students[0].email, "student@example.com");
    assert.equal(ctx.tables.students[0].dateOfBirth, "2019-07-14");
    assert.equal(ctx.tables.students[0].name, "Nome atualizado");
    assert.equal(ctx.tables.studentGraduations.length, 1);
    assert.equal(ctx.tables.studentGraduations[0].degree, 1);
    assert.equal(sent, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalSecret;
  }
});

test("existing-student invitations reject missing email, duplicate profiles, and inaccessible students", async () => {
  const ctx = context();
  const studentId = await handler(createStudentWithoutAccount)(ctx, profile);
  const args = { ...profile, studentId, email: "student@example.com" };
  await assert.rejects(handler(assertInvitationAllowed)(ctx, { ...args, email: "" }), /valid email/);
  ctx.tables.students.push({ _id: "another_student", email: args.email, gymIds: ["gym_1"] });
  await assert.rejects(handler(assertInvitationAllowed)(ctx, args), /already exists/);
  ctx.tables.students.pop();
  ctx.tables.students[0].gymIds = ["gym_2"];
  await assert.rejects(handler(assertInvitationAllowed)(ctx, args), /another academy/);
  await assert.rejects(handler(assertInvitationAllowed)(context({ admin: false }), args), /admin role required/);
  await assert.rejects(handler(assertInvitationAllowed)(context({ authenticated: false }), args), /Unauthorized/);
});

test("students with accounts or pending invitations cannot be invited again", async () => {
  const ctx = context();
  const studentId = await handler(createStudentWithoutAccount)(ctx, profile);
  for (const clerkUserId of ["user_already_linked", "invitation:already_sent"]) {
    ctx.tables.students[0].clerkUserId = clerkUserId;
    await assert.rejects(handler(assertInvitationAllowed)(ctx, { ...profile, studentId, email: "student@example.com" }), /already has an account/);
    await assert.rejects(handler(updateInvitedStudent)(ctx, { ...profile, studentId, email: "student@example.com", invitationId: "new_invitation" }), /already has an account/);
    assert.equal(ctx.tables.students[0].clerkUserId, clerkUserId);
  }
});

test("failed Clerk invitations leave the original student record intact", async () => {
  const ctx = context();
  const studentId = await handler(createStudentWithoutAccount)(ctx, profile);
  const before = { ...ctx.tables.students[0] };
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = "test-secret";
  globalThis.fetch = async (_url, init) => init?.method === "POST"
    ? Response.json({ errors: [{ message: "Invitation failed" }] }, { status: 400 })
    : Response.json([]);
  try {
    const actionCtx = {
      ...ctx,
      runQuery: async (_fn: any, args: any) => handler(assertInvitationAllowed)(ctx, args),
      runMutation: async () => assert.fail("A failed invitation must not update the student")
    };
    await assert.rejects(handler(inviteExistingStudent)(actionCtx, {
      ...profile, studentId, name: "Edited name", email: "student@example.com", redirectUrl: "https://example.com/sign-in"
    }), /Invitation failed/);
    assert.deepEqual(ctx.tables.students[0], before);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalSecret;
  }
});

test("a verified Clerk invitation links automatically even when the token has no email claim", async t => {
  const ctx = context({ admin: false });
  ctx.auth = { getUserIdentity: async () => ({ subject: "user_1", email: undefined, emailVerified: false }) };
  const invited = {
    ...profile, _id: "student_1", email: "student@example.com",
    clerkUserId: "invitation:inv_1", gymIds: ["gym_1"], userType: "Normal",
  };
  ctx.tables.students.push(invited);
  const originalSecret = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = "test-secret";
  let verified = false;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "https://api.clerk.com/v1/users/user_1");
    return Response.json({
      id: "user_1", primary_email_address_id: "email_1",
      email_addresses: [{
        id: "email_1", email_address: "Student@example.com",
        verification: { status: verified ? "verified" : "unverified" },
      }],
    });
  });
  const action = { ...ctx, runMutation: (_fn: unknown, args: unknown) => handler(resolveVerifiedProfile)(ctx, args) };
  try {
    assert.equal((await handler(getOnboardingStatus)(ctx, {})).status, "needs_academy");
    await assert.rejects(handler(resolvePortalAccount)(action, {}), /verified primary email/);
    assert.equal(invited.clerkUserId, "invitation:inv_1");
    verified = true;
    assert.deepEqual(await handler(resolvePortalAccount)(action, {}), { status: "linked" });
    assert.deepEqual(await handler(getOnboardingStatus)(ctx, {}), {
      status: "ready", profileType: "student", isAdmin: false, displayName: profile.name,
    });
    assert.equal(invited.clerkUserId, "user_1");
    assert.deepEqual(invited.gymIds, ["gym_1"]);
  } finally {
    if (originalSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalSecret;
  }
});

test("verified email cannot replace a profile already linked to another account", async () => {
  const ctx = context({ admin: false, email: "student@example.com" });
  ctx.tables.students.push({
    ...profile, _id: "student_1", email: "student@example.com",
    clerkUserId: "other-user", gymIds: ["gym_1"], userType: "Normal",
  });
  await assert.rejects(
    handler(resolveVerifiedProfile)(ctx, { email: "student@example.com" }),
    /already linked/,
  );
  assert.equal(ctx.tables.students[0].clerkUserId, "other-user");
  assert.deepEqual(await handler(resolveVerifiedProfile)(ctx, { email: "new-owner@example.com" }), {
    status: "needs_academy",
  });
});

test("an existing teacher login gains a separate student profile in another academy", async t => {
  const ctx = context();
  ctx.tables.gyms.push({ _id: "gym_2", name: "Academia B", teacherIds: [] });
  ctx.tables.teachers.push({
    _id: "teacher_other", clerkUserId: "shared_user", email: "shared@example.com",
    userType: "Normal", gymIds: ["gym_2"], name: "Professor Bruno",
  });
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    assert.equal(new URL(url).pathname, "/v1/users");
    assert.equal(new URL(url).searchParams.get("email_address"), "shared@example.com");
    assert.equal(init?.method, undefined);
    return Response.json([{
      id: "shared_user",
      email_addresses: [{ email_address: "Shared@example.com", verification: { status: "verified" } }],
    }]);
  });
  const originalSecret = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = "test-secret";
  try {
    const action = {
      ...ctx,
      runQuery: (_fn: unknown, args: unknown) => handler(assertInvitationAllowed)(ctx, args),
      runMutation: (_fn: unknown, args: unknown) => handler(insertInvitedStudent)(ctx, args),
    };
    const studentId = await handler(inviteStudent)(action, {
      ...profile, email: "shared@example.com", redirectUrl: "https://example.com/",
    });
    assert.equal(ctx.tables.students[0].clerkUserId, "shared_user");
    assert.deepEqual(ctx.tables.teachers[1].gymIds, ["gym_2"]);
    await assert.rejects(handler(inviteStudent)(action, {
      ...profile, email: "shared@example.com", redirectUrl: "https://example.com/",
    }), /already exists/);

    const login = { ...ctx, auth: { getUserIdentity: async () => ({ subject: "shared_user" }) } };
    assert.deepEqual(await handler(listAcademyAccess)(login, {}), [
      { gymId: "gym_2", name: "Academia B", role: "teacher" },
      { gymId: "gym_1", name: "Academia A", role: "student" },
    ]);
    assert.equal((await handler(getOnboardingStatus)(login, {})).activeGymId, "gym_2");
    await assert.rejects(handler(selectAcademy)(login, { gymId: "outside" }), /academy access required/);
    await handler(selectAcademy)(login, { gymId: "gym_1" });
    const selected = await getCurrentPrincipal(login);
    assert.equal(selected.teacher, null);
    assert.equal(selected.student?._id, studentId);
    assert.deepEqual(selected.student?.gymIds, ["gym_1"]);
    assert.equal((await handler(getOnboardingStatus)(login, {})).profileType, "student");
    await handler(selectAcademy)(login, { gymId: "gym_2" });
    assert.equal((await getCurrentPrincipal(login)).student, null);
    assert.equal(ctx.tables.academySelections.length, 1);
  } finally {
    if (originalSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalSecret;
  }
});

test("the active academy scopes admin privileges and supports multiple profiles of the same type", async () => {
  const ctx = context();
  ctx.tables.gyms.push({ _id: "gym_2", name: "Academia B", teacherIds: [] });
  ctx.tables.teachers.push({
    _id: "teacher_2", clerkUserId: "user_1", userType: "Normal",
    gymIds: ["gym_2"], name: "Professor Bruno",
  });
  assert.deepEqual((await requireAdmin(ctx)).teacher?.gymIds, ["gym_1"]);
  await handler(selectAcademy)(ctx, { gymId: "gym_2" });
  const active = await getCurrentPrincipal(ctx);
  assert.equal(active.teacher?._id, "teacher_2");
  assert.deepEqual(active.teacher?.gymIds, ["gym_2"]);
  await assert.rejects(requireAdmin(ctx), /admin role required/);
  await assert.rejects(handler(insertInvitedTeacher)(ctx, {
    ...profile, email: "other@example.com", invitationId: "inv_other",
  }), /admin role required/);
});
