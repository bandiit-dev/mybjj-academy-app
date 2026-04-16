import { Text } from "react-native";

import { UnityCard } from "../../src/components/feature/UnityCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useUnities } from "../../src/features/academy/hooks/useUnities";

export default function UnitiesScreen() {
  const unities = useUnities();

  return (
    <Screen>
      <Text className="text-2xl font-bold text-foreground">Unities</Text>
      {unities === undefined ? <LoadingState label="Loading unities..." /> : null}
      {unities && unities.length === 0 ? (
        <EmptyState title="No unities" description="Locations will appear here once configured." />
      ) : null}
      {unities?.map((unity) => (
        <UnityCard key={unity._id} unity={unity} />
      ))}
    </Screen>
  );
}
