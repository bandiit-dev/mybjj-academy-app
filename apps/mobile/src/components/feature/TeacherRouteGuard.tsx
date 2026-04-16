import { Redirect } from "expo-router";
import { PropsWithChildren } from "react";

import { LoadingState } from "../ui/State";
import { Screen } from "../ui/Screen";
import { useCurrentProfile } from "../../features/profile/hooks/useCurrentProfile";

export function TeacherRouteGuard({ children }: PropsWithChildren) {
  const { role, isLoading } = useCurrentProfile();

  if (isLoading) {
    return (
      <Screen>
        <LoadingState label="Checking permissions..." />
      </Screen>
    );
  }

  if (role !== "teacher" && role !== "admin") {
    return <Redirect href="/(tabs)/home" />;
  }

  return children;
}
