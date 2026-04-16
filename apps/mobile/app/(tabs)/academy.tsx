import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { AppTopBar } from "../../src/components/mobile/AppTopBar";
import { Card } from "../../src/components/ui/Card";
import { LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useAcademyDetails } from "../../src/features/academy/hooks/useAcademyDetails";

export default function AcademyScreen() {
  const router = useRouter();
  const { gyms, teams } = useAcademyDetails();

  return (
    <Screen>
      <AppTopBar title="Academia" />

      {gyms === undefined || teams === undefined ? <LoadingState label="Carregando academia..." /> : null}

      {gyms?.map((gym) => {
        const team = gym.teamId ? teams?.find((entry) => entry._id === gym.teamId) : null;

        return (
          <Card key={gym._id} className="bg-[#E5E7EB]">
            <View className="gap-1">
              <Text className="text-lg font-semibold text-[#111827]">{gym.name}</Text>
              <Text className="text-sm text-[#4B5563]">{gym.email}</Text>
              <Text className="text-sm text-[#4B5563]">{gym.phone}</Text>
              <Text className="text-sm text-[#4B5563]">Fundada em: {gym.founded}</Text>
              {team ? <Text className="text-sm text-[#4B5563]">Equipe: {team.name}</Text> : null}
            </View>
          </Card>
        );
      })}

      <Card className="bg-[#E5E7EB]">
        <View className="gap-2">
          <Pressable onPress={() => router.push("/academy/teachers")}>
            <Text className="text-base font-semibold text-[#111827]">Professores</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/academy/unities")}>
            <Text className="text-base font-semibold text-[#111827]">Unidades</Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}
