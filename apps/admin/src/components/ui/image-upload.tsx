import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, X, Loader2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787/api";

function useUploadImage(prefix: string) {
  return useMutation({
    mutationFn: async ({
      file,
      entityId,
    }: {
      file: File;
      entityId?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      const params = new URLSearchParams({ prefix });
      if (entityId) params.set("entityId", entityId);

      const token =
        (await import("@/features/auth/store")).useSessionStore.getState()
          .accessToken ?? "";

      const res = await fetch(`${API_URL}/media/upload?${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Upload failed");
      }

      const body = await res.json();
      return body.data as { url: string; key: string };
    },
  });
}

export function ImageUpload({
  value,
  prefix,
  entityId,
  onUploaded,
  onRemove,
  className,
}: {
  value: string | null | undefined;
  prefix: string;
  entityId?: string;
  onUploaded: (url: string) => void;
  onRemove?: () => void;
  className?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImage(prefix);

  const displayUrl = preview || value;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    try {
      const result = await upload.mutateAsync({ file, entityId });
      onUploaded(result.url);
    } catch {
      setPreview(null);
    }
  };

  return (
    <div className={`relative group ${className ?? ""}`}>
      {displayUrl ? (
        <div className="relative">
          <img
            src={displayUrl}
            alt="Upload preview"
            className="h-24 w-24 rounded-xl object-cover border"
          />
          <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="p-1 rounded-full bg-white/80 hover:bg-white"
            >
              <Upload className="h-3.5 w-3.5 text-slate-700" />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  onRemove();
                }}
                className="p-1 rounded-full bg-white/80 hover:bg-white"
              >
                <X className="h-3.5 w-3.5 text-red-600" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          {upload.isPending ? (
            <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
          ) : (
            <>
              <Upload className="h-5 w-5 text-slate-400 mb-1" />
              <span className="text-[10px] text-slate-400">Upload</span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
