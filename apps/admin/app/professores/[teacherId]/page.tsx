import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { TeacherDetailsPage } from "@/components/teacher-details-page";

export default async function Page({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  return <TeacherDetailsPage teacherId={teacherId as Id<"teachers">} />;
}
