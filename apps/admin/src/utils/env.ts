function requireEnv(name: "NEXT_PUBLIC_CONVEX_URL" | "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  convexUrl: requireEnv("NEXT_PUBLIC_CONVEX_URL"),
  clerkPublishableKey: requireEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
};
