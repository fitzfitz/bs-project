import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SidebarGroupProps {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  collapsed?: boolean;
}

export function SidebarGroup({
  label,
  icon: Icon,
  children,
  isOpen,
  onToggle,
  collapsed,
}: SidebarGroupProps) {
  if (collapsed) {
    return <>{children}</>;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-slate-50 hover:text-slate-600"
        aria-expanded={isOpen}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            isOpen && "rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5 space-y-0.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
