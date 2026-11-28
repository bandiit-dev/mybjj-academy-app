import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { resolveAcademyMembership } from "./lib/auth";
import {
  academyRetentionCategories,
  platformRetentionCategories,
  privacyRequestKind,
  privacyRequestOutcome,
  privacyRequestStatus,
  reminderRetentionTrigger,
  retentionCategory,
  retentionDisposition,
  type RetentionCategory,
} from "./lib/privacy";
import { academyToday, assertPlanDate } from "./lib/studentPlans";
import { assertInvitationEmail } from "./lib/validators";
import { reminderLeadDays } from "./monthlyReminders";

const scopeArg = { gymId: v.optional(v.id("gyms")) };
const dayMs = 86_400_000;

async function access(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return null;
  const operatorIds = (process.env.PRIVACY_OPERATOR_CLERK_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim());
  const { active, memberships } = await resolveAcademyMembership(
    ctx,
    identity.subject,
  );
  return {
    actorId: identity.subject,
    actorName:
      identity.name?.trim().slice(0, 120) ||
      active?.profile.name ||
      "Equipe de privacidade",
    gymIds: [...memberships.values()]
      .filter((item) => item.role === "admin")
      .map((item) => item.gymId),
    platform: operatorIds.includes(identity.subject),
  };
}

async function requireScope(ctx: QueryCtx, gymId: Id<"gyms"> | undefined) {
  const actor = await access(ctx);
  if (!actor || (gymId ? !actor.gymIds.includes(gymId) : !actor.platform)) {
    throw new ConvexError("Você não tem acesso a este espaço de privacidade.");
  }
  return actor;
}

function cleanText(
  value: string,
  label: string,
  maxLength: number,
  required = true,
) {
  const text = value.trim();
  if ((required && !text) || text.length > maxLength) {
    throw new ConvexError(
      `${label} deve ${required ? "ter entre 1 e" : "ter até"} ${maxLength} caracteres.`,
    );
  }
  return text;
}

function validateDate(date: string) {
  try {
    assertPlanDate(date);
  } catch {
    throw new ConvexError("Informe uma data válida.");
  }
}

function legalAccessDeadline(receivedOn: string) {
  return new Date(Date.parse(`${receivedOn}T00:00:00Z`) + 15 * dayMs)
    .toISOString()
    .slice(0, 10);
}

export const getAccess = query({
  args: {},
  handler: async (ctx) => {
    const actor = await access(ctx);
    if (!actor || (!actor.gymIds.length && !actor.platform)) return null;
    const gyms = await Promise.all(actor.gymIds.map((id) => ctx.db.get(id)));
    return {
      gyms: gyms.flatMap((gym) =>
        gym ? [{ id: gym._id, name: gym.name }] : [],
      ),
      platform: actor.platform,
    };
  },
});

export const listRequests = query({
  args: {
    ...scopeArg,
    status: v.optional(privacyRequestStatus),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { gymId, status, paginationOpts }) => {
    await requireScope(ctx, gymId);
    const query = ctx.db.query("privacyRequests");
    const scoped = status
      ? query.withIndex("by_gym_status", (q) =>
          q.eq("gymId", gymId).eq("status", status),
        )
      : query.withIndex("by_gymId", (q) => q.eq("gymId", gymId));
    const result = await scoped
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, 50),
      });
    return {
      ...result,
      page: result.page.map(
        ({ _id, kind, status, receivedOn, dueOn, assignedToName }) => ({
          _id,
          kind,
          status,
          receivedOn,
          dueOn,
          assignedToName,
        }),
      ),
    };
  },
});

export const requestDetails = query({
  args: { ...scopeArg, requestId: v.id("privacyRequests") },
  handler: async (ctx, { gymId, requestId }) => {
    const actor = await requireScope(ctx, gymId);
    const request = await ctx.db.get(requestId);
    if (!request || request.gymId !== gymId) return null;
    const events = await ctx.db
      .query("privacyRequestEvents")
      .withIndex("by_request", (q) => q.eq("requestId", requestId))
      .order("desc")
      .take(50);
    return {
      request,
      assignedToMe: actor.actorId === request.assignedTo,
      events,
    };
  },
});

export const registerRequest = mutation({
  args: {
    ...scopeArg,
    kind: privacyRequestKind,
    requesterName: v.string(),
    requesterEmail: v.string(),
    representation: v.union(v.literal("self"), v.literal("representative")),
    subjectName: v.optional(v.string()),
    description: v.string(),
    receivedOn: v.string(),
    dueOn: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      gymId,
      kind,
      requesterName,
      requesterEmail,
      representation,
      subjectName,
      description,
      receivedOn,
      dueOn,
    },
  ) => {
    const { actorId, actorName } = await requireScope(ctx, gymId);
    validateDate(receivedOn);
    if (receivedOn > academyToday())
      throw new ConvexError("A data de recebimento deve ser hoje ou anterior.");
    if (dueOn) {
      validateDate(dueOn);
      if (dueOn < receivedOn)
        throw new ConvexError(
          "O prazo deve ser igual ou posterior ao recebimento.",
        );
    }
    const accessDeadline =
      kind === "access" ? legalAccessDeadline(receivedOn) : undefined;
    if (dueOn && accessDeadline && dueOn > accessDeadline) {
      throw new ConvexError(
        "O prazo de acesso deve ser de até 15 dias após o recebimento.",
      );
    }
    const email = cleanText(
      requesterEmail,
      "E-mail do solicitante",
      254,
    ).toLowerCase();
    try {
      assertInvitationEmail(email);
    } catch {
      throw new ConvexError("Informe um e-mail válido para o solicitante.");
    }
    const requestId = await ctx.db.insert("privacyRequests", {
      gymId,
      kind,
      status: "received",
      requesterName: cleanText(requesterName, "Nome do solicitante", 120),
      requesterEmail: email,
      representation,
      subjectName:
        representation === "representative"
          ? cleanText(subjectName ?? "", "Nome do titular", 120)
          : undefined,
      description: cleanText(description, "Resumo", 1_000, false),
      receivedOn,
      dueOn: dueOn || accessDeadline,
      assignedTo: actorId,
      assignedToName: actorName,
      revision: 1,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("privacyRequestEvents", {
      requestId,
      actorId,
      actorName,
      status: "received",
      kind: "registered",
    });
    return requestId;
  },
});

export const updateRequest = mutation({
  args: {
    ...scopeArg,
    requestId: v.id("privacyRequests"),
    revision: v.number(),
    change: v.union(
      v.object({ type: v.literal("assign") }),
      v.object({ type: v.literal("verify") }),
      v.object({ type: v.literal("review"), identityVerified: v.boolean() }),
      v.object({
        type: v.literal("complete"),
        outcome: privacyRequestOutcome,
        resolution: v.string(),
      }),
    ),
  },
  handler: async (ctx, { gymId, requestId, revision, change }) => {
    const { actorId, actorName } = await requireScope(ctx, gymId);
    const request = await ctx.db.get(requestId);
    if (!request || request.gymId !== gymId)
      throw new ConvexError("Solicitação indisponível.");
    if (request.revision !== revision)
      throw new ConvexError(
        "A solicitação foi atualizada. Revise os dados e tente novamente.",
      );
    if (request.status === "completed")
      throw new ConvexError("A solicitação está concluída.");
    const now = Date.now();
    const patch: Partial<Doc<"privacyRequests">> = {
      revision: revision + 1,
      updatedAt: now,
    };
    switch (change.type) {
      case "assign":
        if (request.assignedTo === actorId) return;
        patch.assignedTo = actorId;
        patch.assignedToName = actorName;
        break;
      case "verify":
        if (request.status !== "received")
          throw new ConvexError("Esta solicitação já saiu do recebimento.");
        patch.status = "verification";
        break;
      case "review":
        if (request.status !== "verification" || !change.identityVerified) {
          throw new ConvexError(
            "Confirme a identidade e, quando aplicável, o vínculo de representação.",
          );
        }
        patch.status = "review";
        patch.identityVerifiedAt = now;
        break;
      case "complete":
        if (
          request.status !== "review" &&
          !(request.status === "verification" && change.outcome === "declined")
        ) {
          throw new ConvexError(
            "A solicitação precisa passar pela verificação antes da conclusão.",
          );
        }
        patch.status = "completed";
        patch.outcome = change.outcome;
        patch.resolution = cleanText(change.resolution, "Justificativa", 1_000);
        break;
    }
    await ctx.db.patch(requestId, patch);
    await ctx.db.insert("privacyRequestEvents", {
      requestId,
      actorId,
      actorName,
      status: patch.status ?? request.status,
      kind: change.type === "assign" ? "assigned" : "statusChanged",
    });
  },
});

function categoriesFor(gymId?: Id<"gyms">): readonly RetentionCategory[] {
  return gymId ? academyRetentionCategories : platformRetentionCategories;
}

function checkCategory(
  gymId: Id<"gyms"> | undefined,
  category: RetentionCategory,
) {
  if (!categoriesFor(gymId).includes(category))
    throw new ConvexError("Categoria indisponível neste espaço.");
}

function latestRule(
  ctx: QueryCtx,
  gymId: Id<"gyms"> | undefined,
  category: RetentionCategory,
) {
  return ctx.db
    .query("retentionRules")
    .withIndex("by_gym_category_version", (q) =>
      q.eq("gymId", gymId).eq("category", category),
    )
    .order("desc")
    .first();
}

function approvedRule(
  ctx: QueryCtx,
  gymId: Id<"gyms"> | undefined,
  category: RetentionCategory,
) {
  return ctx.db
    .query("retentionRules")
    .withIndex("by_gym_category_status_version", (q) =>
      q.eq("gymId", gymId).eq("category", category).eq("status", "approved"),
    )
    .order("desc")
    .first();
}

export const listRetention = query({
  args: scopeArg,
  handler: async (ctx, { gymId }) => {
    await requireScope(ctx, gymId);
    return Promise.all(
      categoriesFor(gymId).map(async (category) => {
        const [latest, approved] = await Promise.all([
          latestRule(ctx, gymId, category),
          approvedRule(ctx, gymId, category),
        ]);
        return { category, latest, approved };
      }),
    );
  },
});

export const retentionHistory = query({
  args: {
    ...scopeArg,
    category: retentionCategory,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { gymId, category, paginationOpts }) => {
    await requireScope(ctx, gymId);
    checkCategory(gymId, category);
    return ctx.db
      .query("retentionRules")
      .withIndex("by_gym_category_version", (q) =>
        q.eq("gymId", gymId).eq("category", category),
      )
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, 50),
      });
  },
});

export const saveRetentionDraft = mutation({
  args: {
    ...scopeArg,
    category: retentionCategory,
    baseVersion: v.number(),
    purpose: v.string(),
    storageLocation: v.string(),
    startEvent: v.string(),
    retentionDays: v.optional(v.number()),
    disposition: retentionDisposition,
    exceptions: v.string(),
  },
  handler: async (
    ctx,
    {
      gymId,
      category,
      baseVersion,
      retentionDays,
      disposition,
      purpose,
      storageLocation,
      startEvent,
      exceptions,
    },
  ) => {
    const { actorId, actorName } = await requireScope(ctx, gymId);
    checkCategory(gymId, category);
    if (
      retentionDays !== undefined &&
      (!Number.isSafeInteger(retentionDays) ||
        retentionDays < 0 ||
        retentionDays > 36_525)
    ) {
      throw new ConvexError("Informe um prazo entre 0 e 36.525 dias.");
    }
    if (
      category === "reminders" &&
      disposition !== "review" &&
      (startEvent.trim() !== reminderRetentionTrigger ||
        disposition !== "minimize" ||
        retentionDays === undefined)
    ) {
      throw new ConvexError(
        "Para simular lembretes, use o fim da janela de reenvio, um prazo em dias e a remoção do conteúdo.",
      );
    }
    const latest = await latestRule(ctx, gymId, category);
    const version = latest?.version ?? 0;
    if (version !== baseVersion)
      throw new ConvexError(
        "Existe uma versão mais recente. Reabra a regra antes de salvar.",
      );
    return ctx.db.insert("retentionRules", {
      gymId,
      category,
      version: version + 1,
      status: "draft",
      retentionDays,
      disposition,
      purpose: cleanText(purpose, "Finalidade", 300),
      storageLocation: cleanText(
        storageLocation,
        "Local de armazenamento",
        300,
      ),
      startEvent: cleanText(startEvent, "Início do prazo", 180),
      exceptions: cleanText(exceptions, "Exceções", 1_000, false),
      authoredBy: actorId,
      authoredByName: actorName,
    });
  },
});

export const approveRetentionRule = mutation({
  args: { ...scopeArg, ruleId: v.id("retentionRules") },
  handler: async (ctx, { gymId, ruleId }) => {
    const { actorId, actorName } = await requireScope(ctx, gymId);
    const rule = await ctx.db.get(ruleId);
    if (
      !rule ||
      rule.gymId !== gymId ||
      rule.status !== "draft" ||
      (await latestRule(ctx, gymId, rule.category))?._id !== ruleId
    ) {
      throw new ConvexError(
        "Apenas o rascunho mais recente pode ser aprovado.",
      );
    }
    await ctx.db.patch(ruleId, {
      status: "approved",
      approvedBy: actorId,
      approvedByName: actorName,
      approvedAt: Date.now(),
    });
  },
});

export function reminderCleanupEligibility(
  reminder: Doc<"monthlyPaymentReminders">,
  retentionDays: number,
) {
  const terminalAt = reminder.sentAt ?? reminder.failedAt;
  if (terminalAt === undefined) return null;
  const due = Date.parse(`${reminder.dueDate}T00:00:00-03:00`);
  if (!Number.isFinite(due)) return null;
  // The sender accepts retries only on the scheduled send day in Brasília.
  const retryWindowEnd = due - (reminderLeadDays - 1) * dayMs;
  return (
    Math.max(retryWindowEnd, reminder.retryAfter, terminalAt) +
    retentionDays * dayMs
  );
}

export const previewReminderCleanup = query({
  args: {
    gymId: v.id("gyms"),
    ruleId: v.id("retentionRules"),
    asOf: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { gymId, ruleId, asOf, paginationOpts }) => {
    await requireScope(ctx, gymId);
    const rule = await approvedRule(ctx, gymId, "reminders");
    if (
      !rule ||
      rule._id !== ruleId ||
      rule.disposition !== "minimize" ||
      rule.retentionDays === undefined
    ) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    if (!Number.isSafeInteger(asOf) || asOf <= 0)
      throw new ConvexError("Data de simulação inválida.");
    const cutoff = Math.min(asOf, Date.now());
    const retentionDays = rule.retentionDays;
    const result = await ctx.db
      .query("monthlyPaymentReminders")
      .withIndex("by_gym_dueDate", (q) =>
        q
          .eq("gymId", gymId)
          .lte("dueDate", academyToday(cutoff + reminderLeadDays * dayMs)),
      )
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, 50),
      });
    return {
      ...result,
      page: result.page.flatMap((reminder) => {
        const eligibleAt = reminderCleanupEligibility(reminder, retentionDays);
        if (eligibleAt === null || eligibleAt > cutoff) return [];
        return [
          {
            id: reminder._id,
            dueDate: reminder.dueDate,
            eligibleAt,
            status:
              reminder.sentAt !== undefined
                ? ("sent" as const)
                : ("failed" as const),
          },
        ];
      }),
    };
  },
});
