import {
  homeDescription,
  homeTitle,
  instagramUrl,
  pageMetadata,
  siteName,
  siteUrl,
} from "@/lib/site-metadata";
import { HomePage } from "@/screens/home";

export const metadata = pageMetadata("/", homeTitle, homeDescription);

export default function Page() {
  const businessId = `${siteUrl}/#organization`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteName,
        url: `${siteUrl}/`,
        inLanguage: "pt-BR",
        publisher: { "@id": businessId },
      },
      {
        "@type": "Organization",
        "@id": businessId,
        name: siteName,
        url: `${siteUrl}/`,
        logo: `${siteUrl}/landing/d98b8.png`,
        sameAs: [instagramUrl],
      },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <HomePage />
    </>
  );
}
