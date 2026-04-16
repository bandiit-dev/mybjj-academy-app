import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Card } from "../../src/components/ui/Card";
import { LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useAcademyDetails } from "../../src/features/academy/hooks/useAcademyDetails";

export default function AcademyScreen() {
  const router = useRouter();
  const { gyms, teams } = useAcademyDetails();

  return (
    <Screen>
      <Text className="text-2xl font-bold text-foreground">Academy</Text>

      {gyms === undefined || teams === undefined ? <LoadingState label="Loading academy data..." /> : null}

      {gyms?.map((gym) => {
        const team = gym.teamId ? teams?.find((entry) => entry._id === gym.teamId) : null;
        return (
          <Card key={gym._id}>
            <View className="gap-2">
              <Text className="text-lg font-semibold text-foreground">{gym.name}</Text>
              <Text className="text-sm text-mutedForeground">{gym.email}</Text>
              <Text className="text-sm text-mutedForeground">{gym.phone}</Text>
              <Text className="text-sm text-mutedForeground">Founded: {gym.founded}</Text>
              {team ? <Text className="text-sm text-mutedForeground">Team: {team.name}</Text> : null}
            </View>
          </Card>
        );
      })}

      <Card>
        <View className="gap-3">
          <Text className="text-base font-semibold text-foreground" onPress={() => router.push("/academy/teachers")}>
            View teachers
          </Text>
          <Text className="text-base font-semibold text-foreground" onPress={() => router.push("/academy/unities")}>
            View unities
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
