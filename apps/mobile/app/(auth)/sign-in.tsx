import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { Screen } from "../../src/components/ui/Screen";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function continueToApp() {
    setIsLoading(true);
    try {
      router.replace("/(tabs)/home");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1 bg-[#F3F4F6] pt-24">
        <View className="items-center">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-[#111827]">
            <Text className="text-lg font-bold text-white">BJJ</Text>
          </View>
          <Text className="mt-2 text-xl font-semibold text-[#1F2937]">My BJJ Academy</Text>
        </View>

        <View className="mt-12 gap-3">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            className="h-12 rounded-xl border border-[#D1D5DB] bg-white px-4 text-base text-[#111827]"
            placeholderTextColor="#9CA3AF"
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Senha"
            secureTextEntry
            className="h-12 rounded-xl border border-[#D1D5DB] bg-white px-4 text-base text-[#111827]"
            placeholderTextColor="#9CA3AF"
          />

          <Pressable
            onPress={continueToApp}
            disabled={isLoading}
            className="mt-1 h-12 items-center justify-center rounded-xl bg-[#111827]"
          >
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Login com email</Text>}
          </Pressable>

          <Pressable onPress={continueToApp} className="h-12 items-center justify-center rounded-xl border border-[#D1D5DB] bg-white">
            <Text className="text-base font-semibold text-[#111827]">Login com Google</Text>
          </Pressable>
        </View>

        <View className="mt-6 items-center gap-3">
          <Text className="text-sm text-[#6B7280]">Esqueceu a senha?</Text>
          <Text className="text-sm text-[#6B7280]">Criar conta</Text>
          <Text className="px-6 text-center text-xs text-[#9CA3AF]">
            Layout pronto para Clerk. Basta conectar o fluxo com `useSignIn` e OAuth quando você quiser ativar.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
