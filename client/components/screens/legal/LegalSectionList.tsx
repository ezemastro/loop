import { FlatList, Text } from "react-native";
import Head from "expo-router/head";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainView, pageContentClassName } from "../../bases/MainView";
import TextTitle from "../../bases/TextTitle";
import type { LegalSection } from "@/content/legal/types";

/**
 * Shared renderer for the legal documents (privacy policy, terms) — both the public,
 * unauthenticated routes and (indirectly, via the same `LegalSection[]` shape) the in-app terms
 * screen keep one rendering path so the visual treatment of a `REVISIÓN LEGAL PENDIENTE` banner
 * paragraph never drifts between surfaces.
 */
export default function LegalSectionList({
  title,
  sections,
}: {
  title: string;
  sections: LegalSection[];
}) {
  const insets = useSafeAreaInsets();
  const contentClassName = pageContentClassName("narrow", "py-4 px-4 gap-1");

  return (
    <MainView>
      {/*
        `expo export --platform web` prerenders through `react-helmet-async` (`expo-router/head`
        wraps it), so this `<title>` is baked into the raw HTML at build time, not only set after
        hydration — exactly what spec `public-legal-pages` ("Raw HTML carries the page's own
        title") needs. Confirmed against a real `expo export` output, not assumed: without this,
        every route's `<title>` came out empty (`<title data-rh="true"></title>`).
      */}
      <Head>
        <title>{title} - Loop</title>
      </Head>
      <FlatList
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        data={sections}
        contentContainerClassName={contentClassName}
        // In-body counterpart of the `<Head><title>` above: the raw HTML must carry the
        // "principal headings" too (same spec scenario), not just the `<title>` tag.
        ListHeaderComponent={<TextTitle className="mb-4 text-3xl">{title}</TextTitle>}
        renderItem={({ item }) => (
          <>
            {item.type === "subtitle" && (
              <TextTitle className="mb-2 mt-3 text-left">{item.content}</TextTitle>
            )}
            {item.type === "paragraph" && (
              <Text className="mb-2 text-main-text text-lg leading-6">{item.content}</Text>
            )}
            {item.type === "list-item" && (
              <Text className="mb-3 text-main-text text-lg leading-6">• {item.content}</Text>
            )}
            {item.type === "title" && null /* the page title already renders in the header */}
          </>
        )}
      />
    </MainView>
  );
}
