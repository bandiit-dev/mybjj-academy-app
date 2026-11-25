import { auth } from "@clerk/nextjs/server";
import { env } from "@/utils/env";

const headers = {
  "Cache-Control": "private, no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

function convexSiteUrl() {
  if (process.env.CONVEX_SITE_URL) return process.env.CONVEX_SITE_URL;
  if (!env.convexUrl) return null;
  const url = new URL(env.convexUrl);
  if (url.hostname.endsWith(".convex.cloud")) {
    url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
  } else if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.port) {
    url.port = String(Number(url.port) + 1);
  } else {
    return null;
  }
  return url;
}

export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { getToken, userId } = await auth();
  if (!userId) return new Response(null, { status: 401, headers });

  const { studentId } = await params;
  const siteUrl = convexSiteUrl();
  if (!siteUrl) return new Response(null, { status: 503, headers });

  const url = new URL("/student-photo", siteUrl);
  url.searchParams.set("studentId", studentId);
  try {
    const token = await getToken({ template: "convex" });
    if (!token) return new Response(null, { status: 401, headers });
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const status = [401, 404].includes(response.status) ? response.status : 502;
      return new Response(null, { status, headers });
    }
    const type = response.headers.get("Content-Type");
    if (type !== "image/jpeg" && type !== "image/png") {
      return new Response(null, { status: 502, headers });
    }
    return new Response(response.body, { headers: { ...headers, "Content-Type": type } });
  } catch {
    return new Response(null, { status: 502, headers });
  }
}
