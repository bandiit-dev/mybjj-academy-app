import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { EditProfessorForm } from "@/components/management-forms";

export default async function Page({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  return <EditProfessorForm teacherId={teacherId as Id<"teachers">} />;
}
