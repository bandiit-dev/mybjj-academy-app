import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { toIsoDate } from "./lib/validators";

function assertSeedSecret(secret: string) {
  const expected = process.env.SEED_SECRET;

  if (!expected) {
    throw new Error("SEED_SECRET is not configured");
  }

  if (secret !== expected) {
    throw new Error("Invalid seed secret");
  }
}

function addDays(baseDate: string, days: number): string {
  const d = new Date(`${baseDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function atUtc(dateIso: string, hour: number, minute: number): number {
  return new Date(`${dateIso}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`).getTime();
}

export const seedDemoData = mutation({
  args: {
    secret: v.string(),
    adminClerkUserId: v.optional(v.string()),
    teacherClerkUserId: v.optional(v.string()),
    studentClerkUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    assertSeedSecret(args.secret);

    const now = Date.now();
    const adminClerkUserId = args.adminClerkUserId ?? "user_test_admin";
    const teacherClerkUserId = args.teacherClerkUserId ?? "user_test_teacher";
    const studentClerkUserId = args.studentClerkUserId ?? "user_test_student";

    const teamName = "MyBJJ Academy Team";
    const existingTeams = await ctx.db.query("teams").collect();
    const existingTeam = existingTeams.find((team) => team.name === teamName);
    const teamId =
      existingTeam?._id ??
      (await ctx.db.insert("teams", {
        name: teamName,
        leader: "Coach Alan",
        logo: "https://images.unsplash.com/photo-1517649763962-0c623066013b",
        history: "Seeded team for local development and acceptance tests.",
        founded: "2016-08-01",
        createdAt: now,
        updatedAt: now
      }));

    const gymCnpj = "12.345.678/0001-90";
    const existingGym = await ctx.db
      .query("gyms")
      .withIndex("by_cnpj", (q) => q.eq("cnpj", gymCnpj))
      .unique();

    const gymId =
      existingGym?._id ??
      (await ctx.db.insert("gyms", {
        name: "MyBJJ Academy HQ",
        cnpj: gymCnpj,
        phone: "+55 11 90000-0000",
        email: "hq@mybjjacademy.com.br",
        unityIds: [],
        founded: "2015-05-20",
        teamId,
        branding: {
          logoUrl: "https://images.unsplash.com/photo-1584483766114-2cea6facdf57",
          primaryColor: "#111827",
          secondaryColor: "#E5E7EB"
        },
        teacherIds: [],
        createdAt: now,
        updatedAt: now
      }));

    const existingUnities = await ctx.db
      .query("unities")
      .withIndex("by_gymId", (q) => q.eq("gymId", gymId))
      .collect();
    const unityId =
      existingUnities[0]?._id ??
      (await ctx.db.insert("unities", {
        address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
        gymId,
        createdAt: now,
        updatedAt: now
      }));

    const existingAdminTeacher = await ctx.db
      .query("teachers")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", adminClerkUserId))
      .unique();
    const adminTeacherId =
      existingAdminTeacher?._id ??
      (await ctx.db.insert("teachers", {
        clerkUserId: adminClerkUserId,
        name: "Admin User",
        email: "admin@mybjjacademy.com.br",
        phone: "+55 11 98888-0001",
        belt: "Black",
        degree: 3,
        gymIds: [gymId],
        unityIds: [unityId],
        role: "Head Coach",
        picture: "",
        classType: "GI",
        classIds: [],
        userType: "Admin",
        createdAt: now,
        updatedAt: now
      }));

    const existingTeacher = await ctx.db
      .query("teachers")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", teacherClerkUserId))
      .unique();
    const teacherId =
      existingTeacher?._id ??
      (await ctx.db.insert("teachers", {
        clerkUserId: teacherClerkUserId,
        name: "Professor Teste",
        email: "teacher@mybjjacademy.com.br",
        phone: "+55 11 98888-0002",
        belt: "Brown",
        degree: 2,
        gymIds: [gymId],
        unityIds: [unityId],
        role: "Instructor",
        picture: "",
        classType: "NOGI",
        classIds: [],
        userType: "Normal",
        createdAt: now,
        updatedAt: now
      }));

    const existingStudent = await ctx.db
      .query("students")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", studentClerkUserId))
      .unique();
    const studentId =
      existingStudent?._id ??
      (await ctx.db.insert("students", {
        clerkUserId: studentClerkUserId,
        name: "Aluno Teste",
        email: "student@mybjjacademy.com.br",
        phone: "+55 11 98888-0003",
        belt: "White",
        degree: 1,
        gymIds: [gymId],
        unityIds: [unityId],
        picture: "",
        userType: "Normal",
        createdAt: now,
        updatedAt: now
      }));

    const gym = await ctx.db.get(gymId);
    if (gym) {
      const nextTeacherIds = Array.from(new Set([...gym.teacherIds, adminTeacherId, teacherId]));
      const nextUnityIds = Array.from(new Set([...gym.unityIds, unityId]));
      await ctx.db.patch(gymId, {
        teamId,
        teacherIds: nextTeacherIds,
        unityIds: nextUnityIds,
        updatedAt: now
      });
    }

    const existingClasses = await ctx.db.query("classes").collect();
    const existingClass = existingClasses.find(
      (entry) =>
        entry.startHour === "07:00" &&
        entry.classType === "GI" &&
        entry.level === "Beginner" &&
        entry.teacherIds.includes(teacherId)
    );

    const classId =
      existingClass?._id ??
      (await ctx.db.insert("classes", {
        teacherIds: [teacherId],
        gymIds: [gymId],
        unityIds: [unityId],
        duration: "60 min",
        startHour: "07:00",
        level: "Beginner",
        classType: "GI",
        weekDays: ["Monday", "Wednesday", "Friday"],
        createdAt: now,
        updatedAt: now
      }));

    const teacherDoc = await ctx.db.get(teacherId);
    if (teacherDoc && !teacherDoc.classIds.includes(classId)) {
      await ctx.db.patch(teacherId, {
        classIds: [...teacherDoc.classIds, classId],
        updatedAt: now
      });
    }

    const today = toIsoDate();
    const sessionDates = [addDays(today, 1), addDays(today, 3)];

    const classSessionsForClass = await ctx.db
      .query("classSessions")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    const sessionIds: Id<"classSessions">[] = [];
    for (const sessionDate of sessionDates) {
      const existingSession = classSessionsForClass.find((entry) => entry.sessionDate === sessionDate);

      const sessionId =
        existingSession?._id ??
        (await ctx.db.insert("classSessions", {
          classId,
          sessionDate,
          startsAt: atUtc(sessionDate, 7, 0),
          endsAt: atUtc(sessionDate, 8, 0),
          teacherIds: [teacherId],
          gymIds: [gymId],
          unityIds: [unityId],
          status: "Scheduled",
          notes: "Seed demo session",
          createdAt: now,
          updatedAt: now
        }));

      sessionIds.push(sessionId);
    }

    const primarySessionId = sessionIds[0];
    const existingEnrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", primarySessionId).eq("studentId", studentId)
      )
      .unique();

    if (!existingEnrollment) {
      await ctx.db.insert("enrollments", {
        classSessionId: primarySessionId,
        studentId,
        status: "Confirmed",
        confirmedAt: now,
        createdAt: now,
        updatedAt: now
      });
    }

    const existingAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", primarySessionId).eq("studentId", studentId)
      )
      .unique();

    if (!existingAttendance) {
      await ctx.db.insert("attendance", {
        classSessionId: primarySessionId,
        studentId,
        status: "Present",
        markedByTeacherId: teacherId,
        markedAt: now,
        createdAt: now,
        updatedAt: now
      });
    }

    return {
      teamId,
      gymId,
      unityId,
      classId,
      sessionIds,
      users: {
        adminTeacherId,
        teacherId,
        studentId
      },
      clerkUserIds: {
        adminClerkUserId,
        teacherClerkUserId,
        studentClerkUserId
      }
    };
  }
});
