import type { MutationCtx, QueryCtx } from "../_generated/server";

export const INVITATION_PREFIX = "invitation:";

export async function profilesWithAccessEmail(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  const [teachers, personalStudents, guardianStudents] = await Promise.all([
    ctx.db.query("teachers").withIndex("by_email", q => q.eq("email", normalized)).collect(),
    ctx.db.query("students").withIndex("by_email", q => q.eq("email", normalized))
      .filter(q => q.neq(q.field("clerkUserId"), undefined)).collect(),
    ctx.db.query("students").withIndex("by_guardianEmail", q => q.eq("guardianEmail", normalized)).collect(),
  ]);
  return {
    teachers,
    students: [
      ...personalStudents.filter(student => !student.guardianEmail),
      ...guardianStudents.filter(student => Boolean(student.clerkUserId)),
    ],
  };
}
