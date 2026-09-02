import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchAcceptTerms = async (body: PostSelfTermsAcceptanceRequest["body"]) => {
  try {
    await api.post<PostSelfTermsAcceptanceResponse>("/me/terms-acceptance", body);
  } catch (err) {
    throw parseApiError(err);
  }
};

/**
 * `POST /me/terms-acceptance` (design D5). The caller is responsible for the offline-safe
 * fallback (spec `terms-acceptance`, "Acceptance Failure Must Not Lock Users Out") — this hook
 * only wraps the request; `Terms.tsx` decides what to do when it rejects.
 */
export const useAcceptTerms = () => {
  return useMutation({
    mutationFn: fetchAcceptTerms,
  });
};
