import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { homeTitle, siteName } from "@/lib/site-metadata";

export const dynamic = "force-static";

export async function GET() {
  const screenshot = await readFile(
    join(process.cwd(), "public", "landing", "hero-dashboard.png"),
  );
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: "100%",
        padding: 64,
        gap: 42,
        background: "#0b0d10",
        color: "white",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 436 }}>
        <div style={{ color: "#d4d4d8", fontSize: 27 }}>{siteName}</div>
        <div
          style={{
            fontSize: 54,
            fontWeight: 700,
            lineHeight: 1.12,
            marginTop: 20,
          }}
        >
          A plataforma completa para gestão da sua academia de jiu-jitsu
        </div>
        <div style={{ color: "#d4d4d8", fontSize: 23, marginTop: 28 }}>
          Organize seus alunos, aulas, presenças e mensalidades em um só lugar.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          padding: 10,
          background: "#d4d4d8",
          borderRadius: 18,
        }}
      >
        {/* ImageResponse renders a static image from the local screenshot. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${screenshot.toString("base64")}`}
          width={564}
          height={283}
          alt=""
          style={{ borderRadius: 10 }}
        />
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
