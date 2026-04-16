import { Text } from "react-native";

import { AppTopBar } from "../../src/components/mobile/AppTopBar";
import { TeacherCard } from "../../src/components/feature/TeacherCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useTeachers } from "../../src/features/academy/hooks/useTeachers";

export default function TeachersScreen() {
  const teachers = useTeachers();

  return (
    <Screen>
      <AppTopBar title="Professores" />
      <Text className="text-xs font-bold tracking-widest text-[#6B7280]">INSTRUTORES</Text>

      {teachers === undefined ? <LoadingState label="Carregando professores..." /> : null}
      {teachers && teachers.length === 0 ? (
        <EmptyState title="Sem professores" description="Os professores aparecerão aqui quando cadastrados." />
      ) : null}

      {teachers?.map((teacher) => (
        <TeacherCard key={teacher._id} teacher={teacher} />
      ))}
    </Screen>
  );
}
