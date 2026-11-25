import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { AppTopBar } from "../../src/components/mobile/AppTopBar";
import { ProfileSwitcher } from "../../src/components/feature/ProfileSwitcher";
import { LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useCurrentProfile } from "../../src/features/profile/hooks/useCurrentProfile";
import { useUpdateProfile } from "../../src/features/profile/hooks/useUpdateProfile";

export default function ProfileScreen() {
  const router = useRouter();
  const { teacher, student, role, isLoading } = useCurrentProfile();
  const { updateStudent, updateTeacher } = useUpdateProfile();

  const profile = teacher ?? student;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [picture, setPicture] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone);
    setPicture(teacher?.picture ?? "");
  }, [profile, teacher]);

  async function onSave() {
    if (!profile) return;

    setSaving(true);
    try {
      if (teacher) {
        await updateTeacher({ teacherId: teacher._id, name, email, phone, picture });
      } else if (student) {
        await updateStudent({ studentId: student._id, name, email, phone });
      }
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState label="Carregando perfil..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppTopBar title="Meu Perfil" />
      <ProfileSwitcher />

      <View className="gap-2 rounded-2xl bg-[#E5E7EB] p-4">
        <Text className="text-sm text-[#4B5563]">Tipo de usuário: {role}</Text>
        {profile ? <Text className="text-sm text-[#4B5563]">Faixa: {profile.belt}</Text> : null}
        {profile ? <Text className="text-sm text-[#4B5563]">Grau: {profile.degree}</Text> : null}
      </View>

      <View className="gap-3">
        <TextInput value={name} onChangeText={setName} placeholder="Nome" className="h-12 rounded-xl border border-[#D1D5DB] bg-white px-4 text-[#111827]" />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          className="h-12 rounded-xl border border-[#D1D5DB] bg-white px-4 text-[#111827]"
        />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Telefone" className="h-12 rounded-xl border border-[#D1D5DB] bg-white px-4 text-[#111827]" />
        {teacher ? <TextInput
          value={picture}
          onChangeText={setPicture}
          placeholder="URL da foto"
          autoCapitalize="none"
          className="h-12 rounded-xl border border-[#D1D5DB] bg-white px-4 text-[#111827]"
        /> : null}
      </View>

      <Pressable onPress={onSave} disabled={saving} className="h-12 items-center justify-center rounded-xl bg-[#111827]">
        <Text className="text-base font-semibold text-white">{saving ? "Salvando..." : "Salvar perfil"}</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/settings")} className="h-12 items-center justify-center rounded-xl border border-[#D1D5DB] bg-white">
        <Text className="text-base font-semibold text-[#374151]">Configurações</Text>
      </Pressable>
    </Screen>
  );
}
