import { Text, TextInput, type TextInputProps, View } from "react-native";

type Props = TextInputProps & {
  label: string;
};

export function TextField({ label, ...props }: Props) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        className="h-12 rounded-md border border-border bg-white px-3 text-foreground"
        placeholderTextColor="#94A3B8"
        {...props}
      />
    </View>
  );
}
