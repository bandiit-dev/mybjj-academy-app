import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { StudentDetailsPage } from "@/components/student-details-page";

export default async function Page({params}: {params: Promise<{studentId: string}>}) {
  const {studentId} = await params;
  return <StudentDetailsPage studentId={studentId as Id<"students">}/>;
}
