import { useRouter, usePathname, Slot } from "expo-router";
import { Pressable, SafeAreaView, Text, View } from "react-native";

type TabItem = {
  label: string;
  href: "/(tabs)/home" | "/(tabs)/my-classes" | "/(tabs)/academy" | "/(tabs)/profile";
};

const tabs: TabItem[] = [
  { label: "Home", href: "/(tabs)/home" },
  { label: "My Classes", href: "/(tabs)/my-classes" },
  { label: "Academy", href: "/(tabs)/academy" },
  { label: "Profile", href: "/(tabs)/profile" }
];

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>

      <View className="flex-row border-t border-border bg-white px-2 py-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname === tab.href.replace("/(tabs)", "");

          return (
            <Pressable
              key={tab.href}
              className="flex-1 items-center justify-center py-2"
              onPress={() => router.replace(tab.href)}
            >
              <Text className={isActive ? "text-xs font-semibold text-primary" : "text-xs text-mutedForeground"}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
