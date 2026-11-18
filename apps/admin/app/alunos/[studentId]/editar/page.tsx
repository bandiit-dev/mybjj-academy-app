import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { EditStudentForm } from "@/components/management-forms";

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <EditStudentForm studentId={studentId as Id<"students">} />;
}
