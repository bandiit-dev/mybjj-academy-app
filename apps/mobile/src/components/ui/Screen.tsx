import { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";

type Props = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
}>;

export function Screen({ children, scroll = true, padded = true }: Props) {
  if (!scroll) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className={padded ? "flex-1 px-5 py-4" : "flex-1"}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName={padded ? "px-5 py-4 gap-4" : "gap-4"}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
