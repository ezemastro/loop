import { useThemeColors } from "@/hooks/useThemeColors";
import { getUrl } from "@/services/getUrl";
import { useRef, useState } from "react";
import { View, Image } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, { ICarouselInstance, Pagination } from "react-native-reanimated-carousel";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { GALLERY_HEIGHT } from "@/config";

export default function ImageGallery({ images }: { images: Media[] }) {
  const progress = useSharedValue(0);
  const ref = useRef<ICarouselInstance>(null);
  // Seeded at 0 (not a module-scope `Dimensions.get("window").width` read, which never updates on
  // resize) — `onLayout` below is the sole, reactive width source; the carousel renders only once
  // it reports a real width.
  const [containerWidth, setContainerWidth] = useState(0);
  const colors = useThemeColors();
  const breakpoint = useBreakpoint();
  const galleryHeight = GALLERY_HEIGHT[breakpoint];

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  return (
    <View
      className="w-full gap-4"
      onLayout={({ nativeEvent }) => {
        const nextWidth = nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== containerWidth) {
          setContainerWidth(nextWidth);
        }
      }}
    >
      {containerWidth > 0 && (
        <Carousel
          data={images}
          width={containerWidth}
          height={galleryHeight}
          ref={ref}
          onProgressChange={progress}
          autoPlay={images.length > 1}
          autoPlayInterval={3000}
          enabled={images.length > 1}
          renderItem={({ item }) => (
            <View>
              <Image
                source={{ uri: getUrl(item.url) }}
                className="rounded"
                style={{ width: "100%", height: galleryHeight }}
                resizeMode="contain"
              />
            </View>
          )}
        />
      )}
      {images.length > 1 && (
        <Pagination.Basic
          data={images}
          progress={progress}
          containerStyle={{ justifyContent: "center", gap: 8 }}
          dotStyle={{
            width: 8,
            height: 8,
            backgroundColor: colors.STROKE,
            borderRadius: 4,
          }}
          activeDotStyle={{
            borderRadius: 4,
            backgroundColor: colors.SECONDARY_TEXT,
          }}
          onPress={onPressPagination}
        />
      )}
    </View>
  );
}
