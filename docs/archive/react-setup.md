# 🏗️ Enterprise Frontend Architecture Blueprint

**Version:** 2.0  
**Stack:**

- **React 19** (latest) + **React Router v6** (latest)
- **Vite v7** (latest) + **rolldown**
- **TypeScript**
- **Tailwind v4** (latest without tailwind.config)
- **TanStack Query** (latest)
- **Zustand** (latest)
- **React Hook Form** (latest) + **@hookform/resolvers/zod** (for all forms)
- **Zod** (for all FE types and validation)
- **Shadcn/ui** (`npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=maia&baseColor=gray&theme=gray&iconLibrary=hugeicons&font=inter&menuAccent=subtle&menuColor=default&radius=default&template=vite" --template vite`)

---

## 📂 1. Directory Structure

We follow a **Feature-Based Architecture** with strict layer separation.

```text
src/
├── app/                        # BOOTSTRAP LAYER
│   ├── index.css               # Tailwind imports, theme variables, OverlayScrollbars CSS, base resets
│   ├── main.tsx                # Entry point — renders <Providers><App /></Providers>
│   ├── providers.tsx           # All providers (QueryClient, BrowserRouter, ScrollbarInit, etc.)
│   └── app.tsx                 # Route table (Routes/Route tree)
│
├── components/                 # SHARED UI LAYER (Dumb)
│   ├── ui/                     # Shadcn Primitives (button.tsx, input.tsx)
│   ├── common/                 # Smart Wrappers (form-select.tsx, data-table.tsx)
│   └── layout/                 # Layout Shells (sidebar.tsx, header.tsx)
│
├── config/                     # CONFIGURATION LAYER
│   ├── env.ts                  # Zod-validated Environment Variables
│   ├── endpoints.ts            # API URL Registry (Strings only)
│   └── constants.ts            # Global Constants (Regex, Date Formats)
│
├── features/                   # DOMAIN LAYER (Vertical Slices)
│   ├── auth/                   # Authentication Logic
│   ├── shared-lookup/          # Master Data (Persisted to LocalStorage)
│   └── [feature-name]/         # e.g. "cash-flow"
│       ├── api/                # Query Hooks (use-cash-flow.ts)
│       ├── components/         # Pure UI Components (transaction-row.tsx)
│       ├── widgets/            # Connected Components (cash-flow-chart.tsx)
│       ├── mocks/              # MSW Handlers (handlers.ts)
│       ├── types/              # Zod Schemas & TS Interfaces
│       ├── store/              # Zustand Store (use-ui-store.ts)
│       └── index.ts            # Public Barrier (Exports only Widgets/Hooks)
│
├── lib/                        # INFRASTRUCTURE LAYER
│   ├── axios.ts                # Axios Instance + Interceptors
│   ├── query-client.ts         # QueryClient + Persistence Config
│   └── utils.ts                # Tailwind Class Merger (cn)
│
├── pages/                      # COMPOSITION LAYER
│   ├── dashboard/              # Route: /dashboard
│   │   └── page.tsx            # Assembles Widgets from Features
│   └── auth/
│       └── login-page.tsx
│
├── routes/                     # ROUTING LAYER
│   ├── _guards/                # Route Protection (protected-route.tsx)
│   └── index.tsx               # Router Definition (Lazy Loading)
│
├── stores/                     # CLIENT STATE LAYER
│   └── use-ui-store.ts         # Global Session/UI State (Zustand)
│
└── test/                       # TEST CONFIGURATION
    └── setup.ts                # Vitest Setup & Global Mocks
```

---

## ⚙️ 2. Core Configuration Files

### `tsconfig.app.json`

Enforces path aliases (@/) and strict typing.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

### `vite.config.ts`

Configures Build, Test, and Aliases.

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### `eslint.config.js`

Enforces kebab-case filenames and strict imports.