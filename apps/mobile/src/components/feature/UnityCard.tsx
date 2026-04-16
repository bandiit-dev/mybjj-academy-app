import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { Doc } from "../../lib/convex";
import { Card } from "../ui/Card";

export function UnityCard({ unity }: { unity: Doc<"unities"> }) {
  return (
    <Card className="bg-[#E5E7EB]">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#D1D5DB]">
          <Ionicons name="location" size={18} color="#4B5563" />
        </View>

        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-[#111827]">Unidade</Text>
          <Text className="text-sm text-[#4B5563]">{unity.address}</Text>
        </View>
      </View>
    </Card>
  );
}
