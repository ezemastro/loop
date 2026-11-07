import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import Head from "expo-router/head";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LEGAL_BASE_URL } from "@/config";
import {
  RELEASES,
  type Change,
  type ChangeKind,
  type ChangelogImage,
  type Comparison,
  type Release,
} from "@/content/changelog/releases";
import { FOCUS_RING } from "@/components/landing/layout";
import Text from "@/components/landing/LandingText";
import { MainView, pageContentClassName } from "@/components/bases/MainView";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const KIND_LABEL: Record<ChangeKind, string> = {
  novedad: "Novedad",
  mejora: "Mejora",
  arreglo: "Arreglo",
};

/** Side by side from this window width, stacked below it. */
const SIDE_BY_SIDE_MIN_WIDTH = 768;
/** Phone captures are portrait: cap them so they are not stretched to the column width. */
const PHONE_IMAGE_MAX_WIDTH = 280;

/** "2026-11-07" -> "7 de noviembre de 2026". Manual so it does not depend on Intl locale data. */
export function formatReleaseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day || month > 12) return isoDate;
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

/** Web serves the files from its own origin; native resolves them against the public site. */
function imageUri(path: string): string {
  return Platform.OS === "web" ? path : `${LEGAL_BASE_URL}${path}`;
}

function ImageLightbox({ image, onClose }: { image: ChangelogImage | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!image || Platform.OS !== "web") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  // Fit inside the window with room for the close control, keeping the captured proportions.
  const maxWidth = Math.max(width - 32, 120);
  const maxHeight = Math.max(height - 120, 120);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const fitted = {
    width: Math.round(image.width * scale),
    height: Math.round(image.height * scale),
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Cerrar imagen ampliada"
        onPress={onClose}
        className="flex-1 items-center justify-center gap-4 bg-black/80 p-4"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          className={`self-end rounded-full bg-white px-4 py-2 ${FOCUS_RING}`}
        >
          <Text className="text-sm font-semibold text-neutral-900">Cerrar</Text>
        </Pressable>
        <Image
          source={{ uri: imageUri(image.path) }}
          accessibilityLabel={image.alt}
          resizeMode="contain"
          style={fitted}
        />
      </Pressable>
    </Modal>
  );
}

function ComparisonImage({
  label,
  image,
  phone,
  onOpen,
}: {
  label: string;
  image: ChangelogImage;
  phone: boolean;
  onOpen: (image: ChangelogImage) => void;
}) {
  return (
    <View className="min-w-0 flex-1 gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ampliar imagen: ${image.alt}`}
        onPress={() => onOpen(image)}
        className={`w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 ${FOCUS_RING}`}
        style={{ maxWidth: phone ? PHONE_IMAGE_MAX_WIDTH : undefined }}
      >
        <Image
          source={{ uri: imageUri(image.path) }}
          accessibilityLabel={image.alt}
          alt={image.alt}
          resizeMode="cover"
          // Reserves the space before the file arrives, so nothing jumps.
          style={{ width: "100%", aspectRatio: image.width / image.height }}
        />
      </Pressable>
    </View>
  );
}

function ComparisonBlock({
  comparison,
  onOpen,
}: {
  comparison: Comparison;
  onOpen: (image: ChangelogImage) => void;
}) {
  const { width } = useWindowDimensions();
  const sideBySide = width >= SIDE_BY_SIDE_MIN_WIDTH;
  const phone = comparison.viewport === "celular";
  const items = [
    comparison.before && { label: "Antes", image: comparison.before },
    { label: "Después", image: comparison.after },
  ].filter(Boolean) as { label: string; image: ChangelogImage }[];

  return (
    <View className="gap-3">
      {comparison.caption ? (
        <Text className="text-sm text-neutral-600">{comparison.caption}</Text>
      ) : null}
      <View className={sideBySide ? "flex-row gap-6" : "gap-6"}>
        {items.map((item) => (
          <ComparisonImage
            key={item.label}
            label={item.label}
            image={item.image}
            phone={phone}
            onOpen={onOpen}
          />
        ))}
        {/* A lone image keeps the width of one column instead of stretching across both. */}
        {sideBySide && items.length === 1 ? <View className="flex-1" /> : null}
      </View>
    </View>
  );
}

function ChangeItem({
  change,
  onOpen,
}: {
  change: Change;
  onOpen: (image: ChangelogImage) => void;
}) {
  return (
    <View className="gap-4 border-t border-neutral-200 pt-8">
      <View className="flex-row items-center justify-between gap-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {KIND_LABEL[change.kind]} · {change.area}
        </Text>
        <Text className="text-xs text-neutral-400">{change.id}</Text>
      </View>
      <Text
        accessibilityRole="header"
        aria-level={3}
        className="text-xl font-semibold text-neutral-900"
      >
        {change.title}
      </Text>
      <Text className="text-base leading-7 text-neutral-700">{change.why}</Text>
      {change.comparisons.length > 0 ? (
        <View className="mt-2 gap-8">
          {change.comparisons.map((comparison, index) => (
            <ComparisonBlock key={index} comparison={comparison} onOpen={onOpen} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ReleaseSection({
  release,
  onOpen,
}: {
  release: Release;
  onOpen: (image: ChangelogImage) => void;
}) {
  return (
    <View className="gap-8">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-neutral-500">
          Versión {release.version} · {formatReleaseDate(release.date)}
        </Text>
        <Text
          accessibilityRole="header"
          aria-level={2}
          className="text-3xl font-bold text-neutral-900"
        >
          {release.title}
        </Text>
        <Text className="text-lg leading-8 text-neutral-600">{release.summary}</Text>
      </View>
      <View className="gap-8">
        {release.changes.map((change) => (
          <ChangeItem key={change.id} change={change} onOpen={onOpen} />
        ))}
      </View>
    </View>
  );
}

export default function Changelog() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<ChangelogImage | null>(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <MainView className="bg-white">
      <Head>
        {/* Deliberately unlisted: reachable only by its address, so keep it out of search. */}
        <title>Novedades - Loop</title>
        <meta name="robots" content="noindex" />
      </Head>
      <ScrollView
        contentContainerClassName={pageContentClassName(
          "editorial",
          "gap-16 px-5 pb-24 pt-12 lg:px-10 lg:pt-20",
        )}
        style={{ paddingTop: insets.top }}
      >
        <View className="gap-3">
          <Text className="text-sm font-semibold tracking-wide text-neutral-500">Loop</Text>
          <Text
            accessibilityRole="header"
            aria-level={1}
            className="text-4xl font-bold text-neutral-900"
          >
            Novedades
          </Text>
          <Text className="max-w-[640px] text-lg leading-8 text-neutral-600">
            Acá se ve cómo avanza Loop, versión por versión, con imágenes de cómo era antes y cómo
            es ahora.
          </Text>
        </View>
        {RELEASES.map((release) => (
          <ReleaseSection key={release.version} release={release} onOpen={setOpen} />
        ))}
      </ScrollView>
      <ImageLightbox image={open} onClose={close} />
    </MainView>
  );
}
