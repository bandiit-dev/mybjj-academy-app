import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { AppTopBar } from "../../../src/components/mobile/AppTopBar";
import { EmptyState, LoadingState } from "../../../src/components/ui/State";
import { Screen } from "../../../src/components/ui/Screen";
import { useCancelEnrollment } from "../../../src/features/classes/hooks/useCancelEnrollment";
import { useConfirmEnrollment } from "../../../src/features/classes/hooks/useConfirmEnrollment";
import { useSessionDetail } from "../../../src/features/classes/hooks/useSessionDetail";
import { useCurrentProfile } from "../../../src/features/profile/hooks/useCurrentProfile";
import type { Id } from "../../../src/lib/convex";

function formatHour(startsAt: number, endsAt: number) {
  const start = new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const end = new Date(endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${start} - ${end}`;
}

export default function ClassDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const detail = useSessionDetail(sessionId as Id<"classSessions">);
  const confirmEnrollment = useConfirmEnrollment();
  const cancelEnrollment = useCancelEnrollment();
  const { role } = useCurrentProfile();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (detail === undefined) {
    return (
      <Screen>
        <LoadingState label="Carregando aula..." />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <EmptyState title="Aula não encontrada" description="Essa sessão pode ter sido removida." />
      </Screen>
    );
  }

  const session = detail.session;
  const classTemplate = detail.classTemplate;
  const teacherNames = detail.teachers.map((teacher) => teacher.name).join(", ") || "Professor a definir";
  const gymName = detail.gyms[0]?.name ?? "Academia";
  const unityAddress = detail.unities[0]?.address ?? "Unidade principal";
  const confirmedRoster = detail.enrolledStudents.filter(row => row.enrollment === "Confirmed");
  const confirmed = detail.currentUserEnrollment === "Confirmed";
  const canChangeEnrollment = role === "student" && !detail.currentUserAttendance &&
    session.status !== "Cancelled";

  async function onConfirmPresence() {
    setSubmitting(true);
    try {
      await confirmEnrollment({ classSessionId: session._id });
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancelPresence() {
    setSubmitting(true);
    try {
      await cancelEnrollment({ classSessionId: session._id });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppTopBar />

      <View className="gap-2 rounded-3xl bg-[#E5E7EB] p-4">
        <View className="w-28 rounded-xl bg-[#111827] px-3 py-2">
          <Text className="text-center text-xs font-semibold text-white">{session.sessionDate}</Text>
        </View>

        <Text className="text-xl font-semibold text-[#111827]">{classTemplate ? `${classTemplate.classType} ${classTemplate.level}` : "Aula"}</Text>
        <Text className="text-sm text-[#374151]">Professor: {teacherNames}</Text>
        <Text className="text-sm text-[#374151]">Horário: {formatHour(session.startsAt, session.endsAt)}</Text>
      </View>

      <View className="my-2 h-px bg-[#D1D5DB]" />

      <Text className="text-base font-semibold text-[#111827]">Detalhes da aula</Text>
      <Text className="text-sm leading-6 text-[#4B5563]">
        Aula de {classTemplate?.classType ?? "GI"} para nível {classTemplate?.level ?? "Beginner"} em {gymName}, {unityAddress}. Duração prevista de {classTemplate?.duration ?? "60 min"}.
      </Text>

      {role === "student" && (
        <Text className="text-sm text-[#374151]">
          {detail.currentUserAttendance === "Present" ? "Presente" :
            detail.currentUserAttendance === "Absent" ? "Ausente" :
            confirmed ? "Presença confirmada por você" : "Presença não confirmada"}
        </Text>
      )}
      {canChangeEnrollment && (
        <Pressable
          onPress={confirmed ? onCancelPresence : () => setShowConfirmModal(true)}
          disabled={submitting}
          className="mt-3 h-12 items-center justify-center rounded-xl bg-[#111827]"
        >
          <Text className="text-base font-semibold text-white">
            {confirmed ? "Cancelar presença" : "Confirmar presença"}
          </Text>
        </Pressable>
      )}
      {detail.canManageRoster && (
        <>
          <Text className="mt-2 text-base font-semibold text-[#111827]">Alunos confirmados</Text>
          {confirmedRoster.length === 0 ? (
            <Text className="text-sm text-[#6B7280]">Nenhum aluno confirmado ainda.</Text>
          ) : (
            <View className="gap-2 rounded-2xl bg-[#E5E7EB] p-4">
              {confirmedRoster.map((entry) => (
                <View key={entry.id} className="flex-row items-center justify-between">
                  <Text className="text-sm text-[#111827]">{entry.name}</Text>
                  <Text className="text-xs text-[#6B7280]">
                    {entry.attendance === "Present" ? "Presente" :
                      entry.attendance === "Absent" ? "Ausente" : "Não marcado"}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Pressable
            onPress={() => router.push(`/teacher/sessions/${session._id}`)}
            className="h-12 items-center justify-center rounded-xl bg-[#374151]"
          >
            <Text className="text-base font-semibold text-white">Gerenciar Chamada</Text>
          </Pressable>
        </>
      )}

      <Modal visible={showConfirmModal} animationType="fade" transparent onRequestClose={() => setShowConfirmModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-2xl bg-[#E5E7EB] p-5">
            <View className="items-center gap-2">
              <View className="rounded-xl bg-[#111827] px-3 py-2">
                <Text className="text-xs font-semibold text-white">{session.sessionDate}</Text>
              </View>
              <Text className="text-sm font-semibold text-[#111827]">{classTemplate ? `${classTemplate.classType} ${classTemplate.level}` : "Aula"}</Text>
              <Text className="text-xs text-[#4B5563]">Professor: {teacherNames}</Text>
            </View>

            <View className="my-4 h-px bg-[#D1D5DB]" />

            <Text className="mb-4 text-center text-base font-semibold text-[#111827]">Confirmar presença?</Text>

            <Pressable
              onPress={onConfirmPresence}
              disabled={submitting}
              className="h-11 items-center justify-center rounded-xl bg-[#111827]"
            >
              {submitting ? <Ionicons name="reload" size={18} color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Confirmar</Text>}
            </Pressable>

            <Pressable onPress={() => setShowConfirmModal(false)} className="mt-2 h-11 items-center justify-center rounded-xl">
              <Text className="text-sm font-semibold text-[#6B7280]">Voltar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
