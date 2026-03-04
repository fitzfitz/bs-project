import { useMutation } from "@tanstack/react-query";

/** Favorite branch feature removed from API — no-op mutation for backward compatibility */
export function useSetFavoriteBranch() {
  return useMutation({
    mutationFn: async (_branchId: string | null) => {
      // API no longer supports favorite branch — no-op
    },
  });
}
