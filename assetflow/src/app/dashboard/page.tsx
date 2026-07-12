import { AppShell } from "@/components/layout/AppShell";
import { OverviewGrid } from "@/components/dashboard/OverviewGrid";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-text-primary">Today&apos;s Overview</h1>

        <OverviewGrid />

        <AlertBanner message="3 assets overdue for return - flagged for follow-up" />

        <QuickActions />

        <RecentActivity />
      </div>
    </AppShell>
  );
}