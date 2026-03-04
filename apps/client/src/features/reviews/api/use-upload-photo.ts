import { useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

type UploadResult = { url: string; key: string };

export function useUploadPhoto() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      return api.post<ApiResponse<UploadResult>>(
        "/media/upload?prefix=reviews",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
    },
  });
}
