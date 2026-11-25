import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expireUpload,
  finalizeLegacyPhoto,
  resolvePhoto,
  serve,
  upload,
} from "../convex/studentPhotos";
import {
  claimStudentPhoto,
  rejectPublicStudentPhoto,
  withProtectedStudentPhoto,
} from "../convex/lib/studentPhotos";

const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
const legacyUrl = "https://example.convex.cloud/api/storage/legacy";
const student = { _id: "student", photoId: "photo", gymIds: ["gym"], picture: legacyUrl, clerkUserId: "guardian" };
const photo = {
  _id: "photo", studentPhotoGymId: "gym", storageId: "private-storage", attachedToStudent: true,
  uploadedBy: "admin", contentType: "image/png", fileName: "photo.png", size: 100,
};

function fixture(subject: string | null) {
  const tables: Record<string, any[]> = {
    students: [
      { ...student },
      { ...student, _id: "peer", clerkUserId: "peer-login", picture: "", photoId: undefined },
      { ...student, _id: "sibling", picture: "", photoId: undefined },
    ],
    academySelections: [{ clerkUserId: "guardian", gymId: "gym", studentId: "student" }],
    teachers: [
      { _id: "admin-profile", clerkUserId: "admin", gymIds: ["gym"], userType: "Admin" },
      { _id: "teacher-profile", clerkUserId: "teacher", gymIds: ["gym"], userType: "Normal" },
      { _id: "outside-profile", clerkUserId: "outside", gymIds: ["other-gym"], userType: "Admin" },
    ],
    billingAccounts: ["gym", "other-gym"].map(gymId => ({
      gymId, status: "active", priceId: "price_test", paidThrough: Date.UTC(2199, 0, 1),
    })),
    images: [{ ...photo }],
    teams: [],
    gyms: [],
  };
  const deleted: string[] = [];
  const rows = () => Object.values(tables).flat();
  const ctx = {
    auth: { getUserIdentity: async () => subject ? { subject } : null },
    db: {
      normalizeId: (_table: string, id: string) => tables.students.some(row => row._id === id) ? id : null,
      get: async (id: string) => rows().find(row => row._id === id) ?? null,
      insert: async (table: string, record: object) => {
        const id = `${table}-${tables[table].length}`;
        tables[table].push({ _id: id, ...record });
        return id;
      },
      patch: async (id: string, fields: object) => { Object.assign(rows().find(row => row._id === id), fields); },
      delete: async (id: string) => {
        for (const table of Object.values(tables)) {
          const index = table.findIndex(row => row._id === id);
          if (index !== -1) table.splice(index, 1);
        }
      },
      query: (table: string) => ({ withIndex: (_index: string, predicate: (q: any) => void) => {
        let matches = tables[table];
        predicate({ eq: (field: string, value: unknown) => {
          matches = matches.filter(row => field.split(".").reduce((obj, key) => obj?.[key], row) === value);
        } });
        return {
          collect: async () => matches, unique: async () => matches[0] ?? null,
          first: async () => matches[0] ?? null, take: async (limit: number) => matches.slice(0, limit),
        };
      } }),
    },
    storage: {
      delete: async (id: string) => { deleted.push(id); },
      get: async () => new Blob(["photo bytes"]),
    },
  };
  return { ctx, tables, deleted };
}

test("photo bytes are served only to academy staff and the selected student or guardian", async () => {
  const request = new Request("https://example.convex.site/student-photo?studentId=student");
  for (const [subject, expected] of [
    [null, 401], ["admin", 200], ["teacher", 200], ["guardian", 200], ["peer-login", 404], ["outside", 404],
  ] as const) {
    const { ctx } = fixture(subject);
    const response = await handler(serve)({
      ...ctx, runQuery: (_fn: unknown, args: object) => handler(resolvePhoto)(ctx, args),
    }, request);
    assert.equal(response.status, expected, subject ?? "signed out");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(await response.text(), expected === 200 ? "photo bytes" : "");
    if (expected === 200) assert.equal(response.headers.get("content-type"), "image/png");
  }
  const { ctx, tables } = fixture("guardian");
  tables.academySelections[0].studentId = "sibling";
  assert.equal(await handler(resolvePhoto)(ctx, { studentId: "student" }), null);
  tables.academySelections[0].studentId = "student";
  tables.students[0].plan = { isActive: false };
  assert.equal(await handler(resolvePhoto)(ctx, { studentId: "student" }), null);
});

test("student uploads do not generate URLs and can be attached only once by the uploading admin in the same academy", async () => {
  const { ctx, tables, deleted } = fixture("admin");
  const uploadId = await handler(upload)({
    runQuery: async () => {},
    storage: { store: async () => "new-storage" },
    runMutation: async (_fn: unknown, image: object) => {
      assert.equal("url" in image, false);
      tables.images.push({ ...image, _id: "new-photo", uploadedBy: "admin", studentPhotoGymId: "gym" });
      return "new-photo";
    },
  }, {
    gymId: "gym", fileName: "photo.png", contentType: "image/png",
    base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  });
  assert.equal(uploadId, "new-photo");
  const claim = (gyms: string[], user: string, previous?: string) =>
    claimStudentPhoto(ctx as any, uploadId, gyms as any, user, previous as any);
  await assert.rejects(claim(["other-gym"], "admin"), /nesta academia/);
  await assert.rejects(claim(["gym"], "other-admin"), /nesta academia/);
  assert.deepEqual(await claim(["gym"], "admin", "photo"), { photoId: uploadId });
  await assert.rejects(claim(["gym"], "admin"), /nesta academia/);
  await handler(expireUpload)(ctx, { photoId: uploadId });
  assert.deepEqual(deleted, ["private-storage"]);
  assert.throws(() => rejectPublicStudentPhoto(legacyUrl), /Selecione um arquivo/);
});

test("legacy photos are hidden until copied, and the old Convex file is revoked after the last reference", async () => {
  const { ctx, tables, deleted } = fixture("admin");
  tables.students[0].photoId = undefined;
  tables.students[1].picture = legacyUrl;
  tables.images.push({ ...photo, _id: "legacy", url: legacyUrl, storageId: "legacy-storage" });
  assert.equal(withProtectedStudentPhoto(tables.students[0]).picture, "");
  const migrate = (studentId: string, newStorageId?: string) => handler(finalizeLegacyPhoto)(ctx, {
    studentId, sourceId: "legacy", newStorageId,
  });
  assert.deepEqual(await migrate("student", "copy-one"), { status: "migrated", usedCopy: true });
  assert.equal(tables.students[0].picture, "");
  assert.match(withProtectedStudentPhoto(tables.students[0]).picture, /^\/api\/student-photos\/student\?v=/);
  assert.deepEqual(deleted, []);
  tables.teams.push({ logo: legacyUrl });
  assert.deepEqual(await migrate("peer", "copy-two"), { status: "shared", usedCopy: true });
  assert.deepEqual(deleted, []);
  tables.teams.pop();
  assert.deepEqual(await migrate("peer"), { status: "migrated", usedCopy: false });
  assert.deepEqual(deleted, ["legacy-storage"]);
});
