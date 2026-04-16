import { Text, View } from "react-native";

export function Badge({ text }: { text: string }) {
  return (
    <View className="self-start rounded-full bg-muted px-3 py-1">
      <Text className="text-xs font-semibold text-mutedForeground">{text}</Text>
    </View>
  );
}
