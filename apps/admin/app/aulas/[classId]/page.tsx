import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { ClassDetailsPage } from "@/components/class-details-page";

export default async function Page({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <ClassDetailsPage classId={classId as Id<"classes">} />;
}
