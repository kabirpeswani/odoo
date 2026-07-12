import { StatCard, type StatCardProps } from "./StatCard";

const STATS: StatCardProps[] = [
  { label: "Available", value: 128 },
  { label: "Allocated", value: 76 },
  { label: "Available", value: 4 },
  { label: "Active Bookings", value: 9 },
  { label: "Pending Transfers", value: 3 },
  { label: "Upcoming Returns", value: 12 },
];

export function OverviewGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {STATS.map((stat, i) => (
        <StatCard key={`${stat.label}-${i}`} {...stat} />
      ))}
    </div>
  );
}