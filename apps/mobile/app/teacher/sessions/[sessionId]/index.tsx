import { useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { TeacherRouteGuard } from "../../../../src/components/feature/TeacherRouteGuard";
import { AppTopBar } from "../../../../src/components/mobile/AppTopBar";
import { EmptyState, LoadingState } from "../../../../src/components/ui/State";
import { Screen } from "../../../../src/components/ui/Screen";
import { useSessionDetail } from "../../../../src/features/classes/hooks/useSessionDetail";
import { useMarkAttendance } from "../../../../src/features/teacher/hooks/useMarkAttendance";
import { useSessionAttendance } from "../../../../src/features/teacher/hooks/useSessionAttendance";
import { useSessionRoster } from "../../../../src/features/teacher/hooks/useSessionRoster";
import type { Id } from "../../../../src/lib/convex";

export default function TeacherSessionAttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = sessionId as Id<"classSessions">;

  const detail = useSessionDetail(id);
  const roster = useSessionRoster(id);
  const attendance = useSessionAttendance(id);
  const markAttendance = useMarkAttendance();

  if (detail === undefined || roster === undefined || attendance === undefined) {
    return (
      <TeacherRouteGuard>
        <Screen>
          <LoadingState label="Carregando chamada..." />
        </Screen>
      </TeacherRouteGuard>
    );
  }

  if (!detail) {
    return (
      <TeacherRouteGuard>
        <Screen>
          <EmptyState title="Sessão não encontrada" description="A sessão pode ter sido removida." />
        </Screen>
      </TeacherRouteGuard>
    );
  }

  const attendanceByStudent = new Map(attendance.map((item) => [item.attendance.studentId, item.attendance.status]));

  return (
    <TeacherRouteGuard>
      <Screen>
        <AppTopBar title="Gestão de Presença" />
        <Text className="text-sm text-[#4B5563]">{detail.session.sessionDate}</Text>

        {roster.length === 0 ? (
          <EmptyState title="Sem alunos confirmados" description="Os alunos precisam confirmar presença primeiro." />
        ) : (
          roster.map((entry) => (
            <View key={entry.enrollment._id} className="gap-3 rounded-2xl bg-[#E5E7EB] p-4">
              <Text className="text-base font-semibold text-[#111827]">{entry.student?.name ?? "Aluno"}</Text>
              <Text className="text-sm text-[#4B5563]">Status confirmação: {entry.enrollment.status}</Text>
              <Text className="text-sm text-[#4B5563]">
                Presença: {attendanceByStudent.get(entry.enrollment.studentId) ?? "Não marcada"}
              </Text>

              <View className="flex-row gap-2">
                <Pressable
                  onPress={() =>
                    markAttendance({
                      classSessionId: id,
                      studentId: entry.enrollment.studentId,
                      status: "Present"
                    })
                  }
                  className="h-11 flex-1 items-center justify-center rounded-xl bg-[#111827]"
                >
                  <Text className="font-semibold text-white">Presente</Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    markAttendance({
                      classSessionId: id,
                      studentId: entry.enrollment.studentId,
                      status: "Absent"
                    })
                  }
                  className="h-11 flex-1 items-center justify-center rounded-xl border border-[#D1D5DB] bg-white"
                >
                  <Text className="font-semibold text-[#374151]">Ausente</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Screen>
    </TeacherRouteGuard>
  );
}
