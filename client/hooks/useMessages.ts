import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { type QueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = GetMessagesByUserIdRequest["params"] &
  GetMessagesByUserIdRequest["query"];
const fetchChats = async (params: Params) => {
  try {
    const response = await api.get<GetMessagesByUserIdResponse>(
      `/messages/${params.userId}`,
      {
        params,
      },
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw {
        name: parseErrorName({ status: error.response?.status || 500 }),
        message: error.message,
      };
    }
  }
};

export const useMessages = (params: Params) => {
  return useInfiniteQuery({
    queryKey: ["messages", params.userId],
    queryFn: ({ pageParam }) => fetchChats({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      return lastPage?.pagination?.nextPage || null;
    },
    initialPageParam: 1,
    refetchInterval: 1000 * 5,
  });
};

export const addNewMessageToCache = ({
  queryClient,
  newMessage,
  userId,
}: {
  queryClient: QueryClient;
  newMessage: Message;
  userId: string;
}) => {
  queryClient.setQueryData(["messages", userId], (oldData: any) => {
    return {
      ...oldData,
      pages: oldData.pages.map((page: any, i: number) =>
        i === 0
          ? {
              ...page,
              data: {
                ...page.data,
                messages: [newMessage, ...page.data.messages],
              },
            }
          : page,
      ),
    };
  });
};

export const replaceMessageInCache = ({
  queryClient,
  newMessage,
  userId,
  targetId,
}: {
  queryClient: QueryClient;
  newMessage: Message;
  userId: string;
  targetId: string;
}) => {
  queryClient.setQueryData(["messages", userId], (oldData: any) => {
    return {
      ...oldData,
      pages: oldData.pages.map((page: any) =>
        page.data.messages.find((m: any) => m.id === targetId)
          ? {
              ...page,
              data: {
                ...page.data,
                messages: page.data.messages.map((m: any) =>
                  m.id === targetId ? newMessage : m,
                ),
              },
            }
          : page,
      ),
    };
  });
};
