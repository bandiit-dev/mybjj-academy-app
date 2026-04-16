import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

import { Screen } from "../../src/components/ui/Screen";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/(auth)/sign-in");
    }, 1200);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Screen scroll={false} padded={false}>
      <View className="flex-1 items-center justify-center bg-[#F3F4F6]">
        <View className="items-center gap-2">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-[#111827]">
            <Text className="text-lg font-bold text-white">BJJ</Text>
          </View>
          <Text className="text-xl font-semibold text-[#1F2937]">My BJJ Academy</Text>
        </View>
      </View>
    </Screen>
  );
}
