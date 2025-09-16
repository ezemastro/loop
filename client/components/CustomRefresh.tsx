import { useQueryClient } from "@tanstack/react-query";
import { RefreshControl, RefreshControlProps } from "react-native";

export default function CustomRefresh(
  props: Partial<
    React.ReactElement<
      RefreshControlProps,
      string | React.JSXElementConstructor<any>
    >
  >,
) {
  const queryClient = useQueryClient();
  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      type: "all",
    });
  };
  return <RefreshControl refreshing={false} onRefresh={onRefresh} {...props} />;
}
