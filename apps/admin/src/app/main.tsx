import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n/config";
import Providers from "@/app/providers";
import App from "@/app/app";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>
);
