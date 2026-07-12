"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  "Dashboard",
  "Organization Setup",
  "Assets",
  "Allocation & Transfer",
  "Resource Booking",
  "Maintenance",
  "Audit",
  "Reports",
  "Notifications",
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

export function Sidebar() {
  const [active, setActive] = useState<NavItem>("Dashboard");

  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = item === active;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setActive(item)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-4 py-2.5 text-left text-[15px] font-medium text-text-primary transition-colors duration-200",
              isActive
                ? "border border-border-base bg-primary-green"
                : "border border-transparent hover:bg-white/5"
            )}
          >
            {item}
          </button>
        );
      })}
    </nav>
  );
}