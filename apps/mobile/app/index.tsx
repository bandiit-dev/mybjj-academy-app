import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from "react-native";

import { useUpcomingSessions } from "../src/features/classes/hooks/useUpcomingSessions";

export default function HomeScreen() {
  const upcomingSessions = useUpcomingSessions(10);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>MyBJJAcademy Mobile</Text>
        <Text style={{ color: "#4b5563" }}>Base Expo app connected to Convex.</Text>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>Upcoming Sessions</Text>
          {upcomingSessions === undefined ? (
            <ActivityIndicator style={{ marginTop: 12 }} />
          ) : upcomingSessions.length === 0 ? (
            <Text style={{ marginTop: 8 }}>No upcoming sessions.</Text>
          ) : (
            upcomingSessions.map((session) => (
              <View
                key={session._id}
                style={{
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 8,
                  padding: 12
                }}
              >
                <Text style={{ fontWeight: "600" }}>{session.sessionDate}</Text>
                <Text>
                  {new Date(session.startsAt).toLocaleTimeString()} - {new Date(session.endsAt).toLocaleTimeString()}
                </Text>
                <Text>Status: {session.status}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
