import { Text } from "react-native";

import { TeacherCard } from "../../src/components/feature/TeacherCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useTeachers } from "../../src/features/academy/hooks/useTeachers";

export default function TeachersScreen() {
  const teachers = useTeachers();

  return (
    <Screen>
      <Text className="text-2xl font-bold text-foreground">Teachers</Text>
      {teachers === undefined ? <LoadingState label="Loading teachers..." /> : null}
      {teachers && teachers.length === 0 ? (
        <EmptyState title="No teachers" description="Teachers will appear here once registered." />
      ) : null}
      {teachers?.map((teacher) => (
        <TeacherCard key={teacher._id} teacher={teacher} />
      ))}
    </Screen>
  );
}
