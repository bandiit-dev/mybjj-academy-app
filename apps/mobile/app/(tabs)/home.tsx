import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { AppTopBar } from "../../src/components/mobile/AppTopBar";
import { DateChip } from "../../src/components/mobile/DateChip";
import { SessionRowCard } from "../../src/components/mobile/SessionRowCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useUpcomingSessions } from "../../src/features/classes/hooks/useUpcomingSessions";

function formatDateChipLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  const day = parsed.toLocaleDateString("pt-BR", { day: "2-digit" });
  const weekDay = parsed
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "")
    .slice(0, 3);

  return `${day} ${weekDay}`;
}

function formatHourLabel(startsAt: number) {
  return new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function HomeScreen() {
  const router = useRouter();
  const sessions = useUpcomingSessions(30);

  const dateOptions = useMemo(() => {
    const values = new Set<string>();

    sessions?.forEach((item) => {
      values.add(item.sessionDate);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate = selectedDate ?? dateOptions[0] ?? null;

  const filteredSessions = useMemo(() => {
    if (!sessions || !activeDate) return sessions ?? [];
    return sessions.filter((item) => item.sessionDate === activeDate);
  }, [sessions, activeDate]);

  const openSessions = filteredSessions.filter((session) => session.status === "Scheduled");
  const closedSessions = filteredSessions.filter((session) => session.status !== "Scheduled");

  return (
    <Screen>
      <AppTopBar />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        <View className="flex-row gap-2">
          {dateOptions.length > 0 ? (
            dateOptions.map((date) => (
              <DateChip
                key={date}
                label={formatDateChipLabel(date)}
                selected={activeDate === date}
                onPress={() => setSelectedDate(date)}
              />
            ))
          ) : (
            <DateChip label="Sem datas" selected />
          )}
        </View>
      </ScrollView>

      {sessions === undefined ? <LoadingState label="Carregando agenda..." /> : null}

      {sessions && sessions.length === 0 ? (
        <EmptyState title="Sem aulas agendadas" description="As próximas sessões vão aparecer aqui." />
      ) : null}

      {openSessions.length > 0 ? <Text className="mt-1 text-xs font-bold tracking-widest text-[#4B5563]">AGENDA ABERTA</Text> : null}
      <View className="gap-2">
        {openSessions.map((session) => (
          <SessionRowCard
            key={session._id}
            title="Aula agendada"
            teacherLabel={`${session.teacherIds.length} professor(es)`}
            timeLabel={formatHourLabel(session.startsAt)}
            status={session.status}
            onPress={() => router.push(`/classes/${session._id}`)}
          />
        ))}
      </View>

      {closedSessions.length > 0 ? <Text className="mt-2 text-xs font-bold tracking-widest text-[#6B7280]">AGENDA FECHADA</Text> : null}
      <View className="gap-2">
        {closedSessions.map((session) => (
          <SessionRowCard
            key={session._id}
            title="Aula finalizada"
            teacherLabel={`${session.teacherIds.length} professor(es)`}
            timeLabel={formatHourLabel(session.startsAt)}
            status={session.status}
            onPress={() => router.push(`/classes/${session._id}`)}
          />
        ))}
      </View>
    </Screen>
  );
}
