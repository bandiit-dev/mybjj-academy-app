import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { PrimaryButton, SecondaryButton } from "../../../src/components/ui/Buttons";
import { Badge } from "../../../src/components/ui/Badge";
import { EmptyState, LoadingState } from "../../../src/components/ui/State";
import { Screen } from "../../../src/components/ui/Screen";
import { useCancelEnrollment } from "../../../src/features/classes/hooks/useCancelEnrollment";
import { useConfirmEnrollment } from "../../../src/features/classes/hooks/useConfirmEnrollment";
import { useSessionDetail } from "../../../src/features/classes/hooks/useSessionDetail";
import { useCurrentProfile } from "../../../src/features/profile/hooks/useCurrentProfile";
import type { Id } from "../../../src/lib/convex";

export default function ClassDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const detail = useSessionDetail(sessionId as Id<"classSessions">);
  const confirmEnrollment = useConfirmEnrollment();
  const cancelEnrollment = useCancelEnrollment();
  const { role } = useCurrentProfile();

  if (detail === undefined) {
    return (
      <Screen>
        <LoadingState label="Loading class detail..." />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <EmptyState title="Session not found" description="This class session may have been removed." />
      </Screen>
    );
  }

  const session = detail.session;
  const classTemplate = detail.classTemplate;
  const enrollmentStatus = detail.currentUserEnrollment?.status ?? "Not confirmed";

  return (
    <Screen>
      <Text className="text-2xl font-bold text-foreground">Class Session</Text>
      <View className="gap-2 rounded-lg border border-border bg-card p-4">
        <Text className="text-lg font-semibold text-foreground">{session.sessionDate}</Text>
        <Text className="text-sm text-mutedForeground">
          {new Date(session.startsAt).toLocaleTimeString()} - {new Date(session.endsAt).toLocaleTimeString()}
        </Text>
        <View className="flex-row gap-2">
          <Badge text={session.status} />
          {classTemplate ? <Badge text={classTemplate.classType} /> : null}
          {classTemplate ? <Badge text={classTemplate.level} /> : null}
        </View>
        {classTemplate ? <Text className="text-sm text-mutedForeground">Duration: {classTemplate.duration}</Text> : null}
        <Text className="text-sm text-mutedForeground">Teachers: {detail.teachers.length}</Text>
        <Text className="text-sm text-mutedForeground">Enrolled students: {detail.enrolledStudents.length}</Text>
      </View>

      <Text className="text-base font-semibold text-foreground">My enrollment: {enrollmentStatus}</Text>
      <PrimaryButton label="Confirm attendance" onPress={() => confirmEnrollment({ classSessionId: session._id })} />
      <SecondaryButton label="Cancel attendance" onPress={() => cancelEnrollment({ classSessionId: session._id })} />

      {(role === "teacher" || role === "admin") && (
        <PrimaryButton label="Manage attendance" onPress={() => router.push(`/teacher/sessions/${session._id}`)} />
      )}
    </Screen>
  );
}
