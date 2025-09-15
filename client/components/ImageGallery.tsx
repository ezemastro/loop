import { COLORS } from "@/config";
import { getUrl } from "@/services/getUrl";
import { useRef } from "react";
import { View, Image, Dimensions } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, {
  ICarouselInstance,
  Pagination,
} from "react-native-reanimated-carousel";

const width = Dimensions.get("window").width;

export default function ImageGallery({ images }: { images: Media[] }) {
  const progress = useSharedValue(0);
  const ref = useRef<ICarouselInstance>(null);

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  return (
    <View className="w-full gap-4">
      <Carousel
        data={images}
        width={width}
        height={240}
        ref={ref}
        onProgressChange={progress}
        autoPlay={images.length > 1}
        autoPlayInterval={3000}
        enabled={images.length > 1}
        renderItem={({ item }) => (
          <View>
            <Image
              source={{ uri: getUrl(item.url) }}
              className="h-full w-full rounded"
              style={{ resizeMode: "contain" }}
            />
          </View>
        )}
      />
      {images.length > 1 && (
        <Pagination.Basic
          data={images}
          progress={progress}
          containerStyle={{ justifyContent: "center", gap: 8 }}
          dotStyle={{
            width: 8,
            height: 8,
            backgroundColor: COLORS.STROKE,
            borderRadius: 4,
          }}
          activeDotStyle={{
            borderRadius: 4,
            backgroundColor: COLORS.SECONDARY_TEXT,
          }}
          onPress={onPressPagination}
        />
      )}
    </View>
  );
}
