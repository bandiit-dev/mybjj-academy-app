import { Pressable, Text } from "react-native";

type DateChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function DateChip({ label, selected = false, onPress }: DateChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-10 min-w-[68px] items-center justify-center rounded-full px-4 ${
        selected ? "bg-[#1F2937]" : "bg-[#E5E7EB]"
      }`}
    >
      <Text className={`text-sm font-semibold ${selected ? "text-white" : "text-[#374151]"}`}>{label}</Text>
    </Pressable>
  );
}
