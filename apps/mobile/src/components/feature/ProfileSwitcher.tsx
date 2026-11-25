import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../lib/convex";

export function ProfileSwitcher() {
  const onboarding = useQuery(api.onboarding.getOnboardingStatus);
  const ready = onboarding?.status === "ready" ? onboarding : undefined;
  const profiles = useQuery(
    api.onboarding.listProfileAccess,
    ready?.activeGymId ? {} : "skip",
  );
  const selectAcademy = useMutation(api.onboarding.selectAcademy);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!ready || !profiles || profiles.length < 2) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        className="rounded-xl border border-[#D1D5DB] bg-white p-3"
        onPress={() => {
          setError("");
          setOpen(true);
        }}
      >
        <Text className="text-center font-semibold text-[#111827]">
          Trocar perfil
        </Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-center bg-black/40 p-6">
          <View
            className="max-h-[80%] gap-3 rounded-2xl bg-white p-4"
            accessibilityViewIsModal
          >
            <Text className="text-lg font-semibold">Selecione um perfil</Text>
            <ScrollView>
              {profiles.map((profile) => {
                const selected =
                  profile.gymId === ready.activeGymId &&
                  profile.studentId === ready.activeStudentId;
                const role =
                  profile.role === "admin"
                    ? "Admin"
                    : profile.role === "teacher"
                      ? "Professor"
                      : "Aluno";
                return (
                  <Pressable
                    key={`${profile.gymId}:${profile.studentId ?? ""}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={busy}
                    className={`rounded-lg p-3 ${selected ? "bg-[#E5E7EB]" : ""}`}
                    onPress={async () => {
                      if (selected) {
                        setOpen(false);
                        return;
                      }
                      setBusy(true);
                      setError("");
                      try {
                        await selectAcademy({
                          gymId: profile.gymId,
                          studentId: profile.studentId,
                        });
                        setOpen(false);
                      } catch {
                        setError(
                          "Não foi possível trocar de perfil. Tente novamente.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Text className="font-semibold">{profile.name}</Text>
                    <Text className="text-sm text-[#4B5563]">
                      {profile.gymName} · {role}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {!!error && (
              <Text accessibilityRole="alert" className="text-red-700">
                {error}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
            >
              <Text className="p-2 text-center font-semibold">Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
