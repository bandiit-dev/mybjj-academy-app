import type { AuthConfig } from "convex/server";

const clerkIssuer = process.env.CLERK_ISSUER_URL ?? "https://your-clerk-issuer.clerk.accounts.dev";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: clerkIssuer,
      jwks: `${clerkIssuer}/.well-known/jwks.json`,
      algorithm: "RS256"
    }
  ]
} satisfies AuthConfig;
