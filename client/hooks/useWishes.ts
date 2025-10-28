import { api } from "@/api/loop";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const fetchWishes = async () => {
  const response = await api.get<GetSelfWishesResponse>("/me/wishes");
  return response.data.data;
};
export const useWishes = () => {
  return useQuery({
    queryKey: ["wishes"],
    queryFn: fetchWishes,
  });
};

const fetchCreateWish = async ({
  categoryId,
  comment,
}: PostSelfWishRequest["body"]) => {
  const response = await api.post<PostSelfWishResponse>("/me/wishes", {
    categoryId,
    comment,
  });
  return response.data.data;
};
export const useCreateWish = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fetchCreateWish,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["wishes"],
      }),
  });
};
const fetchRemoveWish = async ({
  categoryId,
}: DeleteSelfWishRequest["params"]) => {
  const response = await api.delete<DeleteSelfWishResponse>(
    `/me/wishes/${categoryId}`,
  );
  return response.data;
};
export const useRemoveWish = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fetchRemoveWish,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["wishes"],
      }),
  });
};

const fetchModifyWish = async ({
  wishId,
  categoryId,
  comment,
}: PutSelfWishRequest["body"] & PutSelfWishRequest["params"]) => {
  const response = await api.put<PutSelfWishResponse>(`/me/wishes/${wishId}`, {
    comment,
    categoryId,
  });
  return response.data.data;
};
export const useModifyWish = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fetchModifyWish,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["wishes"],
      }),
  });
};
