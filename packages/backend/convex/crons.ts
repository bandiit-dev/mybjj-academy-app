import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.daily(
  "lembretes de mensalidade",
  { hourUTC: 12, minuteUTC: 15 },
  internal.monthlyReminders.queuePage,
  {},
);

export default crons;
