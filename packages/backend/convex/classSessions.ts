import { assertAdminGymScope } from "./lib/auth";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  getAuthUserIdentity,
  getAccessibleGymIds,
  getCurrentPrincipal,
  requireSessionTeacherOrAdmin,
  requireTeacherOrAdminPrincipal,
} from "./lib/auth";
import {
  assertSessionDate,
  assertTimeRange,
  toIsoDate,
} from "./lib/validators";

import {
  classTitle,
  getClassStaff,
  recurringTime,
  staffCanManageSession,
  staffClassSessions,
  staffHasClassScope,
} from "./classes";
import { academyToday, addPlanMonths, assertPlanDate } from "./lib/studentPlans";
import { clearAttendance, writeAttendance } from "./attendance";

const classSessionStatusValidator = v.union(
  v.literal("Scheduled"),
  v.literal("Cancelled"),
  v.literal("Completed")
);

function includeSessionDate(sessionDate: string, fromDate: string): boolean {
  return sessionDate >= fromDate;
}

async function assertTeacherCanCreateSession(
  principal: Awaited<ReturnType<typeof getCurrentPrincipal>>,
  teacherIds: Id<"teachers">[]
) {
  if (principal.isAdmin) {
    return;
  }

  if (!principal.teacher) {
    throw new Error("Forbidden: teacher or admin role required");
  }

  if (!teacherIds.includes(principal.teacher._id)) {
    throw new Error("Forbidden: teacher must be assigned to the session");
  }
}

export const createClassSession = mutation({
  args: {
    classId: v.id("classes"),
    sessionDate: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    teacherIds: v.optional(v.array(v.id("teachers"))),
    gymIds: v.optional(v.array(v.id("gyms"))),
    unityIds: v.optional(v.array(v.id("unities"))),
    status: v.optional(classSessionStatusValidator),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const principal = await requireTeacherOrAdminPrincipal(ctx);
    assertSessionDate(args.sessionDate);
    assertTimeRange(args.startsAt, args.endsAt);

    const classTemplate = await ctx.db.get(args.classId);
    if (!classTemplate) {
      throw new Error("Class not found");
    }

    const teacherIds = args.teacherIds ?? classTemplate.teacherIds;
    const gymIds = args.gymIds ?? classTemplate.gymIds;
    const unityIds = args.unityIds ?? classTemplate.unityIds;

    assertAdminGymScope(principal, classTemplate.gymIds);
    assertAdminGymScope(principal, gymIds);
    await assertTeacherCanCreateSession(principal, teacherIds);

    const now = Date.now();

    return ctx.db.insert("classSessions", {
      classId: args.classId,
      sessionDate: args.sessionDate,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      teacherIds,
      gymIds,
      unityIds,
      status: args.status ?? "Scheduled",
      notes: args.notes,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateClassSession = mutation({
  args: {
    classSessionId: v.id("classSessions"),
    sessionDate: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    teacherIds: v.optional(v.array(v.id("teachers"))),
    gymIds: v.optional(v.array(v.id("gyms"))),
    unityIds: v.optional(v.array(v.id("unities"))),
    status: v.optional(classSessionStatusValidator),
    notes: v.optional(v.string())
  },
  handler: async (ctx, { classSessionId, ...patch }) => {
    const principal = await requireSessionTeacherOrAdmin(ctx, classSessionId);
    const {session} = principal;
    if (patch.gymIds) assertAdminGymScope(principal, patch.gymIds);

    if (patch.sessionDate) {
      assertSessionDate(patch.sessionDate);
    }

    const startsAt = patch.startsAt ?? session.startsAt;
    const endsAt = patch.endsAt ?? session.endsAt;
    assertTimeRange(startsAt, endsAt);

    await ctx.db.patch(classSessionId, {
      ...patch,
      updatedAt: Date.now()
    });

    return classSessionId;
  }
});

export const cancelClassSession = mutation({
  args: {
    classSessionId: v.id("classSessions"),
    notes: v.optional(v.string())
  },
  handler: async (ctx, { classSessionId, notes }) => {
    await requireSessionTeacherOrAdmin(ctx, classSessionId);

    await ctx.db.patch(classSessionId, {
      status: "Cancelled",
      notes,
      updatedAt: Date.now()
    });

    return classSessionId;
  }
});

export const completeClassSession = mutation({
  args: { classSessionId: v.id("classSessions") },
  handler: async (ctx, { classSessionId }) => {
    await requireSessionTeacherOrAdmin(ctx, classSessionId);

    await ctx.db.patch(classSessionId, {
      status: "Completed",
      updatedAt: Date.now()
    });

    return classSessionId;
  }
});

export const getClassSessionById = query({
  args: { classSessionId: v.id("classSessions") },
  handler: async (ctx, { classSessionId }) => {
    const {gymIds} = await getAccessibleGymIds(ctx);
    const session = await ctx.db.get(classSessionId);
    return session?.gymIds.some(id => gymIds.has(id)) ? session : null;
  }
});

export const getUpcomingClassSessions = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, { limit }) => {
    const { gymIds } = await getAccessibleGymIds(ctx);

    const today = toIsoDate();
    const scheduled = await ctx.db
      .query("classSessions")
      .withIndex("by_status", (q) => q.eq("status", "Scheduled"))
      .collect();

    return scheduled
      .filter((session) => includeSessionDate(session.sessionDate, today) && session.gymIds.some((gymId) => gymIds.has(gymId)))
      .sort((a, b) => (a.sessionDate === b.sessionDate ? a.startsAt - b.startsAt : a.sessionDate.localeCompare(b.sessionDate)))
      .slice(0, limit ?? 50);
  }
});

export const getSessionsByDate = query({
  args: {
    sessionDate: v.string(),
    status: v.optional(classSessionStatusValidator)
  },
  handler: async (ctx, { sessionDate, status }) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    assertSessionDate(sessionDate);

    if (status) {
      const sessions = await ctx.db
        .query("classSessions")
        .withIndex("by_sessionDate_status", (q) => q.eq("sessionDate", sessionDate).eq("status", status))
        .collect();
      return sessions.filter((session) => session.gymIds.some((gymId) => gymIds.has(gymId)));
    }

    const sessions = await ctx.db
      .query("classSessions")
      .withIndex("by_sessionDate", (q) => q.eq("sessionDate", sessionDate))
      .collect();
    return sessions.filter((session) => session.gymIds.some((gymId) => gymIds.has(gymId)));
  }
});

export const getTeacherUpcomingSessions = query({
  args: {
    teacherId: v.optional(v.id("teachers")),
    limit: v.optional(v.number())
  },
  handler: async (ctx, { teacherId, limit }) => {
    const principal = await requireTeacherOrAdminPrincipal(ctx);

    const targetTeacherId = principal.isAdmin ? teacherId : principal.teacher?._id;

    if (!targetTeacherId) {
      throw new Error("Teacher not resolved for query");
    }

    const today = toIsoDate();
    const gymIds = new Set([...(principal.teacher?.gymIds ?? []), ...(principal.student?.gymIds ?? [])]);

    const scheduled = await ctx.db
      .query("classSessions")
      .withIndex("by_status", (q) => q.eq("status", "Scheduled"))
      .collect();

    return scheduled
      .filter(
        (session) => session.teacherIds.includes(targetTeacherId) &&
          session.gymIds.some(id => gymIds.has(id)) && includeSessionDate(session.sessionDate, today)
      )
      .sort((a, b) => (a.sessionDate === b.sessionDate ? a.startsAt - b.startsAt : a.sessionDate.localeCompare(b.sessionDate)))
      .slice(0, limit ?? 50);
  }
});

export const getClassSessionDetail = query({
  args: {
    classSessionId: v.id("classSessions")
  },
  handler: async (ctx, { classSessionId }) => {
    const { principal, gymIds } = await getAccessibleGymIds(ctx);
    const session = await ctx.db.get(classSessionId);
    if (!session) return null;
    const sessionGyms = new Set(session.gymIds.filter(id => gymIds.has(id)));
    if (!sessionGyms.size) throw new Error("Forbidden: academy access required");

    const canManageRoster = Boolean(principal.isAdmin ||
      (principal.teacher && session.teacherIds.includes(principal.teacher._id)));
    const studentId = principal.student?._id;
    const [template, teachers, gyms, units, enrollments, attendance] = await Promise.all([
      ctx.db.get(session.classId),
      Promise.all(session.teacherIds.map(id => ctx.db.get(id))),
      Promise.all([...sessionGyms].map(id => ctx.db.get(id))),
      Promise.all(session.unityIds.map(id => ctx.db.get(id))),
      canManageRoster
        ? ctx.db.query("enrollments").withIndex("by_classSessionId", q => q.eq("classSessionId", classSessionId)).collect()
        : studentId
          ? ctx.db.query("enrollments").withIndex("by_classSessionId_studentId", q => q.eq("classSessionId", classSessionId).eq("studentId", studentId)).collect()
          : [],
      canManageRoster
        ? ctx.db.query("attendance").withIndex("by_classSessionId", q => q.eq("classSessionId", classSessionId)).collect()
        : studentId
          ? ctx.db.query("attendance").withIndex("by_classSessionId_studentId", q => q.eq("classSessionId", classSessionId).eq("studentId", studentId)).collect()
          : [],
    ]);
    const scopedTemplate = template?.gymIds.some(id => sessionGyms.has(id)) ? template : null;
    const attendanceByStudent = new Map(attendance.map(row => [row.studentId, row.status]));
    const enrolledStudents = canManageRoster
      ? (await Promise.all(enrollments.map(async enrollment => {
          const student = await ctx.db.get(enrollment.studentId);
          if (!student?.gymIds.some(id => sessionGyms.has(id))) return null;
          return {
            id: enrollment._id,
            name: student.name,
            enrollment: enrollment.status,
            attendance: attendanceByStudent.get(enrollment.studentId) ?? null,
          };
        }))).filter(row => row !== null)
      : [];
    return {
      session: {
        _id: session._id,
        sessionDate: session.sessionDate,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status,
      },
      classTemplate: scopedTemplate && {
        classType: scopedTemplate.classType,
        level: scopedTemplate.level,
        duration: scopedTemplate.duration,
      },
      teachers: teachers.flatMap(teacher =>
        teacher?.gymIds.some(id => sessionGyms.has(id)) ? [{ name: teacher.name }] : []
      ),
      gyms: gyms.flatMap(gym => gym ? [{ name: gym.name }] : []),
      unities: units.flatMap(unit =>
        unit?.gymId && sessionGyms.has(unit.gymId) ? [{ address: unit.address }] : []
      ),
      canManageRoster,
      enrolledStudents,
      currentUserEnrollment: studentId
        ? enrollments.find(row => row.studentId === studentId)?.status ?? null
        : null,
      currentUserAttendance: studentId ? attendanceByStudent.get(studentId) ?? null : null,
    };
  }
});

export function movedSessions(
  ctx: Pick<QueryCtx, "db">,
  date: string,
  classId?: Id<"classes">,
) {
  return ctx.db.query("classSessions").withIndex(
    "by_originalSessionDate_classId",
    q => classId
      ? q.eq("originalSessionDate", date).eq("classId", classId)
      : q.eq("originalSessionDate", date),
  );
}

function sessionsOnClassDate(ctx: Pick<QueryCtx, "db">, classId: Id<"classes">, date: string) {
  return ctx.db.query("classSessions").withIndex(
    "by_classId_sessionDate",
    q => q.eq("classId", classId).eq("sessionDate", date),
  );
}

async function scheduleOccurrence(ctx: Pick<QueryCtx, "db" | "auth">, classId: Id<"classes">, date: string) {
  assertPlanDate(date);
  const staff = await getClassStaff(ctx);
  const template = await ctx.db.get(classId);
  if (!template || !staffHasClassScope(staff, template)) return null;

  const [actual, moved] = await Promise.all([
    sessionsOnClassDate(ctx, classId, date).collect(),
    movedSessions(ctx, date, classId).collect(),
  ]);
  const matches = [...actual, ...moved.filter(row => row.sessionDate !== date)];
  const assigned = staff.isAdmin || template.teacherIds.some(id => id === staff.teacher?._id);
  const visible = matches.filter(row => staffCanManageSession(staff, row));
  if (!assigned && !visible.length) return null;
  if (matches.length > 1) return { kind: "ambiguous" as const };

  const session = matches[0];
  const gymIds = session?.gymIds ?? template.gymIds;
  if (!gymIds.length || !gymIds.every(id => staff.gymIds.has(id))) return null;
  const time = session ?? recurringTime(template, date);
  if (!time || time.endsAt === null) return null;
  return {
    kind: "occurrence" as const,
    template,
    session,
    gymIds,
    startsAt: time.startsAt,
    endsAt: time.endsAt,
  };
}

export const getStaffScheduleOccurrence = query({
  args: { classId: v.id("classes"), date: v.string() },
  handler: async (ctx, { classId, date }) => {
    const result = await scheduleOccurrence(ctx, classId, date);
    if (!result || result.kind !== "occurrence") return result;
    const { session, template, gymIds, startsAt, endsAt } = result;
    const teachers = (await ctx.db.query("teachers").collect())
      .filter(teacher => teacher.gymIds.some(id => gymIds.includes(id)))
      .map(({ _id, name }) => ({ _id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return {
      kind: result.kind,
      sessionId: session?._id ?? null,
      revision: session?.updatedAt ?? template.updatedAt ?? null,
      date: session?.sessionDate ?? date,
      originalDate: session?.originalSessionDate ?? date,
      startsAt,
      endsAt,
      status: session?.status ?? "Scheduled",
      canEdit: (session?.status ?? "Scheduled") === "Scheduled" && startsAt > Date.now(),
      teacherNames: teachers
        .filter(teacher => (session?.teacherIds ?? template.teacherIds).includes(teacher._id))
        .map(teacher => teacher.name),
      substituteTeacherId: session?.substituteTeacherId ?? null,
      teachers,
    };
  },
});

export const changeStaffScheduleOccurrence = mutation({
  args: {
    classId: v.id("classes"),
    date: v.string(),
    sessionId: v.union(v.id("classSessions"), v.null()),
    revision: v.union(v.number(), v.null()),
    change: v.union(
      v.object({ type: v.literal("cancel") }),
      v.object({
        type: v.literal("update"),
        date: v.string(),
        startTime: v.string(),
        substituteTeacherId: v.optional(v.union(v.id("teachers"), v.null())),
      }),
    ),
  },
  handler: async (ctx, { classId, date, sessionId, revision, change }) => {
    const occurrence = await scheduleOccurrence(ctx, classId, date);
    if (!occurrence || occurrence.kind !== "occurrence") {
      throw new ConvexError("Esta ocorrência não está disponível para alteração.");
    }
    const { template, session, gymIds, startsAt, endsAt } = occurrence;
    if ((session?._id ?? null) !== sessionId || (session?.updatedAt ?? template.updatedAt ?? null) !== revision) {
      throw new ConvexError("A aula foi alterada. Confira os dados atualizados antes de salvar.");
    }
    const now = Date.now();
    if ((session && session.status !== "Scheduled") || startsAt <= now) {
      throw new ConvexError("Somente aulas que ainda não começaram podem ser alteradas.");
    }

    const currentDate = session?.sessionDate ?? date;
    const values = {
      sessionDate: currentDate,
      startsAt,
      endsAt,
      teacherIds: session?.teacherIds ?? template.teacherIds,
      substituteTeacherId: session?.substituteTeacherId,
      originalSessionDate: session?.originalSessionDate ?? currentDate,
      originalStartsAt: session?.originalStartsAt ?? startsAt,
      status: (change.type === "cancel" ? "Cancelled" : "Scheduled") as Doc<"classSessions">["status"],
      updatedAt: Math.max(now, (session?.updatedAt ?? 0) + 1),
    };

    if (change.type === "update") {
      assertPlanDate(change.date);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(change.startTime)) {
        throw new ConvexError("Informe um horário válido.");
      }
      const nextStart = Date.parse(`${change.date}T${change.startTime}:00-03:00`);
      if (nextStart <= now) throw new ConvexError("Escolha uma data e um horário futuros.");

      if (change.date !== currentDate) {
        const [actual, moved] = await Promise.all([
          sessionsOnClassDate(ctx, classId, change.date).collect(),
          movedSessions(ctx, change.date, classId).collect(),
        ]);
        if (
          actual.some(row => row._id !== session?._id) ||
          moved.some(row => row._id !== session?._id) ||
          (change.date !== values.originalSessionDate && recurringTime(template, change.date))
        ) {
          throw new ConvexError("Já existe uma ocorrência desta aula nessa data. Escolha outra data.");
        }
      }
      if (change.date !== currentDate || Math.floor(nextStart / 60_000) !== Math.floor(startsAt / 60_000)) {
        values.sessionDate = change.date;
        values.startsAt = nextStart;
        values.endsAt = nextStart + (endsAt - startsAt);
      }
      if (change.substituteTeacherId) {
        const substitute = await ctx.db.get(change.substituteTeacherId);
        if (!substitute?.gymIds.some(id => gymIds.includes(id))) {
          throw new ConvexError("Selecione um professor da academia desta aula.");
        }
        values.substituteTeacherId = substitute._id;
        values.teacherIds = [substitute._id];
      } else if (change.substituteTeacherId === null && session?.substituteTeacherId) {
        values.teacherIds = template.teacherIds;
        values.substituteTeacherId = undefined;
      }
    }

    if (session) {
      await ctx.db.patch(session._id, values);
      return session._id;
    }
    return ctx.db.insert("classSessions", {
      ...values,
      classId,
      gymIds,
      unityIds: template.unityIds,
      createdAt: now,
    });
  },
});

export const getStaffClassHistory = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, { classId }) => {
    const staff = await getClassStaff(ctx);
    const template = await ctx.db.get(classId);
    if (!template || !staffHasClassScope(staff, template)) return null;

    const scopedSessions = (await staffClassSessions(ctx, classId).collect())
      .filter(session => staffHasClassScope(staff, session));
    const accessibleSessions = scopedSessions.filter(session => staffCanManageSession(staff, session));
    const assigned = template.teacherIds.some(
      (id) => id === staff.teacher?._id,
    );
    if (!staff.isAdmin && !assigned && !accessibleSessions.length) return null;

    const now = Date.now();
    const today = academyToday(now);
    const future = (staff.isAdmin || assigned ? scopedSessions : accessibleSessions)
      .filter(session => session.startsAt > now)
      .sort((a, b) => a.startsAt - b.startsAt);
    let nextScheduleDate = future.find(session => session.status === "Scheduled")?.sessionDate;
    if (staff.isAdmin || assigned) {
      const occupiedDates = new Set(scopedSessions.flatMap(session =>
        session.originalSessionDate
          ? [session.sessionDate, session.originalSessionDate]
          : [session.sessionDate],
      ));
      for (let offset = 0; offset < 14; offset++) {
        const date = academyToday(now + offset * 86_400_000);
        const time = recurringTime(template, date);
        if (!occupiedDates.has(date) && time?.endsAt && time.startsAt > now) {
          if (!nextScheduleDate || date < nextScheduleDate) nextScheduleDate = date;
          break;
        }
      }
    }
    const sessions = accessibleSessions
      .filter(
        (session) =>
          session.sessionDate <= today &&
          session.startsAt <= now,
      )
      .sort(
        (a, b) =>
          b.sessionDate.localeCompare(a.sessionDate) || b.startsAt - a.startsAt,
      )
      .map(({ _id, sessionDate, startsAt, status, originalSessionDate, originalStartsAt }) => ({
        _id,
        sessionDate,
        startsAt,
        status,
        ...(originalStartsAt !== undefined && originalStartsAt !== startsAt ? {
          originalSessionDate,
          originalStartsAt,
        } : {}),
      }));

    return {
      title: classTitle(template),
      isAdmin: staff.isAdmin,
      canRecord: staff.isAdmin || assigned,
      canManageSchedule: staff.isAdmin || assigned || future.length > 0,
      nextScheduleDate: nextScheduleDate ?? future[0]?.sessionDate ?? today,
      sessions,
      today,
    };
  },
});

function sessionLog(ctx: Pick<QueryCtx, "db">, sessionId: Id<"classSessions">) {
  return ctx.db
    .query("classSessionLogs")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .unique();
}

async function staffHistorySession(
  ctx: Pick<QueryCtx, "db" | "auth">,
  sessionId: Id<"classSessions">,
) {
  const staff = await getClassStaff(ctx);
  const session = await ctx.db.get(sessionId);
  const template = session && (await ctx.db.get(session.classId));
  if (
    !session ||
    !template ||
    !staffHasClassScope(staff, template) ||
    !staffCanManageSession(staff, session) ||
    session.status === "Cancelled" ||
    session.sessionDate > academyToday() ||
    session.startsAt > Date.now()
  ) {
    throw new ConvexError("Esta sessão não está disponível no histórico.");
  }
  const sessionGyms = new Set(
    session.gymIds.filter((id) => staff.gymIds.has(id)),
  );
  return { staff, session, sessionGyms };
}

export const getStaffSessionLog = query({
  args: { sessionId: v.id("classSessions") },
  handler: async (ctx, { sessionId }) => {
    const { staff, session, sessionGyms } = await staffHistorySession(
      ctx,
      sessionId,
    );
    const [
      log,
      assignedTeachers,
      availableTeachers,
      enrollments,
      attendance,
      academyStudents,
    ] = await Promise.all([
      sessionLog(ctx, sessionId),
      Promise.all(session.teacherIds.map((id) => ctx.db.get(id))),
      staff.isAdmin ? ctx.db.query("teachers").collect() : [],
      ctx.db
        .query("enrollments")
        .withIndex("by_classSessionId", (q) => q.eq("classSessionId", sessionId))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_classSessionId", (q) => q.eq("classSessionId", sessionId))
        .collect(),
      ctx.db.query("students").collect(),
    ]);
    const teacherInScope = (
      teacher: Doc<"teachers"> | null,
    ): teacher is Doc<"teachers"> =>
      teacher !== null && teacher.gymIds.some((id) => sessionGyms.has(id));
    const toName = (teacher: Doc<"teachers">) => ({
      id: teacher._id,
      name: teacher.name,
    });
    const roster = new Map<
      Id<"students">,
      "Confirmed" | "Present" | "Absent"
    >();
    for (const enrollment of enrollments) {
      if (enrollment.status === "Confirmed")
        roster.set(enrollment.studentId, "Confirmed");
    }
    for (const row of attendance) roster.set(row.studentId, row.status);
    const eligibleStudents = academyStudents
      .filter((student) => student.gymIds.some((id) => sessionGyms.has(id)))
      .map(({ _id: id, name, belt, degree, picture }) => ({
        id,
        name,
        belt,
        degree,
        picture,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const students = eligibleStudents.flatMap((student) => {
      const status = roster.get(student.id);
      return status ? [{ ...student, status }] : [];
    });
    const leadTeacher = log ? await ctx.db.get(log.ledByTeacherId) : null;
    return {
      students,
      availableStudents: eligibleStudents
        .filter(({ id }) => roster.get(id) !== "Present")
        .map(({ id, name, belt, degree }) => ({ id, name, belt, degree })),
      teachers: assignedTeachers.filter(teacherInScope).map(toName),
      eligibleTeachers: availableTeachers
        .filter(teacherInScope)
        .map(toName)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      leadTeacher: teacherInScope(leadTeacher) ? toName(leadTeacher) : null,
      notes: log?.notes ?? "",
      viewerTeacherId: staff.teacher?._id ?? null,
      isAdmin: staff.isAdmin,
    };
  },
});

async function setSessionStudentAttendance(
  ctx: MutationCtx,
  sessionId: Id<"classSessions">,
  studentIds: Id<"students">[],
  status: "Present" | "Absent" | "Unmarked" = "Present",
) {
  const { staff, session, sessionGyms } = await staffHistorySession(
    ctx,
    sessionId,
  );
  const uniqueIds = [...new Set(studentIds)];
  const students = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  if (
    students.some((student) => !student?.gymIds.some((id) => sessionGyms.has(id)))
  ) {
    throw new ConvexError("Selecione apenas alunos da academia desta aula.");
  }
  if (status === "Unmarked") {
    await Promise.all(uniqueIds.map(studentId => clearAttendance(ctx, sessionId, studentId)));
    return;
  }
  const markedByTeacherId =
    staff.teacher?._id ??
    (await sessionLog(ctx, sessionId))?.ledByTeacherId ??
    session.teacherIds[0];
  if (!markedByTeacherId) {
    throw new ConvexError("Defina o professor responsável pela aula primeiro.");
  }
  await Promise.all(
    uniqueIds.map((studentId) =>
      writeAttendance(ctx, {
        classSessionId: sessionId,
        studentId,
        status,
        markedByTeacherId,
      }),
    ),
  );
}

export const markStaffSessionPresence = mutation({
  args: { sessionId: v.id("classSessions"), studentId: v.id("students") },
  handler: (ctx, { sessionId, studentId }) =>
    setSessionStudentAttendance(ctx, sessionId, [studentId]),
});

export const markStaffSessionPresences = mutation({
  args: {
    sessionId: v.id("classSessions"),
    studentIds: v.array(v.id("students")),
  },
  handler: (ctx, { sessionId, studentIds }) =>
    setSessionStudentAttendance(ctx, sessionId, studentIds),
});

export const correctStaffSessionAttendance = mutation({
  args: {
    sessionId: v.id("classSessions"),
    studentId: v.id("students"),
    status: v.union(v.literal("Present"), v.literal("Absent"), v.literal("Unmarked")),
  },
  handler: (ctx, { sessionId, studentId, status }) =>
    setSessionStudentAttendance(ctx, sessionId, [studentId], status),
});

export const recordClassDate = mutation({
  args: { classId: v.id("classes"), date: v.string() },
  handler: async (ctx, { classId, date }) => {
    const staff = await getClassStaff(ctx);
    const template = await ctx.db.get(classId);
    if (
      !template ||
      !staffHasClassScope(staff, template) ||
      (!staff.isAdmin &&
        !template.teacherIds.some((id) => id === staff.teacher?._id))
    ) {
      throw new ConvexError("Você não tem permissão para registrar esta aula.");
    }
    assertPlanDate(date);
    if (date > academyToday())
      throw new ConvexError("Selecione a data de uma aula já realizada.");

    const sessions = await sessionsOnClassDate(ctx, classId, date).collect();
    if (sessions.length) {
      const available = sessions.filter(
        (session) =>
          session.status !== "Cancelled" &&
          session.startsAt <= Date.now() &&
          staffCanManageSession(staff, session),
      );
      if (available.length === 1 && sessions.length === 1)
        return available[0]._id;
      throw new ConvexError(
        "Já existe um registro para esta data. Selecione uma sessão disponível no histórico.",
      );
    }
    const moved = await movedSessions(ctx, date, classId).first();
    if (moved) {
      throw new ConvexError("Esta aula foi reagendada. Consulte a nova data no histórico.");
    }

    if (!template.gymIds.every((id) => staff.gymIds.has(id))) {
      throw new ConvexError(
        "Você não tem permissão para registrar esta aula em todas as suas academias.",
      );
    }
    const time = recurringTime(template, date);
    if (!time || time.endsAt === null) {
      throw new ConvexError(
        "Selecione um dia da programação da aula e confira o horário e a duração no cadastro.",
      );
    }
    const now = Date.now();
    if (time.startsAt > now)
      throw new ConvexError("Selecione uma aula que já começou.");
    const sessionId = await ctx.db.insert("classSessions", {
      classId,
      sessionDate: date,
      startsAt: time.startsAt,
      endsAt: time.endsAt,
      teacherIds: template.teacherIds,
      gymIds: template.gymIds,
      unityIds: template.unityIds,
      status: "Completed",
      createdAt: now,
      updatedAt: now,
    });
    const leadId = staff.isAdmin
      ? template.teacherIds.length === 1
        ? template.teacherIds[0]
        : undefined
      : staff.teacher?._id;
    const lead = leadId && (await ctx.db.get(leadId));
    if (lead && lead.gymIds.some((id) => template.gymIds.includes(id))) {
      await ctx.db.insert("classSessionLogs", {
        sessionId,
        ledByTeacherId: lead._id,
        notes: "",
        updatedAt: now,
      });
    }
    return sessionId;
  },
});

export const saveStaffSessionLog = mutation({
  args: {
    sessionId: v.id("classSessions"),
    ledByTeacherId: v.optional(v.id("teachers")),
    notes: v.string(),
  },
  handler: async (ctx, { sessionId, ledByTeacherId, notes }) => {
    const { staff, session, sessionGyms } = await staffHistorySession(
      ctx,
      sessionId,
    );
    const previous = await sessionLog(ctx, sessionId);
    const teacherId = staff.isAdmin
      ? ledByTeacherId
      : (previous?.ledByTeacherId ?? staff.teacher?._id);
    const teacher = teacherId && (await ctx.db.get(teacherId));
    if (!teacher || !teacher.gymIds.some((id) => sessionGyms.has(id))) {
      throw new ConvexError("Selecione o professor responsável pela aula.");
    }
    const content = notes.trim();
    if (content.length > 3000)
      throw new ConvexError("A observação deve ter até 3.000 caracteres.");
    const now = Date.now();
    const log = {
      sessionId,
      ledByTeacherId: teacher._id,
      notes: content,
      updatedAt: now,
    };
    if (previous) await ctx.db.patch(previous._id, log);
    else await ctx.db.insert("classSessionLogs", log);
    await ctx.db.patch(sessionId, {
      status: "Completed",
      teacherIds: [...new Set([...session.teacherIds, teacher._id])],
      updatedAt: now,
    });
  },
});

function wasTaught(
  session: Doc<"classSessions"> | null,
  today: string,
): session is Doc<"classSessions"> {
  return (
    session !== null &&
    session.status === "Completed" &&
    session.sessionDate <= today &&
    session.startsAt <= Date.now()
  );
}

export const getTeacherClassHistory = query({
  args: { teacherId: v.optional(v.id("teachers")) },
  handler: async (ctx, { teacherId }) => {
    const staff = await getClassStaff(ctx);
    const targetId = teacherId ?? staff.teacher?._id;
    if (!targetId || (!staff.isAdmin && targetId !== staff.teacher?._id))
      return null;

    const teacher = await ctx.db.get(targetId);
    if (!teacher) return null;
    const sharedGyms = new Set(
      teacher.gymIds.filter((id) => staff.gymIds.has(id)),
    );
    if (!sharedGyms.size) return null;

    const logs = await ctx.db
      .query("classSessionLogs")
      .withIndex("by_ledByTeacherId", (q) => q.eq("ledByTeacherId", targetId))
      .collect();
    const today = academyToday();
    const sessions = (
      await Promise.all(logs.map((log) => ctx.db.get(log.sessionId)))
    )
      .filter(
        (session): session is Doc<"classSessions"> =>
          wasTaught(session, today) &&
          session.gymIds.some((id) => sharedGyms.has(id)),
      )
      .sort(
        (a, b) =>
          b.sessionDate.localeCompare(a.sessionDate) || b.startsAt - a.startsAt,
      );
    const [templates, units] = await Promise.all([
      Promise.all(
        [...new Set(sessions.map((session) => session.classId))].map(
          async (id) => [id, await ctx.db.get(id)] as const,
        ),
      ),
      Promise.all(
        [...new Set(sessions.flatMap((session) => session.unityIds))].map(
          async (id) => [id, await ctx.db.get(id)] as const,
        ),
      ),
    ]);
    const templatesById = new Map(templates);
    const unitsById = new Map(units);
    const classes = sessions.map((session) => {
      const template = templatesById.get(session.classId);
      const visibleTemplate =
        template && staffHasClassScope(staff, template) ? template : null;
      return {
        sessionId: session._id,
        classId:
          visibleTemplate && staffCanManageSession(staff, session)
            ? session.classId
            : null,
        title: classTitle(visibleTemplate),
        date: session.sessionDate,
        startsAt: session.startsAt,
        units: session.unityIds.flatMap((id) => {
          const unit = unitsById.get(id);
          return unit?.gymId && sharedGyms.has(unit.gymId)
            ? [unit.name || unit.address]
            : [];
        }),
      };
    });
    return {
      isAdmin: staff.isAdmin,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        picture: teacher.picture,
        belt: teacher.belt,
        role: teacher.role,
      },
      classes,
    };
  },
});

export const getMonthlyTeachingCounts = query({
  args: { month: v.string() },
  handler: async (ctx, { month }) => {
    const staff = await getClassStaff(ctx);
    if (!staff.isAdmin) throw new Error("Forbidden: admin role required");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      throw new Error("Invalid month. Expected YYYY-MM.");
    const start = `${month}-01`;
    const end = addPlanMonths(start, 1);
    const today = academyToday();
    const sessions = await ctx.db
      .query("classSessions")
      .withIndex("by_sessionDate", (q) =>
        q.gte("sessionDate", start).lt("sessionDate", end),
      )
      .collect();
    const logs = await Promise.all(
      sessions
        .filter(
          (session) =>
            wasTaught(session, today) && staffHasClassScope(staff, session),
        )
        .map((session) => sessionLog(ctx, session._id)),
    );
    const counts = new Map<Id<"teachers">, number>();
    for (const log of logs) {
      if (log)
        counts.set(
          log.ledByTeacherId,
          (counts.get(log.ledByTeacherId) ?? 0) + 1,
        );
    }
    return [...counts].map(([teacherId, total]) => ({ teacherId, total }));
  },
});
