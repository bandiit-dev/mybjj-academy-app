import { useQuery } from "convex/react";
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  const gyms = useQuery("gyms:getAllGyms" as any);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>MyBJJAcademy Mobile</Text>
        <Text style={{ color: "#4b5563" }}>Base Expo app connected to Convex.</Text>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>Gyms (Convex query example)</Text>
          {gyms === undefined ? (
            <ActivityIndicator style={{ marginTop: 12 }} />
          ) : gyms.length === 0 ? (
            <Text style={{ marginTop: 8 }}>No gyms yet.</Text>
          ) : (
            gyms.map((gym: any) => (
              <View
                key={gym._id}
                style={{
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 8,
                  padding: 12
                }}
              >
                <Text style={{ fontWeight: "600" }}>{gym.name}</Text>
                <Text>{gym.email}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
