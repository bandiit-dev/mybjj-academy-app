import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { PrimaryButton, SecondaryButton } from "../src/components/ui/Buttons";
import { Card } from "../src/components/ui/Card";
import { Screen } from "../src/components/ui/Screen";

export default function SettingsScreen() {
  const router = useRouter();

  async function onSignOut() {
    router.replace("/(auth)/sign-in");
  }

  return (
    <Screen>
      <Text className="text-2xl font-bold text-foreground">Settings</Text>

      <Card>
        <View className="gap-2">
          <Text className="text-base font-semibold text-foreground">Notifications</Text>
          <Text className="text-sm text-mutedForeground">Push/email preferences coming soon.</Text>
        </View>
      </Card>

      <Card>
        <View className="gap-2">
          <Text className="text-base font-semibold text-foreground">Support</Text>
          <Text className="text-sm text-mutedForeground">Help center and contact channels will be added.</Text>
        </View>
      </Card>

      <PrimaryButton label="Sign out" onPress={onSignOut} />
      <SecondaryButton label="Back to profile" onPress={() => router.back()} />
    </Screen>
  );
}
