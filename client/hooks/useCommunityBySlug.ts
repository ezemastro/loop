import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchCommunityBySlug = async (slug: string) => {
  try {
    const response = await api.get<GetCommunityBySlugResponse>(`/communities/${slug}`);
    return response.data.data!.community;
  } catch (err) {
    throw parseApiError(err);
  }
};

/**
 * Resolves a community by its public slug — used by the anonymous `/terminos?c=<slug>` route to
 * render the right community name (design D4). Public endpoint, no auth required.
 *
 * An unknown or missing slug is not treated as an error the UI needs to react to: the caller
 * falls back to the neutral label (spec `terms-acceptance`, "Unknown slug does not break the
 * page"), so `retry` is off and the caller reads `isError`/`data` rather than throwing.
 */
export const useCommunityBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["communities", "bySlug", slug ?? null],
    queryFn: () => fetchCommunityBySlug(slug!),
    enabled: !!slug,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};
