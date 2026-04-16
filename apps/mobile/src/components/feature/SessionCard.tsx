import { Pressable, Text, View } from "react-native";

import type { Doc } from "../../lib/convex";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

type Props = {
  session: Doc<"classSessions">;
  onPress: () => void;
};

export function SessionCard({ session, onPress }: Props) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">{session.sessionDate}</Text>
            <Badge text={session.status} />
          </View>
          <Text className="text-sm text-mutedForeground">
            {new Date(session.startsAt).toLocaleTimeString()} - {new Date(session.endsAt).toLocaleTimeString()}
          </Text>
          <View className="flex-row gap-2">
            <Badge text={`${session.teacherIds.length} teacher(s)`} />
            <Badge text={`${session.gymIds.length} gym(s)`} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
