"use client";

import { cn } from "@/lib/utils";

export interface QuickActionsProps {
  actions?: { label: string; variant: "primary" | "secondary" }[];
}

const DEFAULT_ACTIONS: QuickActionsProps["actions"] = [
  { label: "+ Register Asset", variant: "primary" },
  { label: "Book Resource", variant: "secondary" },
  { label: "Raise Requests", variant: "secondary" },
];

export function QuickActions({ actions = DEFAULT_ACTIONS }: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row">
      {actions?.map((action) => (
        <button
          key={action.label}
          type="button"
          className={cn(
            "h-14 flex-1 rounded-[18px] text-base font-semibold text-text-primary transition-[filter,background-color] duration-200 hover:brightness-110",
            action.variant === "primary"
              ? "bg-primary-green"
              : "border border-border-base bg-bg-card"
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}