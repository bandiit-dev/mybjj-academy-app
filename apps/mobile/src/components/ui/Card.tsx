import { PropsWithChildren } from "react";
import { View } from "react-native";

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ children, className }: CardProps) {
  return <View className={`rounded-2xl border border-[#D1D5DB] bg-white p-4 ${className ?? ""}`}>{children}</View>;
}
