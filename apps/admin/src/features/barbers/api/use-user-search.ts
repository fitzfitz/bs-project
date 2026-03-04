import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type SearchUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantRoleId: string;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useUserSearch(searchTerm: string) {
  const debouncedSearch = useDebounce(searchTerm, 300);

  return useQuery({
    queryKey: ["users", "search", debouncedSearch],
    queryFn: () =>
      api.get<ApiResponse<SearchUser[]>>(
        `/auth/users?search=${encodeURIComponent(debouncedSearch)}&excludeBarbers=true`
      ),
    enabled: debouncedSearch.length >= 2,
  });
}
