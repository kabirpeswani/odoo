"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-page p-6">
      <div className="flex min-h-[calc(100vh-48px)] flex-col overflow-hidden rounded-[32px] border border-border-base bg-bg-container">
        <Header />

        <div className="h-px w-full bg-border-base" />

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="hidden w-[272px] shrink-0 flex-col gap-1 p-5 md:flex">
            <Sidebar />
          </aside>

          {/* Mobile toggle bar */}
          <div className="flex items-center justify-between px-5 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border-base bg-bg-card px-3 py-2 text-sm font-medium text-text-primary"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
              Menu
            </button>
          </div>

          {/* Vertical divider (desktop) */}
          <div className="hidden w-px self-stretch bg-border-base md:block" />

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/60 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-[280px] max-w-[80vw] border-r border-border-base bg-bg-container p-5 transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xl font-bold text-text-primary">AssetFlow</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="rounded-lg p-2 text-text-secondary hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Sidebar />
        </aside>
      </div>
    </div>
  );
}