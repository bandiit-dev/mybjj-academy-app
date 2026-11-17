import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { decodeImageBase64 } from "./lib/imageValidation";
import type { Id } from "./_generated/dataModel";

export const requireImageUploadAccess = internalQuery({
  args: {},
  handler: async ctx => {
    const principal = await requireAdmin(ctx);
    return principal.identity.subject;
  }
});

export const recordImage = internalMutation({
  args: { storageId: v.id("_storage"), url: v.string(), contentType: v.string(), fileName: v.string(), size: v.number() },
  handler: async (ctx, args) => {
    const principal = await requireAdmin(ctx);
    return ctx.db.insert("images", { ...args, uploadedBy: principal.identity.subject, createdAt: Date.now() });
  }
});

export const uploadBase64 = action({
  args: { base64: v.string(), contentType: v.string(), fileName: v.string() },
  handler: async (ctx, args): Promise<{ storageId: Id<"_storage">; url: string }> => {
    await ctx.runQuery(internal.images.requireImageUploadAccess, {});
    const bytes = decodeImageBase64(args.base64, args.contentType);
    const storageId = await ctx.storage.store(new Blob([bytes], { type: args.contentType }));
    try {
      const url = await ctx.storage.getUrl(storageId);
      if (!url) throw new Error("Não foi possível carregar a imagem salva.");
      await ctx.runMutation(internal.images.recordImage, {
        storageId, url, contentType: args.contentType, fileName: args.fileName.slice(0, 255), size: bytes.length
      });
      return { storageId, url };
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  }
});
