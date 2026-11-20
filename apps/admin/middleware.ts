import { parseCheckoutPlan } from "./src/utils/checkout-plan";
import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/"]);
const isLegacyAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    if (isLegacyAuthRoute(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (!isPublicRoute(request)) {
      const signIn = new URL("/", request.url);
      const plan = parseCheckoutPlan(request.nextUrl.searchParams.get("plano"));
      if (request.nextUrl.pathname === "/assinatura" && plan) {
        signIn.searchParams.set("plano", plan);
      }
      await auth.protect({ unauthenticatedUrl: signIn.toString() });
    }
  },
  { signInUrl: "/", signUpUrl: "/" },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
