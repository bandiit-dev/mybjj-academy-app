import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { Doc } from "../../lib/convex";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

export function TeacherCard({ teacher }: { teacher: Doc<"teachers"> }) {
  return (
    <Card className="bg-[#E5E7EB]">
      <View className="flex-row gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#D1D5DB]">
          <Ionicons name="person" size={20} color="#4B5563" />
        </View>

        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-[#111827]">{teacher.name}</Text>
          <Text className="text-sm text-[#4B5563]">{teacher.email}</Text>
          <View className="mt-1 flex-row flex-wrap gap-2">
            <Badge text={`${teacher.belt} ${teacher.degree}°`} />
            <Badge text={teacher.classType} />
            <Badge text={teacher.role} />
          </View>
        </View>
      </View>
    </Card>
  );
}
