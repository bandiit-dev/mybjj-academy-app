import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export function studentPhotoPath(student: Pick<Doc<"students">, "_id" | "photoId">) {
  return student.photoId ? `/api/student-photos/${student._id}?v=${student.photoId}` : "";
}

export function withProtectedStudentPhoto(student: Doc<"students">) {
  const { photoId, ...profile } = student;
  return { ...profile, picture: studentPhotoPath({ _id: student._id, photoId }) };
}

export function rejectPublicStudentPhoto(picture?: string) {
  if (picture?.trim()) {
    throw new ConvexError("Selecione um arquivo JPG ou PNG para atualizar a foto do aluno.");
  }
}

export async function claimStudentPhoto(
  ctx: MutationCtx,
  photoId: Id<"images"> | undefined,
  gymIds: Id<"gyms">[],
  uploadedBy: string,
  previousPhotoId?: Id<"images">,
) {
  if (!photoId) return {};
  const photo = await ctx.db.get(photoId);
  if (!photo?.studentPhotoGymId || photo.url || photo.attachedToStudent ||
      photo.uploadedBy !== uploadedBy || !gymIds.includes(photo.studentPhotoGymId)) {
    throw new ConvexError("Envie novamente a foto do aluno nesta academia.");
  }
  await ctx.db.patch(photoId, { attachedToStudent: true });
  if (previousPhotoId) {
    const previous = await ctx.db.get(previousPhotoId);
    if (previous?.studentPhotoGymId && !previous.url) {
      await ctx.storage.delete(previous.storageId);
      await ctx.db.delete(previousPhotoId);
    }
  }
  return { photoId };
}
