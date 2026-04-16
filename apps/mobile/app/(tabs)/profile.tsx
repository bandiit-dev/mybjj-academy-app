import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { PrimaryButton, SecondaryButton } from "../../src/components/ui/Buttons";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { LoadingState } from "../../src/components/ui/State";
import { useCurrentProfile } from "../../src/features/profile/hooks/useCurrentProfile";
import { useUpdateProfile } from "../../src/features/profile/hooks/useUpdateProfile";

export default function ProfileScreen() {
  const router = useRouter();
  const { teacher, student, role, isLoading } = useCurrentProfile();
  const { updateStudent, updateTeacher } = useUpdateProfile();

  const profile = teacher ?? student;

  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [picture, setPicture] = useState(profile?.picture ?? "");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!profile) return;
    setSaving(true);
    try {
      if (teacher) {
        await updateTeacher({ teacherId: teacher._id, name, email, phone, picture });
      } else if (student) {
        await updateStudent({ studentId: student._id, name, email, phone, picture });
      }
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading profile..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="text-2xl font-bold text-foreground">My Profile</Text>
      <Text className="text-sm text-mutedForeground">Role: {role}</Text>

      <TextField label="Name" value={name} onChangeText={setName} />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextField label="Phone" value={phone} onChangeText={setPhone} />
      <TextField label="Picture URL" value={picture} onChangeText={setPicture} autoCapitalize="none" />
      {profile ? <Text className="text-sm text-mutedForeground">Belt: {profile.belt}</Text> : null}
      {profile ? <Text className="text-sm text-mutedForeground">Degree: {profile.degree}</Text> : null}

      <PrimaryButton label={saving ? "Saving..." : "Save profile"} onPress={onSave} disabled={saving} />
      <SecondaryButton label="Settings" onPress={() => router.push("/settings")} />
    </Screen>
  );
}
