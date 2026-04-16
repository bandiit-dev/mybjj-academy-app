import { Ionicons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { Pressable, SafeAreaView, Text, View } from "react-native";

type TabItem = {
  label: string;
  href: "/(tabs)/home" | "/(tabs)/my-classes" | "/(tabs)/academy" | "/(tabs)/profile";
  icon: keyof typeof Ionicons.glyphMap;
};

const tabs: TabItem[] = [
  { label: "Home", href: "/(tabs)/home", icon: "home-outline" },
  { label: "Aulas", href: "/(tabs)/my-classes", icon: "calendar-outline" },
  { label: "Academia", href: "/(tabs)/academy", icon: "business-outline" },
  { label: "Perfil", href: "/(tabs)/profile", icon: "person-outline" }
];

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <SafeAreaView className="flex-1 bg-[#F3F4F6]">
      <View className="flex-1">
        <Slot />
      </View>

      <View className="flex-row border-t border-[#D1D5DB] bg-white px-2 py-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname === tab.href.replace("/(tabs)", "");

          return (
            <Pressable
              key={tab.href}
              className="flex-1 items-center justify-center gap-1 py-1"
              onPress={() => router.replace(tab.href)}
            >
              <Ionicons name={tab.icon} size={18} color={isActive ? "#111827" : "#9CA3AF"} />
              <Text className={isActive ? "text-xs font-semibold text-[#111827]" : "text-xs text-[#9CA3AF]"}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
