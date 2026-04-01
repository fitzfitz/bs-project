import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  empty?: ReactNode | ((data: T) => boolean);
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode | ((error: Error) => ReactNode);
  children: (data: T) => ReactNode;
}

function DefaultLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

function DefaultError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">
        {error.message || "Something went wrong"}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-xs font-medium text-destructive underline underline-offset-2 hover:no-underline"
      >
        Try again
      </button>
    </div>
  );
}

export function QueryState<T>({
  query,
  empty,
  loadingFallback,
  errorFallback,
  children,
}: QueryStateProps<T>) {
  if (query.isLoading) {
    return <>{loadingFallback ?? <DefaultLoading />}</>;
  }

  if (query.isError) {
    const err =
      query.error instanceof Error
        ? query.error
        : new Error(String(query.error));

    if (typeof errorFallback === "function") {
      return <>{errorFallback(err)}</>;
    }
    if (errorFallback) {
      return <>{errorFallback}</>;
    }
    return <DefaultError error={err} onRetry={() => query.refetch()} />;
  }

  const data = query.data as T;

  if (typeof empty === "function") {
    if (empty(data)) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      );
    }
  } else if (empty !== undefined) {
    if (Array.isArray(data) && data.length === 0) {
      return <>{empty}</>;
    }
  }

  return <>{children(data)}</>;
}
