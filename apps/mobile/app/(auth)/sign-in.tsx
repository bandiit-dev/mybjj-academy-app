import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { PrimaryButton, SecondaryButton } from "../../src/components/ui/Buttons";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";

export default function SignInScreen() {
  const router = useRouter();

  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center gap-5">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-foreground">MyBJJAcademy</Text>
          <Text className="text-base text-mutedForeground">
            Sign-in UI scaffold is ready. Final Clerk hook wiring will be applied after SDK stabilization.
          </Text>
        </View>

        <TextField label="Email" placeholder="you@academy.com" autoCapitalize="none" />
        <TextField label="Password" placeholder="********" secureTextEntry />

        <PrimaryButton label="Continue" onPress={() => router.replace("/(tabs)/home")} />
        <SecondaryButton label="Continue with Google" onPress={() => router.replace("/(tabs)/home")} />
      </View>
    </Screen>
  );
}
