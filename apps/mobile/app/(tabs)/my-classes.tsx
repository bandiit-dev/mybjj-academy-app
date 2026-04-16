import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Card } from "../../src/components/ui/Card";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useMyUpcomingEnrollments } from "../../src/features/classes/hooks/useMyUpcomingEnrollments";

export default function MyClassesScreen() {
  const router = useRouter();
  const enrollments = useMyUpcomingEnrollments();

  return (
    <Screen>
      <Text className="text-2xl font-bold text-foreground">My Confirmations</Text>

      {enrollments === undefined ? <LoadingState label="Loading your classes..." /> : null}
      {enrollments && enrollments.length === 0 ? (
        <EmptyState
          title="No enrollments"
          description="Confirm attendance in class details to build your upcoming list."
        />
      ) : null}

      {enrollments?.map((item) => (
        <Card key={item.enrollment._id}>
          <View className="gap-2">
            <Text className="text-base font-semibold text-foreground">{item.session?.sessionDate}</Text>
            <Text className="text-sm text-mutedForeground">Status: {item.enrollment.status}</Text>
            <Text
              className="text-sm font-semibold text-primary"
              onPress={() => item.session && router.push(`/classes/${item.session._id}`)}
            >
              Open class detail
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
