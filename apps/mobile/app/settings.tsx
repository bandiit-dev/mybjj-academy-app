import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useClerk } from "@clerk/expo";

import { AppTopBar } from "../src/components/mobile/AppTopBar";
import { Card } from "../src/components/ui/Card";
import { Screen } from "../src/components/ui/Screen";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useClerk();

  async function onSignOut() {
    await signOut();
    router.replace("/(auth)/sign-in");
  }

  return (
    <Screen>
      <AppTopBar title="Configurações" />

      <Card className="bg-[#E5E7EB]">
        <View className="gap-2">
          <Text className="text-base font-semibold text-[#111827]">Notificações</Text>
          <Text className="text-sm text-[#4B5563]">Preferências de push/email em breve.</Text>
        </View>
      </Card>

      <Card className="bg-[#E5E7EB]">
        <View className="gap-2">
          <Text className="text-base font-semibold text-[#111827]">Suporte</Text>
          <Text className="text-sm text-[#4B5563]">Central de ajuda e contato serão adicionados.</Text>
        </View>
      </Card>

      <Pressable onPress={onSignOut} className="h-12 items-center justify-center rounded-xl bg-[#111827]">
        <Text className="text-base font-semibold text-white">Sair</Text>
      </Pressable>

      <Pressable onPress={() => router.back()} className="h-12 items-center justify-center rounded-xl border border-[#D1D5DB] bg-white">
        <Text className="text-base font-semibold text-[#374151]">Voltar</Text>
      </Pressable>
    </Screen>
  );
}
