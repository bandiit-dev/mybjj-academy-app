import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { EditUnitForm } from "@/components/management-forms";

export default async function Page({
  params,
}: {
  params: Promise<{ unityId: string }>;
}) {
  const { unityId } = await params;
  return <EditUnitForm unityId={unityId as Id<"unities">} />;
}
