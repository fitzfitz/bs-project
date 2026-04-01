import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";
import { AlertTriangle, Info, X } from "lucide-react";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
}

const variantConfig: Record<
  ConfirmVariant,
  {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    confirmVariant: ButtonProps["variant"];
    confirmClass: string;
  }
> = {
  danger: {
    icon: AlertTriangle,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    confirmVariant: "destructive",
    confirmClass: "",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    confirmVariant: "default",
    confirmClass: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  info: {
    icon: Info,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    confirmVariant: "default",
    confirmClass: "",
  },
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
}: ConfirmationDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={() => !loading && onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-xl animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-200">
        {/* Close button */}
        <button
          type="button"
          disabled={loading}
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pb-5 text-center">
          {/* Icon */}
          <div
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4",
              config.iconBg,
            )}
          >
            <Icon className={cn("w-7 h-7", config.iconColor)} />
          </div>

          {/* Content */}
          <h3 className="text-lg font-bold text-slate-900 leading-snug">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-slate-500 mt-2 leading-relaxed whitespace-pre-line">
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl font-semibold"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={config.confirmVariant}
            className={cn("flex-1 h-11 rounded-xl font-semibold", config.confirmClass)}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Please wait...
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Hook for imperative usage ----

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmationContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmationContext = React.createContext<ConfirmationContextValue | null>(
  null,
);

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirmation() {
  const ctx = React.useContext(ConfirmationContext);
  if (!ctx) {
    throw new Error("useConfirmation must be used within <ConfirmationProvider>");
  }
  return ctx;
}

export function ConfirmationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleClose = React.useCallback(
    (open: boolean) => {
      if (!open && state) {
        state.resolve(false);
        setState(null);
      }
    },
    [state],
  );

  const handleConfirm = React.useCallback(() => {
    if (state) {
      state.resolve(true);
      setState(null);
    }
  }, [state]);

  const value = React.useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      <ConfirmationDialog
        open={!!state}
        onOpenChange={handleClose}
        title={state?.options.title ?? ""}
        description={state?.options.description}
        confirmLabel={state?.options.confirmLabel}
        cancelLabel={state?.options.cancelLabel}
        variant={state?.options.variant}
        onConfirm={handleConfirm}
      />
    </ConfirmationContext.Provider>
  );
}
