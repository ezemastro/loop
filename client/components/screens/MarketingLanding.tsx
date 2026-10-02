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
        <title>Loop · Intercambio circular de útiles escolares | Red Itínere</title>
        <meta
          name="description"
          content="Loop es la plataforma de intercambio circular de útiles escolares de la comunidad de Red Itínere. Publicá lo que ya no usás, ganá loopies y conseguí lo que tu familia necesita."
        />
      </Head>
      <ScrollView
        className="flex-1 bg-white"
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        <LandingNav onNavigate={navigateToSection} />
        <LandingHero phoneSource={require("../../assets/landing/phone-home.webp")} />
        <LandingForWhom />
        <LandingHowItWorks
          stepScreenshots={{
            buscar: require("../../assets/landing/phone-listing.webp"),
          }}
          desktopSource={require("../../assets/landing/desktop-home.webp")}
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
