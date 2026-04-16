import { ActivityIndicator, Text, View } from "react-native";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <View className="items-center justify-center gap-3 py-8">
      <ActivityIndicator />
      <Text className="text-mutedForeground">{label}</Text>
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View className="items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted p-6">
      <Text className="text-base font-semibold text-foreground">{title}</Text>
      <Text className="text-center text-sm text-mutedForeground">{description}</Text>
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View className="rounded-lg border border-red-300 bg-red-50 p-4">
      <Text className="font-semibold text-danger">Something went wrong</Text>
      <Text className="mt-1 text-sm text-danger">{message}</Text>
    </View>
  );
}
