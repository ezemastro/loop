import { api } from "@/api/loop";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const fetchWishes = async () => {
  const response = await api.get<GetSelfWishesResponse>("/me/whishes");
  return response.data.data;
};

export const useWishes = () => {
  return useQuery({
    queryKey: ["wishes"],
    queryFn: fetchWishes,
  });
};

const addWish = async ({ categoryId }: PostSelfWishRequest["body"]) => {
  const response = await api.post<PostSelfWishResponse>("/me/wishes", {
    categoryId,
  });
  return response.data.data;
};
export const useAddWish = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addWish,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["wishes"],
      }),
  });
};
const removeWish = async ({ categoryId }: { categoryId: number }) => {
  const response = await api.delete<DeleteSelfWishResponse>(
    `/me/wishes/${categoryId}`,
  );
  return response.data;
};
export const useRemoveWish = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeWish,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["wishes"],
      }),
  });
};

const modifyWishComment = async ({
  wishId,
  comment,
}: PutSelfWishRequest["body"] & PutSelfWishRequest["params"]) => {
  const response = await api.patch<PutSelfWishResponse>(
    `/me/wishes/${wishId}`,
    { comment },
  );
  return response.data.data;
};
export const useModifyWishComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: modifyWishComment,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["wishes"],
      }),
  });
};
