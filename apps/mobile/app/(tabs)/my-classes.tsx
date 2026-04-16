import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { AppTopBar } from "../../src/components/mobile/AppTopBar";
import { SessionRowCard } from "../../src/components/mobile/SessionRowCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useMyUpcomingEnrollments } from "../../src/features/classes/hooks/useMyUpcomingEnrollments";

function formatHourLabel(startsAt: number) {
  return new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function MyClassesScreen() {
  const router = useRouter();
  const enrollments = useMyUpcomingEnrollments();

  return (
    <Screen>
      <AppTopBar title="Minhas Aulas" />

      {enrollments === undefined ? <LoadingState label="Carregando suas confirmações..." /> : null}

      {enrollments && enrollments.length === 0 ? (
        <EmptyState title="Sem confirmações" description="Confirme presença para ver suas próximas aulas aqui." />
      ) : null}

      <View className="gap-2">
        {enrollments?.map((item) => {
          if (!item.session) return null;

          return (
            <SessionRowCard
              key={item.enrollment._id}
              title={`Status: ${item.enrollment.status}`}
              teacherLabel={`${item.session.teacherIds.length} professor(es)`}
              timeLabel={formatHourLabel(item.session.startsAt)}
              status={item.session.status}
              onPress={() => router.push(`/classes/${item.session!._id}`)}
            />
          );
        })}
      </View>
    </Screen>
  );
}
