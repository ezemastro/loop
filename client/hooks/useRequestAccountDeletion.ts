import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchRequestAccountDeletion = async (body: PostSelfDeleteRequest["body"]) => {
  try {
    await api.post<PostSelfDeleteRequestResponse>("/me/delete-request", body);
  } catch (err) {
    throw parseApiError(err);
  }
};

/**
 * Public, unauthenticated deletion request (`/borrar-cuenta`, spec `public-legal-pages`). Always
 * succeeds from the caller's point of view — the endpoint answers 204 whether or not the account
 * exists, by design (anti-enumeration) — so a thrown error here means a genuine failure
 * (validation, network), never "account not found".
 */
export const useRequestAccountDeletion = () => {
  return useMutation({
    mutationFn: fetchRequestAccountDeletion,
  });
};
