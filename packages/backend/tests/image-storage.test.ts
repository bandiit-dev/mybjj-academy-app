import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadBase64, requireImageUploadAccess, recordImage } from "../convex/images";
import { decodeImageBase64, MAX_IMAGE_BYTES } from "../convex/lib/imageValidation";

const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=";
const args = { base64: png, contentType: "image/png", fileName: "logo.png" };

function context({ authenticated = true, admin = true, metadataFailure = false, missingUrl = false } = {}) {
  const records: any[] = [];
  const files: Blob[] = [];
  const deleted: string[] = [];
  const ctx: any = {
    records, files, deleted,
    auth: { getUserIdentity: async () => authenticated ? { subject: "user_admin" } : null },
    db: {
      query: (table: string) => ({ withIndex: () => ({ unique: async () => table === "teachers" && admin
        ? { clerkUserId: "user_admin", userType: "Admin", gymIds: ["gym_1"] } : null }) }),
      insert: async (_table: string, record: any) => {
        if (metadataFailure) throw new Error("Metadata failed");
        records.push(record); return "image_1";
      }
    },
    storage: {
      store: async (blob: Blob) => { files.push(blob); return "storage_1"; },
      getUrl: async () => missingUrl ? null : "https://example.convex.cloud/api/storage/storage_1",
      delete: async (id: string) => { deleted.push(id); }
    }
  };
  ctx.runQuery = async (_fn: any, queryArgs: any) => handler(requireImageUploadAccess)(ctx, queryArgs);
  ctx.runMutation = async (_fn: any, mutationArgs: any) => handler(recordImage)(ctx, mutationArgs);
  return ctx;
}

test("Base64 upload stores the decoded image and durable storage metadata", async () => {
  const ctx = context();
  const result = await handler(uploadBase64)(ctx, args);
  assert.equal(result.storageId, "storage_1");
  assert.equal(result.url, "https://example.convex.cloud/api/storage/storage_1");
  assert.equal(ctx.files[0].type, "image/png");
  assert.equal(Buffer.from(await ctx.files[0].arrayBuffer()).toString("base64"), png);
  assert.equal(ctx.records[0].uploadedBy, "user_admin");
  assert.equal(ctx.records[0].storageId, "storage_1");
  assert.equal(ctx.records[0].size, ctx.files[0].size);
  assert.equal("base64" in ctx.records[0], false);
});

test("image upload requires an authenticated academy administrator", async () => {
  for (const options of [{ authenticated: false }, { admin: false }]) {
    const ctx = context(options);
    await assert.rejects(handler(uploadBase64)(ctx, args), /Unauthorized|admin role required/);
    assert.equal(ctx.files.length, 0);
    assert.equal(ctx.records.length, 0);
  }
});

test("unsupported, disguised, malformed, and oversized images are rejected before storage", async () => {
  for (const invalid of [
    { ...args, contentType: "image/svg+xml" },
    { ...args, contentType: "image/jpeg" },
    { ...args, base64: Buffer.from("<html>not an image</html>").toString("base64") },
    { ...args, base64: "invalid?!" },
    { ...args, base64: "" },
    { ...args, base64: Buffer.alloc(MAX_IMAGE_BYTES + 1).toString("base64") }
  ]) {
    const ctx = context();
    await assert.rejects(handler(uploadBase64)(ctx, invalid));
    assert.equal(ctx.files.length, 0);
  }
});

test("JPG validation recognizes JPEG bytes separately from PNG", () => {
  const jpeg = Buffer.from([255, 216, 255, 224, 255, 217]);
  assert.deepEqual(Buffer.from(decodeImageBase64(jpeg.toString("base64"), "image/jpeg")), jpeg);
  assert.throws(() => decodeImageBase64(jpeg.toString("base64"), "image/png"));
});

test("failed metadata writes and missing URLs clean up the uploaded file", async () => {
  for (const options of [{ metadataFailure: true }, { missingUrl: true }]) {
    const ctx = context(options);
    await assert.rejects(handler(uploadBase64)(ctx, args));
    assert.deepEqual(ctx.deleted, ["storage_1"]);
    assert.equal(ctx.records.length, 0);
  }
});
