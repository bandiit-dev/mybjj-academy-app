import { Text } from "react-native";

import { AppTopBar } from "../../src/components/mobile/AppTopBar";
import { UnityCard } from "../../src/components/feature/UnityCard";
import { EmptyState, LoadingState } from "../../src/components/ui/State";
import { Screen } from "../../src/components/ui/Screen";
import { useUnities } from "../../src/features/academy/hooks/useUnities";

export default function UnitiesScreen() {
  const unities = useUnities();

  return (
    <Screen>
      <AppTopBar title="Unidades" />
      <Text className="text-xs font-bold tracking-widest text-[#6B7280]">LOCALIZAÇÕES</Text>

      {unities === undefined ? <LoadingState label="Carregando unidades..." /> : null}
      {unities && unities.length === 0 ? (
        <EmptyState title="Sem unidades" description="As unidades aparecerão aqui quando configuradas." />
      ) : null}

      {unities?.map((unity) => (
        <UnityCard key={unity._id} unity={unity} />
      ))}
    </Screen>
  );
}
