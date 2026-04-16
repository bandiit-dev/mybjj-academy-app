import { useMutation } from "convex/react";

import { api } from "../../../lib/convex";

export function useUpdateProfile() {
  const updateTeacher = useMutation(api.teachers.updateTeacher);
  const updateStudent = useMutation(api.students.updateStudent);

  return {
    updateTeacher,
    updateStudent
  };
}
