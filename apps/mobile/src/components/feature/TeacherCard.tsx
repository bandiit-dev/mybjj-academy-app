import { Text, View } from "react-native";

import type { Doc } from "../../lib/convex";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

export function TeacherCard({ teacher }: { teacher: Doc<"teachers"> }) {
  return (
    <Card>
      <View className="gap-2">
        <Text className="text-base font-semibold text-foreground">{teacher.name}</Text>
        <Text className="text-sm text-mutedForeground">{teacher.email}</Text>
        <View className="flex-row gap-2">
          <Badge text={`${teacher.belt} ${teacher.degree}°`} />
          <Badge text={teacher.classType} />
          <Badge text={teacher.role} />
        </View>
      </View>
    </Card>
  );
}
