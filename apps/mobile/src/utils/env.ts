function requireEnv(name: "EXPO_PUBLIC_CONVEX_URL" | "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  convexUrl: requireEnv("EXPO_PUBLIC_CONVEX_URL"),
  clerkPublishableKey: requireEnv("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY")
};
