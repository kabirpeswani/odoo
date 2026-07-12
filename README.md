# AssetFlow — Enterprise Asset & Resource Management

An Odoo 17 module that tracks physical assets through their whole life: registration,
allocation, transfer, shared-resource booking, maintenance, physical audit, reporting and
an immutable activity trail.

Standalone by design — it depends only on `base`. No accounting, purchase, invoicing or
even `mail` dependency.

---

## Quick start

Docker Desktop is the only prerequisite. No local Python, Odoo or Postgres needed.

```bash
git clone https://github.com/kabirpeswani/odoo.git
cd odoo
docker compose up
```

First run pulls the images and builds the database (a few minutes). When the log says
`Modules loaded.`, open:

**http://localhost:8069** → log in as **`admin`** / **`admin`**

`docker compose up` creates the database and installs the module on the first run, and
just starts the server every run after that. There is no separate install step.

### Demo logins

The stack loads demo data, so every screen has real content on first boot.

| Login | Password | Role |
| --- | --- | --- |
| `admin` | `admin` | Administrator — sees everything |
| `rohan` | `rohan` | Asset Manager — approves maintenance, runs audits |
| `aditi` | `aditi` | Department Head — approves her department's transfers |
| `priya` | `priya` | Employee — holds `AF-0114`, books rooms |
| `varma` | `varma` | Technician — assigned to the forklift repair |

### Everyday commands

```bash
docker compose up          # start (Ctrl+C stops)
docker compose up -d       # start in background
docker compose logs -f     # follow logs
docker compose down        # stop, keep the database
docker compose down -v     # stop and wipe the database
```

### After changing code

Python is loaded at startup; XML (views, security, data) only at module upgrade.

```bash
# Python only
docker compose restart odoo

# Changed a view, security rule or data file
docker compose run --rm odoo odoo \
  --addons-path=/usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons \
  -d assetflow --db_host=db --db_user=odoo --db_password=odoo \
  -u assetflow --stop-after-init
docker compose restart odoo
```

> **Don't bookmark URLs containing `#action=<number>`.** Action IDs are assigned per
> database and change on reinstall; a stale one makes the web client fail to render and
> the navbar look empty. Navigate from the menus.

---

## The ten screens

| # | Screen | Where |
| --- | --- | --- |
| 1 | Login / Signup | Odoo's login page |
| 2 | Dashboard | **Dashboard** |
| 3 | Organization Setup | **Configuration → Organization Setup** (admin only) |
| 4 | Asset Registry | **Operations → Assets** |
| 5 | Allocation & Transfer | **Operations → Allocations & Transfers** |
| 6 | Resource Booking | **Operations → Resource Bookings** |
| 7 | Maintenance | **Operations → Maintenance** |
| 8 | Audit | **Audits → Audit Cycles** |
| 9 | Reports & Analytics | **Reports** |
| 10 | Notifications | **Notifications** |

**1 · Login / Signup.** Signup lands strictly on the Employee role: `base.group_user`
implies `group_assetflow_employee`, so every internal user is an AssetFlow Employee with
nothing to assign. Elevation above Employee is guarded — only an AssetFlow Administrator
can grant an AssetFlow role, and the check is narrow enough that a plain Odoo Settings
admin can still manage every *other* group.

**2 · Dashboard.** Six KPI cards (Available, Allocated, Under Maintenance, Active
Bookings, Pending Transfers, Upcoming Returns), a red overdue banner that appears only
when something is genuinely overdue, three quick actions, and a live activity feed.

**3 · Organization Setup.** Departments / Categories / Employees as tabs. Departments and
categories are created inline. The Employees tab is where an admin raises somebody above
Employee. Editing a department here drives the picklists on screens 5 and 6.

**4 · Asset Registry.** Auto-generated tags (`AF-0001`), searchable by tag, serial number
or QR code, filterable by category, status and department.

**5 · Allocation & Transfer.** An asset can only have one active holder. Allocating one
that is already held does not dead-end: it raises a `RedirectWarning` that drops you into
a pre-filled **Transfer Request** explaining who holds it. Approving the transfer closes
the previous holder's allocation automatically.

**6 · Resource Booking.** Calendar for shared resources with strict overlap prevention.
Back-to-back bookings (10–11 then 11–12) are legal — the check uses half-open intervals,
which is what a room calendar should do.

**7 · Maintenance.** Kanban across `Pending → Approved → Technician Assigned → In
Progress → Resolved`. Approving takes the asset off the floor; resolving returns it **to
its holder**, not to Available — it remembers the pre-maintenance state rather than
silently freeing an allocated asset. `Rejected` stays reachable but is not a board column:
it is a dead end, not a stage work flows through.

**8 · Audit.** A cycle cannot close while any line is unchecked. Closing pushes the paper
findings onto the physical records: **missing → asset marked Lost**, **damaged → condition
set and a high-priority maintenance request opened automatically**.

**9 · Reports & Analytics.** Utilization by department (bar), maintenance frequency over
six months (line), most-used / due-for-service / idle asset lists, and a CSV export of the
whole register. Charts are rendered server-side as SVG — no JS charting dependency, so
they cannot silently fail to load.

**10 · Notifications.** All / Alerts / Approvals / Bookings tabs with relative timestamps
("2m ago"). Entries file themselves into the right tab.

---

## Roles

`Employee ⊂ Department Head ⊂ Asset Manager ⊂ Administrator` — each implies the one below.

- **Employee** — sees the catalogue, requests allocations, books resources, raises issues,
  audits when assigned.
- **Department Head** — approves allocations and transfers inside the department they run.
- **Asset Manager** — registers and allocates assets, approves maintenance, runs audits,
  reads the whole activity trail.
- **Administrator** — organization setup and user roles.

Portal and public users hold no AssetFlow role and cannot be given one.

---

## The activity trail

`mail` is not a dependency, so there is no chatter. Every model that matters instead
inherits `assetflow.log.mixin` and writes an entry on each meaningful transition.

- **Global trail:** Audits → Activity Log.
- **Per record:** the **History** tab on any asset, allocation, booking, maintenance
  request or audit cycle.

An asset's history reads as its whole life: *registered → allocated to Alice → handed over
to Bob → into maintenance → back to Bob.*

**Entries are append-only.** Nobody holds write or unlink on `assetflow.log` — not
managers, not an AssetFlow administrator. A log you can edit proves nothing.

Employees see asset-lifecycle entries plus their own actions; managers and admins see
everything. A flat log table cannot inherit a record's permissions the way chatter did
(`res_model`/`res_id` are not resolvable inside a domain), so visibility is granted
explicitly by record rule.

---

## Architecture

```
assetflow/
├── models/
│   ├── asset.py                # registry + lifecycle state machine
│   ├── asset_allocation.py     # allocation & transfer, conflict detection
│   ├── resource_booking.py     # bookings + overlap constraint
│   ├── asset_maintenance.py    # requests, technician logs, stage automation
│   ├── asset_audit.py          # audit cycles, reconciliation on close
│   ├── asset_category.py       # category policy (warranty, lifetime)
│   ├── res_company_ext.py      # departments + employee directory / roles
│   ├── assetflow_log.py        # the audit trail
│   └── assetflow_screens.py    # dashboard, org setup, reports
├── views/                      # menus, all view types, screen views, log views
├── security/                   # groups, access rights, record rules
├── data/                       # sequences, crons, demo data
└── hooks.py                    # post-install backfill
```

Every lifecycle transition funnels through `asset._set_state()`, so the trail always
explains *why* an asset changed hands. Conflict detection lives in two layers: a hard
`@api.constrains` that no import or RPC can bypass, and a user-facing `RedirectWarning`
that offers the way out instead of a dead end.

---

## Notes for maintainers

Behaviours that are deliberate and easy to "fix" by mistake:

- **`days_overdue` is not stored.** It derives from `today()`, which moves on its own; a
  stored value would freeze on the day the allocation went overdue.
- **`assetflow.log.mixin` exposes `activity_log_ids`, not `log_ids`.**
  `assetflow.maintenance` already owns a `log_ids` (its technician work logs) and a
  same-named mixin field is silently shadowed by it.
- **The audit cycle's discrepancy rollup is written with `sudo()`.** Auditors are usually
  plain employees with read-only access to cycles; the rollup is derived from the cycle's
  own lines, and record rules still gate which cycles they can see.
- **`security/ir.model.access.csv` must contain no comment lines.** Odoo's CSV importer
  has no comment syntax and reads a `#` line as a data row with too few columns, killing
  the loader with `IndexError`.
- **Organization Setup is a regular model, not a TransientModel,** and its tabs are
  One2many. On a Many2many, "Add a line" opens a *picker* for records that do not exist
  yet — which reads as broken. One2many creates inline, and that needs a real record to
  point at.
- **The Dashboard and Reports fill their fields from `default_get`, not a compute.** They
  open as new transient records, and a non-stored compute with no `@api.depends` is never
  evaluated on a new record — the page would render a wall of zeroes.

## Known limitation

Booking overlap is enforced by a constraint that re-reads the table. That is correct in
normal use but is not a concurrency guarantee: under PostgreSQL's `REPEATABLE READ`
isolation, a booking being inserted by another open transaction is invisible to it, so two
simultaneous requests for the same slot could in principle both succeed. Closing that
properly needs a Postgres exclusion constraint over
`(asset_id, tsrange(start_time, end_time))`.
