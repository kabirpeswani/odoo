export interface ActivityEntry {
  id: string;
  text: string;
}

const ACTIVITY: ActivityEntry[] = [
  { id: "1", text: "Laptop AF-0114 - allocated to Priya Shah - IT dept" },
  { id: "2", text: "Room B2 - booking confirmed - 2:00 to 3:00 PM" },
  { id: "3", text: "Projector AF-0062 - maintenance resolved" },
];

export function RecentActivity() {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-2xl font-bold text-text-primary">Recent Activity</h2>
      <ul className="flex flex-col gap-3">
        {ACTIVITY.map((entry) => (
          <li
            key={entry.id}
            className="text-[15px] font-normal text-text-secondary"
          >
            {entry.text}
          </li>
        ))}
      </ul>
    </section>
  );
}