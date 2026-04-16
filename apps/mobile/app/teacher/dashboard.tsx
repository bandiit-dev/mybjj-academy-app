import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { TeacherRouteGuard } from "../../src/components/feature/TeacherRouteGuard";
import { AppTopBar } from "../../src/components/mobile/AppTopBar";
import { SessionRowCard } from "../../src/components/mobile/SessionRowCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useTeacherUpcomingSessions } from "../../src/features/teacher/hooks/useTeacherUpcomingSessions";

function formatHourLabel(startsAt: number) {
  return new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function TeacherDashboardScreen() {
  const router = useRouter();
  const sessions = useTeacherUpcomingSessions(30);

  return (
    <TeacherRouteGuard>
      <Screen>
        <AppTopBar title="Painel do Professor" />

        <Text className="text-xs font-bold tracking-widest text-[#6B7280]">HOJE E PRÓXIMAS</Text>

        {sessions === undefined ? <LoadingState label="Carregando suas aulas..." /> : null}
        {sessions && sessions.length === 0 ? (
          <EmptyState title="Sem sessões" description="Nenhuma aula futura encontrada para você." />
        ) : null}

        <View className="gap-2">
          {sessions?.map((session) => (
            <SessionRowCard
              key={session._id}
              title="Aula para chamada"
              teacherLabel="Abrir chamada"
              timeLabel={formatHourLabel(session.startsAt)}
              status={session.status}
              onPress={() => router.push(`/teacher/sessions/${session._id}`)}
            />
          ))}
        </View>
      </Screen>
    </TeacherRouteGuard>
  );
}
