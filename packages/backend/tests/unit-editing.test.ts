import assert from "node:assert/strict";
import { test } from "node:test";
import { createUnity, updateUnity } from "../convex/unities";

const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
const addressDetails = {
  street: "Avenida Paulista", number: "1000", complement: "Sala 2, 1º andar",
  district: "Bela Vista", city: "São Paulo", state: "SP", postalCode: "01310-100"
};

function context() {
  const units = new Map<string, any>();
  return {
    units,
    auth: { getUserIdentity: async () => ({ subject: "owner" }) },
    db: {
      query: (table: string) => ({ withIndex: () => ({ unique: async () => table === "teachers"
        ? { _id: "teacher_1", clerkUserId: "owner", userType: "Admin", gymIds: ["gym_1"] } : null }) }),
      get: async (id: string) => units.get(id) ?? null,
      insert: async (_table: string, value: any) => { units.set("unit_1", value); return "unit_1"; },
      patch: async (id: string, patch: any) => {
        const unit = units.get(id);
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete unit[key]; else unit[key] = value;
        }
      }
    }
  };
}

test("unit contact and individual address fields survive creation and editing", async () => {
  const ctx = context();
  const unityId = await handler(createUnity)(ctx, { name: "Centro", gymId: "gym_1", phone: "11999999999", address: "", addressDetails });
  assert.deepEqual(ctx.units.get(unityId).addressDetails, addressDetails);
  assert.equal(ctx.units.get(unityId).phone, "11999999999");
  const edited = { ...addressDetails, number: "1200", postalCode: "01310-200", complement: "" };
  await handler(updateUnity)(ctx, { unityId, phone: "1133334444", addressDetails: edited });
  const saved = ctx.units.get(unityId);
  assert.deepEqual(saved.addressDetails, edited);
  assert.equal(saved.phone, "1133334444");
  assert.equal(saved.address, "Avenida Paulista, 1200, Bela Vista, São Paulo, SP, 01310-200");
});

test("updating only a phone preserves a legacy address without guessing its parts", async () => {
  const ctx = context();
  ctx.units.set("legacy", { name: "Centro", gymId: "gym_1", address: "Rua A, 100, Centro, Rio de Janeiro" });
  await handler(updateUnity)(ctx, { unityId: "legacy", phone: "21999999999" });
  assert.equal(ctx.units.get("legacy").address, "Rua A, 100, Centro, Rio de Janeiro");
  assert.equal(ctx.units.get("legacy").addressDetails, undefined);
  assert.equal(ctx.units.get("legacy").phone, "21999999999");
});

test("legacy units can save separate fields without losing punctuation in a complement", async () => {
  const ctx = context();
  ctx.units.set("legacy", { gymId: "gym_1", address: "Endereço antigo" });
  await handler(updateUnity)(ctx, { unityId: "legacy", addressDetails });
  assert.equal(ctx.units.get("legacy").addressDetails.complement, "Sala 2, 1º andar");
  assert.ok(ctx.units.get("legacy").address.includes("Sala 2, 1º andar"));
});

test("updates from clients that send only a full address discard outdated address parts", async () => {
  const ctx = context();
  ctx.units.set("unit_1", { gymId: "gym_1", address: "Antigo", addressDetails });
  await handler(updateUnity)(ctx, { unityId: "unit_1", address: "Novo endereço" });
  assert.equal(ctx.units.get("unit_1").address, "Novo endereço");
  assert.equal(ctx.units.get("unit_1").addressDetails, undefined);
});
