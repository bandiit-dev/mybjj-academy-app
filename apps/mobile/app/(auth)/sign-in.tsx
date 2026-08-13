import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useSSO, useSignIn } from "@clerk/expo";

import { Screen } from "../../src/components/ui/Screen";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const isLoaded = Boolean(signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function continueWithEmail() {
    if (!signIn) return;
    setIsLoading(true);
    setErrorText(null);

    try {
      const createResult = await signIn.create({
        identifier: email.trim(),
      });

      if (createResult.error) {
        throw createResult.error;
      }

      const passwordResult = await signIn.password({ password });
      if (passwordResult.error) {
        throw passwordResult.error;
      }

      const finalizeResult = await signIn.finalize();
      if (finalizeResult.error) {
        throw finalizeResult.error;
      }

      router.replace("/(tabs)/home");
    } catch (error: any) {
      const message =
        error?.errors?.[0]?.longMessage ??
        error?.errors?.[0]?.message ??
        error?.message ??
        "Unable to sign in";
      setErrorText(String(message));
    } finally {
      setIsLoading(false);
    }
  }

  async function continueWithGoogle() {
    if (!isLoaded) return;
    setIsLoading(true);
    setErrorText(null);

    try {
      const result = await startSSOFlow({ strategy: "oauth_google" });

      if (result.createdSessionId) {
        await result.setActive?.({ session: result.createdSessionId });
        router.replace("/(tabs)/home");
        return;
      }

      setErrorText("Google sign-in did not complete. Please try again.");
    } catch (error: any) {
      const message = error?.message ?? "Google sign-in failed";
      setErrorText(String(message));
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
            onPress={continueWithEmail}
            disabled={isLoading || !isLoaded || fetchStatus === "fetching"}
            className="mt-1 h-12 items-center justify-center rounded-xl bg-[#111827]"
          >
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Login com email</Text>}
          </Pressable>

          <Pressable
            onPress={continueWithGoogle}
            disabled={isLoading || !isLoaded || fetchStatus === "fetching"}
            className="h-12 items-center justify-center rounded-xl border border-[#D1D5DB] bg-white"
          >
            <Text className="text-base font-semibold text-[#111827]">Login com Google</Text>
          </Pressable>

          {errorText ? <Text className="text-sm text-red-600">{errorText}</Text> : null}
        </View>

        <View className="mt-6 items-center gap-3">
          <Text className="text-sm text-[#6B7280]">Esqueceu a senha?</Text>
          <Text className="text-sm text-[#6B7280]">Criar conta</Text>
        </View>
      </View>
    </Screen>
  );
}
