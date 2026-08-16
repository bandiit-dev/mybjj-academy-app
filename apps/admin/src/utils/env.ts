export const env = {
  convexUrl: process.env["NEXT_PUBLIC_CONVEX_URL"]?.replace(/\/+$/, ""),
  clerkPublishableKey: process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
};
