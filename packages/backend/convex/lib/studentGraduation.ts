import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type Rank = Pick<Doc<"students">, "belt" | "degree">;

export async function recordStudentGraduation(
  ctx: MutationCtx,
  student: Pick<Doc<"students">, "_id" | "belt" | "degree">,
  changes: Partial<Rank>,
  recordedAt: number,
) {
  const belt = changes.belt ?? student.belt;
  const degree = changes.degree ?? student.degree;
  if (belt === student.belt && degree === student.degree) return;

  await ctx.db.insert("studentGraduations", {
    studentId: student._id,
    previousBelt: student.belt,
    previousDegree: student.degree,
    belt,
    degree,
    recordedAt,
  });
}
