import { Text, View } from "react-native";

import type { Doc } from "../../lib/convex";
import { Card } from "../ui/Card";

export function UnityCard({ unity }: { unity: Doc<"unities"> }) {
  return (
    <Card>
      <View className="gap-1">
        <Text className="text-base font-semibold text-foreground">Unity</Text>
        <Text className="text-sm text-mutedForeground">{unity.address}</Text>
      </View>
    </Card>
  );
}
