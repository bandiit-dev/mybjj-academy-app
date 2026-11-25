import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, httpAction, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { assertAdminGymScope, getAccessibleGymIds, requireAdmin } from "./lib/auth";
import { decodeImageBase64, IMAGE_CONTENT_TYPES } from "./lib/imageValidation";

export const authorizeUpload = internalQuery({
  args: { gymId: v.id("gyms") },
  handler: async (ctx, { gymId }) => {
    assertAdminGymScope(await requireAdmin(ctx), [gymId]);
  },
});

export const expireUpload = internalMutation({
  args: { photoId: v.id("images") },
  handler: async (ctx, { photoId }) => {
    const image = await ctx.db.get(photoId);
    if (!image?.studentPhotoGymId || image.url || image.attachedToStudent) return;
    await ctx.storage.delete(image.storageId);
    await ctx.db.delete(photoId);
  },
});

export const recordUpload = internalMutation({
  args: {
    gymId: v.id("gyms"), storageId: v.id("_storage"),
    contentType: v.string(), fileName: v.string(), size: v.number(),
  },
  handler: async (ctx, { gymId, ...image }) => {
    const principal = await requireAdmin(ctx);
    assertAdminGymScope(principal, [gymId]);
    const photoId = await ctx.db.insert("images", {
      ...image, studentPhotoGymId: gymId, uploadedBy: principal.identity.subject, createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, internal.studentPhotos.expireUpload, { photoId });
    return photoId;
  },
});

export const upload = action({
  args: { gymId: v.id("gyms"), base64: v.string(), contentType: v.string(), fileName: v.string() },
  handler: async (ctx, { gymId, base64, contentType, fileName }): Promise<Id<"images">> => {
    await ctx.runQuery(internal.studentPhotos.authorizeUpload, { gymId });
    const bytes = decodeImageBase64(base64, contentType);
    const storageId = await ctx.storage.store(new Blob([bytes], { type: contentType }));
    try {
      return await ctx.runMutation(internal.studentPhotos.recordUpload, {
        gymId, storageId, contentType, fileName: fileName.slice(0, 255), size: bytes.length,
      });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});

export const resolvePhoto = internalQuery({
  args: { studentId: v.string() },
  handler: async (ctx, { studentId }) => {
    let viewer: Awaited<ReturnType<typeof getAccessibleGymIds>>;
    try {
      viewer = await getAccessibleGymIds(ctx);
    } catch {
      return null;
    }
    const id = ctx.db.normalizeId("students", studentId);
    if (!id) return null;
    const { gymIds, principal } = viewer;
    if (!principal.isAdmin && !principal.teacher && principal.student?._id !== id) return null;
    const student = await ctx.db.get(id);
    if (!student?.photoId || !student.gymIds.some(gymId => gymIds.has(gymId))) return null;
    const image = await ctx.db.get(student.photoId);
    if (!image?.studentPhotoGymId || image.url || !image.attachedToStudent) return null;
    if (!IMAGE_CONTENT_TYPES.some(type => type === image.contentType)) return null;
    return { storageId: image.storageId, contentType: image.contentType };
  },
});

export const serve = httpAction(async (ctx, request) => {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!await ctx.auth.getUserIdentity()) return new Response(null, { status: 401, headers });
  const studentId = new URL(request.url).searchParams.get("studentId");
  if (!studentId) return new Response(null, { status: 404, headers });
  const photo = await ctx.runQuery(internal.studentPhotos.resolvePhoto, { studentId });
  const blob = photo && await ctx.storage.get(photo.storageId);
  if (!photo || !blob) return new Response(null, { status: 404, headers });
  return new Response(blob, { headers: { ...headers, "Content-Type": photo.contentType } });
});

export const legacyPhotoBatch = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const { page, ...pagination } = await ctx.db.query("students")
      .withIndex("by_picture", q => q.gt("picture", ""))
      .paginate({ cursor, numItems: 20 });
    const photos = await Promise.all(page.map(async student => {
      const source = await ctx.db.query("images").withIndex("by_url", q => q.eq("url", student.picture)).first();
      return { studentId: student._id, hasPhoto: Boolean(student.photoId), source };
    }));
    return { ...pagination, photos };
  },
});

export const finalizeLegacyPhoto = internalMutation({
  args: { studentId: v.id("students"), sourceId: v.id("images"), newStorageId: v.optional(v.id("_storage")) },
  handler: async (ctx, { studentId, sourceId, newStorageId }) => {
    const [student, source] = await Promise.all([ctx.db.get(studentId), ctx.db.get(sourceId)]);
    if (!source?.url || student?.picture !== source.url) return { status: "changed", usedCopy: false } as const;
    const url = source.url;
    const gymId = student.gymIds[0];
    if (!gymId || (!student.photoId && !newStorageId)) return { status: "unresolved", usedCopy: false } as const;

    const [users, teacher, team, gym] = await Promise.all([
      ctx.db.query("students").withIndex("by_picture", q => q.eq("picture", url)).take(2),
      ctx.db.query("teachers").withIndex("by_picture", q => q.eq("picture", url)).first(),
      ctx.db.query("teams").withIndex("by_logo", q => q.eq("logo", url)).first(),
      ctx.db.query("gyms").withIndex("by_brandingLogo", q => q.eq("branding.logoUrl", url)).first(),
    ]);
    const sharedWithPublicAsset = Boolean(teacher || team || gym);
    const usedCopy = !student.photoId && newStorageId !== undefined;
    const photoId = usedCopy ? await ctx.db.insert("images", {
      storageId: newStorageId, studentPhotoGymId: gymId, attachedToStudent: true,
      contentType: source.contentType, fileName: source.fileName, size: source.size,
      uploadedBy: source.uploadedBy, createdAt: Date.now(),
    }) : student.photoId;

    if (sharedWithPublicAsset) {
      if (usedCopy) await ctx.db.patch(studentId, { photoId });
      // Retain the legacy reference so a later pass can revoke it once the public use is removed.
      return { status: "shared", usedCopy } as const;
    }
    await ctx.db.patch(studentId, { photoId, picture: "" });
    if (users.length === 1) {
      await ctx.storage.delete(source.storageId);
      await ctx.db.delete(sourceId);
    }
    return { status: "migrated", usedCopy } as const;
  },
});

export const migrateLegacyPhotos = internalAction({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }): Promise<{
    migrated: number;
    unresolved: { studentId: Id<"students">; reason: string }[];
    nextCursor: string | null;
  }> => {
    const { photos, isDone, continueCursor } = await ctx.runQuery(internal.studentPhotos.legacyPhotoBatch, { cursor: cursor ?? null });
    let migrated = 0;
    const unresolved = [];
    for (const { studentId, hasPhoto, source } of photos) {
      if (!source || !IMAGE_CONTENT_TYPES.some(type => type === source.contentType)) {
        unresolved.push({ studentId, reason: "no_supported_convex_upload" });
        continue;
      }
      let newStorageId: Id<"_storage"> | undefined;
      if (!hasPhoto) {
        const blob = await ctx.storage.get(source.storageId);
        if (!blob) {
          unresolved.push({ studentId, reason: "original_file_missing" });
          continue;
        }
        newStorageId = await ctx.storage.store(blob);
      }
      let result;
      try {
        result = await ctx.runMutation(internal.studentPhotos.finalizeLegacyPhoto, {
          studentId, sourceId: source._id, newStorageId,
        });
      } catch (error) {
        if (newStorageId) await ctx.storage.delete(newStorageId);
        throw error;
      }
      if (newStorageId && !result.usedCopy) await ctx.storage.delete(newStorageId);
      if (result.status === "migrated") migrated++;
      if (result.status === "shared" || result.status === "unresolved") {
        unresolved.push({ studentId, reason: result.status });
      }
    }
    return { migrated, unresolved, nextCursor: isDone ? null : continueCursor };
  },
});
