import { AdminSummaryCard } from "@/components/admin-summary-card";

export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32 }}>MyBJJAcademy Admin</h1>
      <p style={{ color: "#4b5563" }}>Base Next.js admin portal scaffold connected to Convex and Clerk.</p>
      <section style={{ marginTop: 24 }}>
        <AdminSummaryCard />
      </section>
    </main>
  );
}
