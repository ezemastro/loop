import LandingCommunityRules from "@/components/landing/LandingCommunityRules";
import LandingFaq from "@/components/landing/LandingFaq";
import LandingFinalCta from "@/components/landing/LandingFinalCta";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingForWhom from "@/components/landing/LandingForWhom";
import LandingHero from "@/components/landing/LandingHero";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import LandingLoopies from "@/components/landing/LandingLoopies";
import LandingNav from "@/components/landing/LandingNav";
import LandingWhyItMatters from "@/components/landing/LandingWhyItMatters";
import Head from "expo-router/head";
import {
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  SHARE_IMAGE_ALT,
  SHARE_IMAGE_URL,
  SITE_URL,
} from "@/components/landing/content";
import { Platform, ScrollView } from "react-native";

/**
 * Public marketing landing shown at `/` to logged-out web visitors (`(auth)/index.tsx` picks
 * this over `Landing` when `Platform.OS === "web"`). Native never renders this.
 */
export default function MarketingLanding() {
  const navigateToSection = (id: string) => {
    // Anchor scrolling, not routing: `nativeID` on the target section renders as a DOM `id` via
    // react-native-web, and this is the only platform this screen ever renders on.
    if (Platform.OS !== "web") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Head>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_AR" />
        <meta property="og:site_name" content="Loop" />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={SHARE_IMAGE_URL} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={SHARE_IMAGE_ALT} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <meta name="twitter:image" content={SHARE_IMAGE_URL} />
      </Head>
      <ScrollView
        className="flex-1 bg-white"
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        <LandingNav onNavigate={navigateToSection} />
        <LandingHero
          phoneSource={require("../../assets/landing/phone-home.webp")}
          desktopSource={require("../../assets/landing/desktop-home.webp")}
        />
        <LandingForWhom />
        <LandingHowItWorks
          stepScreenshots={{
            publicar: require("../../assets/landing/phone-publish.webp"),
            // The listing detail shows the item's value in loopies.
            recibir: require("../../assets/landing/phone-listing.webp"),
            buscar: require("../../assets/landing/phone-home.webp"),
            coordinar: require("../../assets/landing/phone-chat.webp"),
          }}
        />
        <LandingLoopies />
        <LandingWhyItMatters />
        <LandingCommunityRules />
        <LandingFaq />
        <LandingFinalCta />
        <LandingFooter />
      </ScrollView>
    </>
  );
}
