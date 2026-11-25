import type { Metadata } from "next";

export const siteName = "My BJJ Academy";
export const siteUrl = "https://www.mybjjacademy.com.br";
export const instagramUrl = "https://www.instagram.com/mybjjacademyapp/";
export const homeTitle = "Sistema para academias de jiu-jitsu";
export const homeDescription =
  "Gerencie alunos, professores, aulas, presenças e mensalidades da sua academia de jiu-jitsu. Experimente o My BJJ Academy grátis por 7 dias.";
export const publicPaths = [
  "/",
  "/politica-de-privacidade",
  "/termos-de-uso",
] as const;

const socialImage = {
  url: "/social-preview.png",
  width: 1200,
  height: 630,
  alt: "My BJJ Academy, sistema para academias de jiu-jitsu",
};

export function pageMetadata(
  path: (typeof publicPaths)[number],
  title: string,
  description: string,
): Metadata {
  const brandedTitle = `${title} | ${siteName}`;
  return {
    title: brandedTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName,
      url: path,
      title: brandedTitle,
      description,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: brandedTitle,
      description,
      images: [socialImage],
    },
  };
}
