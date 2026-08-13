import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useConvexAuth } from "convex/react";

export default function AuthLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F3F4F6]">
        <ActivityIndicator />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Slot />;
}
