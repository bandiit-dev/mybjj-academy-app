import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approveRetentionRule,
  getAccess,
  listRequests,
  previewReminderCleanup,
  registerRequest,
  reminderCleanupEligibility,
  requestDetails,
  saveRetentionDraft,
  updateRequest,
} from "../convex/privacy";
import { reminderRetentionTrigger } from "../convex/lib/privacy";

const handler = (fn: unknown) =>
  (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;

function fixture() {
  const tables: Record<string, any[]> = {
    teachers: [
      {
        _id: "admin-1",
        clerkUserId: "admin",
        gymIds: ["gym-a"],
        userType: "Admin",
      },
      {
        _id: "admin-2",
        clerkUserId: "other",
        gymIds: ["gym-b"],
        userType: "Admin",
      },
      {
        _id: "teacher-1",
        clerkUserId: "teacher",
        gymIds: ["gym-a"],
        userType: "Normal",
      },
    ],
    gyms: [
      { _id: "gym-a", name: "Academia A" },
      { _id: "gym-b", name: "Academia B" },
    ],
    students: [],
    privacyRequests: [],
    privacyRequestEvents: [],
    retentionRules: [],
    monthlyPaymentReminders: [],
  };
  let nextId = 0;
  function ctx(subject: string | null = "admin") {
    const all = () => Object.values(tables).flat();
    return {
      auth: {
        getUserIdentity: async () =>
          subject ? { subject, name: subject } : null,
      },
      db: {
        get: async (id: string) => all().find((row) => row._id === id) ?? null,
        insert: async (table: string, fields: object) => {
          const _id = `${table}-${++nextId}`;
          tables[table].push({ _id, _creationTime: nextId, ...fields });
          return _id;
        },
        patch: async (id: string, fields: object) =>
          Object.assign(
            all().find((row) => row._id === id),
            fields,
          ),
        query: (table: string) => ({
          withIndex: (_index: string, apply: (q: any) => unknown) => {
            let matches = [...tables[table]];
            const conditions = {
              eq: (field: string, value: unknown) => {
                matches = matches.filter((row) => row[field] === value);
                return conditions;
              },
              lte: (field: string, value: string) => {
                matches = matches.filter((row) => row[field] <= value);
                return conditions;
              },
            };
            apply(conditions);
            const run = {
              order: (direction: string) => {
                if (direction === "desc") matches.reverse();
                return run;
              },
              collect: async () => matches,
              first: async () => matches[0] ?? null,
              take: async (limit: number) => matches.slice(0, limit),
              paginate: async ({ numItems }: { numItems: number }) => ({
                page: matches.slice(0, numItems),
                isDone: matches.length <= numItems,
                continueCursor: "",
              }),
            };
            return run;
          },
        }),
      },
    };
  }
  return { ctx, tables };
}

const registration = {
  gymId: "gym-a",
  kind: "access",
  receivedOn: "2026-10-23",
  requesterName: "Pessoa solicitante",
  requesterEmail: "Solicitante@example.com",
  representation: "self",
  description: "Pediu acesso aos dados.",
};
const page = { numItems: 20, cursor: null };

test("privacy requests have an access deadline and a scoped verification and decision history", async () => {
  const { ctx, tables } = fixture();
  const admin = ctx();
  await assert.rejects(
    handler(registerRequest)(admin, { ...registration, dueOn: "2026-11-09" }),
    /até 15 dias/,
  );
  await assert.rejects(
    handler(registerRequest)(admin, {
      ...registration,
      representation: "representative",
    }),
    /Nome do titular/,
  );
  const requestId = await handler(registerRequest)(admin, registration);
  const summary = await handler(listRequests)(admin, {
    gymId: "gym-a",
    paginationOpts: page,
  });
  assert.equal(summary.page[0].dueOn, "2026-11-07");
  assert.ok(!("requesterEmail" in summary.page[0]));
  assert.equal(
    (await handler(requestDetails)(admin, { gymId: "gym-a", requestId }))
      .request.requesterEmail,
    "solicitante@example.com",
  );

  const change = (revision: number, change: object) =>
    handler(updateRequest)(admin, {
      gymId: "gym-a",
      requestId,
      revision,
      change,
    });
  await assert.rejects(
    change(1, { type: "review", identityVerified: true }),
    /Confirme a identidade/,
  );
  await change(1, { type: "verify" });
  await assert.rejects(change(1, { type: "assign" }), /foi atualizada/);
  await assert.rejects(
    change(2, { type: "review", identityVerified: false }),
    /Confirme a identidade/,
  );
  await change(2, { type: "review", identityVerified: true });
  await change(3, {
    type: "complete",
    outcome: "partial",
    resolution: "Atendimento registrado.",
  });
  await assert.rejects(change(4, { type: "verify" }), /concluída/);
  assert.deepEqual(
    tables.privacyRequestEvents.map((event) => event.status),
    ["received", "verification", "review", "completed"],
  );
  assert.equal(tables.privacyRequests[0].outcome, "partial");
});

test("academy and platform privacy data requires distinct roles and remains scoped", async (t) => {
  const oldAllowlist = process.env.PRIVACY_OPERATOR_CLERK_USER_IDS;
  process.env.PRIVACY_OPERATOR_CLERK_USER_IDS = " operator ";
  t.after(() => {
    if (oldAllowlist === undefined)
      delete process.env.PRIVACY_OPERATOR_CLERK_USER_IDS;
    else process.env.PRIVACY_OPERATOR_CLERK_USER_IDS = oldAllowlist;
  });
  const { ctx } = fixture();
  assert.deepEqual(await handler(getAccess)(ctx(), {}), {
    gyms: [{ id: "gym-a", name: "Academia A" }],
    platform: false,
  });
  assert.deepEqual(await handler(getAccess)(ctx("operator"), {}), {
    gyms: [],
    platform: true,
  });
  const id = await handler(registerRequest)(ctx(), registration);
  for (const subject of [null, "teacher", "other", "operator"]) {
    await assert.rejects(
      handler(requestDetails)(ctx(subject), { gymId: "gym-a", requestId: id }),
      /não tem acesso/,
    );
  }
  assert.equal(
    await handler(requestDetails)(ctx("other"), {
      gymId: "gym-b",
      requestId: id,
    }),
    null,
  );
  await assert.rejects(
    handler(listRequests)(ctx(), { paginationOpts: page }),
    /não tem acesso/,
  );
  const platformId = await handler(registerRequest)(ctx("operator"), {
    ...registration,
    gymId: undefined,
  });
  assert.equal(
    (await handler(listRequests)(ctx("operator"), { paginationOpts: page }))
      .page[0]._id,
    platformId,
  );
});

test("reminder preview uses the current approved rule, strips private fields and leaves storage intact", async () => {
  const { ctx, tables } = fixture();
  const admin = ctx();
  const rule = {
    gymId: "gym-a",
    category: "reminders",
    purpose: "Lembretes de mensalidade",
    storageLocation: "Convex",
    startEvent: reminderRetentionTrigger,
    retentionDays: 0,
    disposition: "minimize",
    exceptions: "",
  };
  await assert.rejects(
    handler(saveRetentionDraft)(admin, {
      ...rule,
      baseVersion: 0,
      retentionDays: -1,
    }),
    /prazo entre/,
  );
  const old = await handler(saveRetentionDraft)(admin, {
    ...rule,
    baseVersion: 0,
  });
  const current = await handler(saveRetentionDraft)(admin, {
    ...rule,
    baseVersion: 1,
  });
  await assert.rejects(
    handler(approveRetentionRule)(admin, { gymId: "gym-a", ruleId: old }),
    /mais recente/,
  );
  await assert.rejects(
    handler(saveRetentionDraft)(admin, { ...rule, baseVersion: 1 }),
    /versão mais recente/,
  );
  await handler(approveRetentionRule)(admin, {
    gymId: "gym-a",
    ruleId: current,
  });
  await handler(saveRetentionDraft)(admin, {
    ...rule,
    baseVersion: 2,
    retentionDays: 15,
  });
  const row = {
    _id: "reminder-1",
    gymId: "gym-a",
    dueDate: "2026-10-13",
    studentId: "student-1",
    recipient: "secret@example.com",
    subject: "subject",
    text: "message",
    sentAt: Date.parse("2026-10-10T15:00:00Z"),
    retryAfter: Date.parse("2026-10-10T15:05:00Z"),
  };
  tables.monthlyPaymentReminders.push(
    row,
    { ...row, _id: "other-gym", gymId: "gym-b" },
    { ...row, _id: "pending", sentAt: undefined },
  );
  const before = structuredClone(tables.monthlyPaymentReminders);
  const at = Date.parse("2026-10-11T03:00:00Z");
  const preview = (asOf: number, ruleId = current) =>
    handler(previewReminderCleanup)(admin, {
      gymId: "gym-a",
      ruleId,
      asOf,
      paginationOpts: page,
    });
  assert.deepEqual((await preview(at - 1)).page, []);
  assert.deepEqual((await preview(at, old)).page, []);
  assert.deepEqual((await preview(at)).page, [
    { id: "reminder-1", dueDate: "2026-10-13", eligibleAt: at, status: "sent" },
  ]);
  assert.deepEqual(tables.monthlyPaymentReminders, before);
  assert.equal(
    reminderCleanupEligibility(
      {
        ...row,
        sentAt: undefined,
        failedAt: at - 10,
        retryAfter: at + 10,
      } as any,
      1,
    ),
    at + 10 + 86_400_000,
  );
});
