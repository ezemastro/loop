import { COLORS } from "@/config";
import { View, Image, Dimensions } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, { Pagination } from "react-native-reanimated-carousel";

const width = Dimensions.get("window").width;

export default function ImageGallery({ images }: { images: Media[] }) {
  const progress = useSharedValue(0);
  return (
    <View className="w-full gap-4">
      <Carousel
        data={images}
        width={width}
        height={240}
        onProgressChange={progress}
        autoPlay={images.length > 1}
        autoPlayInterval={3000}
        enabled={images.length > 1}
        renderItem={({ item }) => (
          <View>
            <Image
              source={{ uri: item.url }}
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
        />
      )}
    </View>
  );
}
