import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type AppTopBarProps = {
  title?: string;
  onMenuPress?: () => void;
};

export function AppTopBar({ title = "My BJJ Academy", onMenuPress }: AppTopBarProps) {
  return (
    <View className="mb-4 h-14 flex-row items-center justify-between rounded-full bg-[#F1F2F4] px-4">
      <Pressable
        onPress={onMenuPress}
        className="h-9 w-9 items-center justify-center rounded-full bg-[#E6E8EC]"
      >
        <Ionicons name="menu" size={18} color="#111827" />
      </Pressable>

      <Text className="text-base font-semibold text-[#1F2937]">{title}</Text>

      <View className="h-9 w-9 rounded-full bg-transparent" />
    </View>
  );
}
