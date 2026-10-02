import { cssInterop } from "nativewind";
import Animated from "react-native-reanimated";

/**
 * `react-native-reanimated`'s `Animated.View` is not one of NativeWind's known RN primitives, so
 * a plain `className` on it is silently dropped: the component renders with none of its utility
 * classes applied, and no error. Same class of fix `Icons.tsx` already applies to `Feather`
 * (`cssInterop(Feather, {...})`) and `selectors/ProductStatusSelector.tsx` applies to `Picker`.
 * Registering it once here lets every landing section style its entrance-animation wrapper with
 * NativeWind classes directly, instead of needing a redundant plain `View` just for layout.
 */
cssInterop(Animated.View, { className: "style" });

export default Animated.View;
