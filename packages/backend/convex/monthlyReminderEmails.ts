"use node";

import { v } from "convex/values";
import { sendSystemEmail } from "../src/resend";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const send = internalAction({
  args: {
    studentId: v.id("students"),
    gymId: v.id("gyms"),
    day: v.string(),
    previousAttempt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
    const message = await ctx.runMutation(
      internal.monthlyReminders.claim,
      args,
    );
    if (!message) return;

    let providerId: string | undefined;
    try {
      const { data } = await sendSystemEmail({
        to: message.recipient,
        subject: message.subject,
        text: message.text,
        idempotencyKey: `monthly-reminder/${message.reminderId}`,
      });
      providerId = data?.id;
    } finally {
      await ctx.runMutation(internal.monthlyReminders.finish, {
        reminderId: message.reminderId,
        attempt: message.attempt,
        providerId,
      });
    }
  },
});
