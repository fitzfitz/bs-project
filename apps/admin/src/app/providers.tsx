import { type ReactNode, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { useOverlayScrollbars } from "overlayscrollbars-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";

function ScrollbarInit() {
  const [initialize] = useOverlayScrollbars({
    options: {
      scrollbars: {
        autoHide: "scroll",
        autoHideDelay: 800,
        theme: "os-theme-dark",
      },
    },
  });

  useEffect(() => {
    initialize(document.body);
  }, [initialize]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <ScrollbarInit />
          {children}
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
