import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { TeacherRouteGuard } from "../../../../src/components/feature/TeacherRouteGuard";
import { PrimaryButton, SecondaryButton } from "../../../../src/components/ui/Buttons";
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
          <LoadingState label="Loading attendance..." />
        </Screen>
      </TeacherRouteGuard>
    );
  }

  if (!detail) {
    return (
      <TeacherRouteGuard>
        <Screen>
          <EmptyState title="Session not found" description="The session may have been removed." />
        </Screen>
      </TeacherRouteGuard>
    );
  }

  const attendanceByStudent = new Map(attendance.map((item) => [item.attendance.studentId, item.attendance.status]));

  return (
    <TeacherRouteGuard>
      <Screen>
        <Text className="text-2xl font-bold text-foreground">Attendance Management</Text>
        <Text className="text-sm text-mutedForeground">{detail.session.sessionDate}</Text>

        {roster.length === 0 ? (
          <EmptyState title="No enrolled students" description="Students need confirmed enrollment first." />
        ) : (
          roster.map((entry) => (
            <View key={entry.enrollment._id} className="gap-2 rounded-lg border border-border bg-card p-4">
              <Text className="text-base font-semibold text-foreground">{entry.student?.name ?? "Student"}</Text>
              <Text className="text-sm text-mutedForeground">Enrollment: {entry.enrollment.status}</Text>
              <Text className="text-sm text-mutedForeground">
                Attendance: {attendanceByStudent.get(entry.enrollment.studentId) ?? "Not marked"}
              </Text>
              <View className="flex-row gap-2">
                <PrimaryButton
                  label="Present"
                  onPress={() =>
                    markAttendance({
                      classSessionId: id,
                      studentId: entry.enrollment.studentId,
                      status: "Present"
                    })
                  }
                />
                <SecondaryButton
                  label="Absent"
                  onPress={() =>
                    markAttendance({
                      classSessionId: id,
                      studentId: entry.enrollment.studentId,
                      status: "Absent"
                    })
                  }
                />
              </View>
            </View>
          ))
        )}
      </Screen>
    </TeacherRouteGuard>
  );
}
