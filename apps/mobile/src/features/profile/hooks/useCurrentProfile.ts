import { useQuery } from "convex/react";

import { api } from "../../../lib/convex";

export function useCurrentProfile() {
  const teacher = useQuery(api.teachers.getCurrentTeacher);
  const student = useQuery(api.students.getCurrentStudent);

  const isLoading = teacher === undefined || student === undefined;

  const role = teacher
    ? teacher.userType === "Admin"
      ? "admin"
      : "teacher"
    : student
      ? student.userType === "Admin"
        ? "admin"
        : "student"
      : "unknown";

  return {
    teacher,
    student,
    role,
    isLoading
  };
}
