export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL ?? "https://your-clerk-issuer.clerk.accounts.dev",
      applicationID: "convex"
    }
  ]
};
