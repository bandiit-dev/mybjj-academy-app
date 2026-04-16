import { useRouter } from "expo-router";
import { Text } from "react-native";

import { TeacherRouteGuard } from "../../src/components/feature/TeacherRouteGuard";
import { SessionCard } from "../../src/components/feature/SessionCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useTeacherUpcomingSessions } from "../../src/features/teacher/hooks/useTeacherUpcomingSessions";

export default function TeacherDashboardScreen() {
  const router = useRouter();
  const sessions = useTeacherUpcomingSessions(30);

  return (
    <TeacherRouteGuard>
      <Screen>
        <Text className="text-2xl font-bold text-foreground">Teacher Dashboard</Text>
        {sessions === undefined ? <LoadingState label="Loading your sessions..." /> : null}
        {sessions && sessions.length === 0 ? (
          <EmptyState title="No sessions" description="No teaching sessions found for upcoming dates." />
        ) : null}
        {sessions?.map((session) => (
          <SessionCard
            key={session._id}
            session={session}
            onPress={() => router.push(`/teacher/sessions/${session._id}`)}
          />
        ))}
      </Screen>
    </TeacherRouteGuard>
  );
}
