import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type SessionRowCardProps = {
  title: string;
  teacherLabel: string;
  timeLabel: string;
  status?: "Scheduled" | "Cancelled" | "Completed";
  onPress?: () => void;
};

function getStatusIcon(status: SessionRowCardProps["status"]) {
  if (status === "Completed") {
    return { name: "checkmark-circle" as const, color: "#10B981" };
  }

  if (status === "Cancelled") {
    return { name: "close-circle" as const, color: "#EF4444" };
  }

  return { name: "time" as const, color: "#6B7280" };
}

export function SessionRowCard({ title, teacherLabel, timeLabel, status = "Scheduled", onPress }: SessionRowCardProps) {
  const icon = getStatusIcon(status);

  return (
    <Pressable onPress={onPress} className="rounded-2xl bg-[#E5E7EB] px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="mr-3 rounded-xl bg-[#111827] px-3 py-2">
          <Text className="text-xs font-semibold text-white">{timeLabel}</Text>
        </View>

        <View className="flex-1">
          <Text className="text-sm font-semibold text-[#111827]">{title}</Text>
          <Text className="mt-0.5 text-xs text-[#4B5563]">{teacherLabel}</Text>
        </View>

        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>
    </Pressable>
  );
}
