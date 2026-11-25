import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep page metadata in the initial head for crawlers and HTML validators.
  htmlLimitedBots: /.*/,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "mybjjacademy.com.br" }],
        destination: "https://www.mybjjacademy.com.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
