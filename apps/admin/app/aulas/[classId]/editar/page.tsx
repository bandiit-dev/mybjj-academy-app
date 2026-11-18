import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { EditClassForm } from "@/components/management-forms";

export default async function Page({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <EditClassForm classId={classId as Id<"classes">} />;
}
