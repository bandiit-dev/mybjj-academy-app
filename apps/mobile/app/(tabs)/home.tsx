import { useRouter } from "expo-router";
import { Text } from "react-native";

import { SessionCard } from "../../src/components/feature/SessionCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useUpcomingSessions } from "../../src/features/classes/hooks/useUpcomingSessions";

export default function HomeScreen() {
  const router = useRouter();
  const sessions = useUpcomingSessions(30);

  return (
    <Screen>
      <Text className="text-2xl font-bold text-foreground">Upcoming Classes</Text>
      {sessions === undefined ? <LoadingState label="Loading upcoming sessions..." /> : null}
      {sessions && sessions.length === 0 ? (
        <EmptyState title="No sessions yet" description="New class sessions will show up here." />
      ) : null}
      {sessions?.map((session) => (
        <SessionCard
          key={session._id}
          session={session}
          onPress={() => router.push(`/classes/${session._id}`)}
        />
      ))}
    </Screen>
  );
}
