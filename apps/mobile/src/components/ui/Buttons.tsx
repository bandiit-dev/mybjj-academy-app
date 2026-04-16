import { Pressable, Text } from "react-native";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-12 items-center justify-center rounded-md ${disabled ? "bg-slate-300" : "bg-primary"}`}
    >
      <Text className="font-semibold text-primaryForeground">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-12 items-center justify-center rounded-md border border-border ${disabled ? "bg-slate-100" : "bg-white"}`}
    >
      <Text className="font-semibold text-secondaryForeground">{label}</Text>
    </Pressable>
  );
}
