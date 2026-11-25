import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useMemo, type ReactNode } from "react";
import { ClerkProvider, useAuth, useClerk } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { api } from "../lib/convex";
import { ProfileSwitcher } from "../components/feature/ProfileSwitcher";
import { env } from "../utils/env";

type AppProvidersProps = {
  children: ReactNode;
};

function AcademyAccessGate({ children }: AppProvidersProps) {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useClerk();
  const onboarding = useQuery(api.onboarding.getOnboardingStatus, isAuthenticated ? {} : "skip");

  if (isAuthenticated && onboarding === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator accessibilityLabel="Validando acesso" />
      </View>
    );
  }
  if (onboarding?.status === "ready" &&
      (onboarding.academySubscriptionInactive || onboarding.studentAccessDisabled)) {
    return (
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-xl font-semibold">
          {onboarding.studentAccessDisabled ? "Acesso desativado" : "Assinatura da academia inativa"}
        </Text>
        <Text className="text-center">Entre em contato com o responsável pela academia para regularizar o acesso.</Text>
        <ProfileSwitcher />
        <Pressable onPress={() => void signOut()} accessibilityRole="button">
          <Text className="font-semibold">Sair</Text>
        </Pressable>
      </View>
    );
  }
  return children;
}

export function AppProviders({ children }: AppProvidersProps) {
  const convex = useMemo(() => new ConvexReactClient(env.convexUrl), []);

  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <AcademyAccessGate>{children}</AcademyAccessGate>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
