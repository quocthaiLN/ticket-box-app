import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Eye,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  createCatalogConcert,
  createCatalogSeatZone,
  createCatalogTicketType,
  createCatalogVenue,
  getAdminCatalogData,
  publishCatalogConcert,
  type ConcertSummary,
  type Venue,
} from "../../services/admin-catalog.service";

type LoadStatus = "loading" | "ready" | "error";
type FormTab = "concert" | "venue" | "zone" | "ticket";

const statusOptions = ["all", "PUBLISHED", "DRAFT", "CANCELLED", "COMPLETED"] as const;

export function AdminCatalogPage() {
  const session = getStoredAuthSession();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [selectedConcertId, setSelectedConcertId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("all");
  const [activeForm, setActiveForm] = useState<FormTab>("concert");
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (session?.user.role === "ADMIN") void reload();
  }, [session?.user.role]);

  async function reload() {
    setLoadStatus("loading");
    try {
      const data = await getAdminCatalogData();
      setVenues(data.venues);
      setConcerts(data.concerts);
      setSelectedConcertId((current) => current || data.concerts[0]?.id || "");
      setLoadStatus("ready");
    } catch {
      setLoadStatus("error");
    }
  }

  const filteredConcerts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return concerts.filter((concert) => {
      const matchesSearch =
        !needle ||
        concert.title.toLowerCase().includes(needle) ||
        concert.artist_name.toLowerCase().includes(needle) ||
        concert.venue.city.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "all" || concert.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [concerts, search, statusFilter]);

  const selectedConcert = useMemo(
    () => concerts.find((concert) => concert.id === selectedConcertId) ?? filteredConcerts[0] ?? concerts[0],
    [concerts, filteredConcerts, selectedConcertId],
  );

  const stats = useMemo(
    () => ({
      total: concerts.length,
      published: concerts.filter((concert) => concert.status === "PUBLISHED").length,
      draft: concerts.filter((concert) => concert.status === "DRAFT").length,
      venues: venues.length,
    }),
    [concerts, venues],
  );

  if (session?.user.role !== "ADMIN") {
    return <AdminAccessState role={session?.user.role} />;
  }

  async function handleVenueSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await runAction(async () => {
      await createCatalogVenue({
        name: text(data, "name"),
        address: text(data, "address"),
        city: text(data, "city"),
        capacity: numberOrUndefined(data, "capacity"),
        map_url: text(data, "map_url") || undefined,
      });
      form.reset();
    }, "Venue created.");
  }

  async function handleConcertSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = text(data, "title");
    await runAction(async () => {
      await createCatalogConcert({
        venue_id: text(data, "venue_id"),
        title,
        slug: text(data, "slug") || slugify(title),
        description: text(data, "description"),
        artist_name: text(data, "artist_name"),
        starts_at: dateTime(data, "starts_at"),
        ends_at: dateTime(data, "ends_at"),
        cover_image_url: text(data, "cover_image_url") || undefined,
        seat_map_url: text(data, "seat_map_url") || undefined,
      });
      form.reset();
    }, "Draft concert created.");
  }

  async function handleZoneSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!selectedConcert) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    await runAction(async () => {
      await createCatalogSeatZone(selectedConcert.id, {
        code: text(data, "code"),
        name: text(data, "name"),
        description: text(data, "description") || undefined,
        capacity: numberOrUndefined(data, "capacity"),
        sort_order: numberOrUndefined(data, "sort_order") ?? 0,
        svg_path: text(data, "svg_path") || undefined,
      });
      form.reset();
    }, "Seat zone created.");
  }

  async function handleTicketSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!selectedConcert) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    await runAction(async () => {
      await createCatalogTicketType(selectedConcert.id, {
        seat_zone_id: text(data, "seat_zone_id"),
        name: text(data, "name"),
        description: text(data, "description") || undefined,
        price: {
          amount: numberOrUndefined(data, "price") ?? 0,
          currency: "VND",
        },
        total_quantity: numberOrUndefined(data, "total_quantity"),
        max_per_user: numberOrUndefined(data, "max_per_user"),
        sale_start_at: dateTime(data, "sale_start_at"),
        sale_end_at: dateTime(data, "sale_end_at"),
      });
      form.reset();
    }, "Draft ticket type created.");
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setMessage("");
    try {
      await action();
      await reload();
      setMessage(successMessage);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#08080E] px-4 pb-12 pt-24 text-[#F0EDEB] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
              <ShieldCheck className="h-4 w-4" />
              Admin catalog
            </div>
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Event Inventory Control
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">
              Website operator workspace for publishing events and configuring sale inventory.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-[#F0EDEB]"
          >
            Dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {message && (
          <div
            className="mb-5 rounded-lg border px-4 py-3 text-sm"
            style={
              message.includes("failed") || message.includes("required") || message.includes("exceed")
                ? { borderColor: "rgba(232,49,91,0.25)", background: "rgba(232,49,91,0.1)", color: "#E8315B" }
                : { borderColor: "rgba(45,190,108,0.25)", background: "rgba(45,190,108,0.1)", color: "#2DBE6C" }
            }
          >
            {message}
          </div>
        )}

        {loadStatus === "error" && (
          <div className="mb-5 rounded-lg border border-[#E8315B]/25 bg-[#E8315B]/10 px-4 py-3 text-sm text-[#E8315B]">
            Could not load Catalog admin API.
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Ticket className="h-4 w-4" />} label="Events" value={stats.total} tone="#F5C842" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Published" value={stats.published} tone="#2DBE6C" />
          <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Drafts" value={stats.draft} tone="#7B61FF" />
          <StatCard icon={<Building2 className="h-4 w-4" />} label="Venues" value={stats.venues} tone="#E8315B" />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#111118] px-3">
                <Search className="h-4 w-4 shrink-0 text-[#8585A0]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search events, artists, city..."
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]"
                  style={{ border: 0, background: "transparent" }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as (typeof statusOptions)[number])}
                className="min-h-11 rounded-lg border border-white/10 bg-[#111118] px-3 text-sm text-[#F0EDEB] outline-none sm:w-52"
                style={{ background: "#111118" }}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All statuses" : statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10 bg-[#111118]">
              <div className="grid grid-cols-[minmax(220px,1.4fr)_120px_140px_110px_96px] border-b border-white/10 px-4 py-3 text-xs font-semibold text-[#8585A0] max-lg:hidden">
                <span>Event</span>
                <span>Date</span>
                <span>Venue</span>
                <span>Status</span>
                <span></span>
              </div>

              {loadStatus === "loading" && <EmptyState text="Loading catalog..." />}
              {loadStatus === "ready" && filteredConcerts.length === 0 && <EmptyState text="No events match the current filters." />}

              <div className="divide-y divide-white/[0.06]">
                {filteredConcerts.map((concert) => (
                  <button
                    type="button"
                    key={concert.id}
                    onClick={() => setSelectedConcertId(concert.id)}
                    className={`grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] lg:grid-cols-[minmax(220px,1.4fr)_120px_140px_110px_96px] ${
                      selectedConcert?.id === concert.id ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F0EDEB]">{concert.title}</p>
                      <p className="mt-1 truncate text-xs text-[#8585A0]">{concert.artist_name}</p>
                    </div>
                    <span className="text-xs text-[#8585A0]">{formatDate(concert.starts_at)}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-[#8585A0]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#F5C842]" />
                      <span className="truncate">{concert.venue.city}</span>
                    </span>
                    <StatusBadge status={concert.status} />
                    <span className="flex items-center gap-2 lg:justify-end">
                      <Link
                        to={`/concerts/${concert.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8585A0] hover:bg-white/10 hover:text-[#F0EDEB]"
                        title="Open public event"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-[#111118] p-4">
              <p className="mb-1 text-xs uppercase text-[#8585A0]">Selected event</p>
              {selectedConcert ? (
                <>
                  <h2 className="text-base font-semibold">{selectedConcert.title}</h2>
                  <p className="mt-1 text-xs text-[#8585A0]">
                    {selectedConcert.artist_name} - {selectedConcert.venue.name}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#E8315B] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={selectedConcert.status === "PUBLISHED"}
                      onClick={() => runAction(() => publishCatalogConcert(selectedConcert.id), "Concert published.")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Publish
                    </button>
                    <Link
                      to={`/concerts/${selectedConcert.id}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#8585A0] hover:text-[#F0EDEB]"
                      title="Open public event"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#8585A0]">No event selected.</p>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-[#111118]">
              <div className="grid grid-cols-4 border-b border-white/10">
                {(["concert", "venue", "zone", "ticket"] as FormTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveForm(tab)}
                    className="px-2 py-3 text-xs font-semibold transition-colors"
                    style={{
                      color: activeForm === tab ? "#F5C842" : "#8585A0",
                      borderBottom: activeForm === tab ? "2px solid #F5C842" : "2px solid transparent",
                    }}
                  >
                    {tabLabel(tab)}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeForm === "concert" && (
                  <CatalogForm title="Create draft event" onSubmit={handleConcertSubmit}>
                    <Field name="title" label="Event name" required />
                    <Field name="slug" label="Slug" placeholder="auto-from-title" />
                    <Field name="artist_name" label="Artist" required />
                    <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
                      Venue
                      <select name="venue_id" required className={inputClass} style={inputStyle} defaultValue="">
                        <option value="" disabled>
                          Select venue
                        </option>
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>
                            {venue.name} - {venue.city}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field name="starts_at" label="Start" type="datetime-local" required />
                    <Field name="ends_at" label="End" type="datetime-local" required />
                    <Field name="cover_image_url" label="Cover URL" />
                    <Field name="seat_map_url" label="Seat map URL" />
                    <TextArea name="description" label="Description" />
                    <SubmitButton icon={<Plus className="h-4 w-4" />} label="Create event" />
                  </CatalogForm>
                )}

                {activeForm === "venue" && (
                  <CatalogForm title="Create venue" onSubmit={handleVenueSubmit}>
                    <Field name="name" label="Venue name" required />
                    <Field name="city" label="City" required />
                    <Field name="address" label="Address" required />
                    <Field name="capacity" label="Capacity" type="number" min="1" />
                    <Field name="map_url" label="Map URL" />
                    <SubmitButton icon={<Building2 className="h-4 w-4" />} label="Create venue" />
                  </CatalogForm>
                )}

                {activeForm === "zone" && (
                  <CatalogForm title="Create seat zone" onSubmit={handleZoneSubmit}>
                    <Field name="code" label="Code" placeholder="VIP" required />
                    <Field name="name" label="Name" placeholder="VIP" required />
                    <Field name="capacity" label="Capacity" type="number" min="1" required />
                    <Field name="sort_order" label="Sort order" type="number" />
                    <Field name="svg_path" label="SVG path" />
                    <TextArea name="description" label="Description" />
                    <SubmitButton icon={<Plus className="h-4 w-4" />} label="Create zone" disabled={!selectedConcert} />
                  </CatalogForm>
                )}

                {activeForm === "ticket" && (
                  <CatalogForm title="Create ticket type" onSubmit={handleTicketSubmit}>
                    <Field name="seat_zone_id" label="Seat zone ID" required />
                    <Field name="name" label="Ticket name" required />
                    <Field name="price" label="Price" type="number" min="0" required />
                    <Field name="total_quantity" label="Quantity" type="number" min="1" required />
                    <Field name="max_per_user" label="Limit per user" type="number" min="1" required />
                    <Field name="sale_start_at" label="Sale start" type="datetime-local" required />
                    <Field name="sale_end_at" label="Sale end" type="datetime-local" required />
                    <TextArea name="description" label="Description" />
                    <SubmitButton icon={<Ticket className="h-4 w-4" />} label="Create ticket" disabled={!selectedConcert} />
                  </CatalogForm>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function AdminAccessState({ role }: { role?: string }) {
  return (
    <main className="min-h-screen bg-[#08080E] px-4 pt-28 text-[#F0EDEB]">
      <section className="mx-auto max-w-xl rounded-lg border border-white/10 bg-[#111118] p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8315B]/15 text-[#E8315B]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Admin access only</h1>
        <p className="mb-5 text-sm leading-6 text-[#8585A0]">
          Current role: {role ?? "guest"}. Organizer and checker accounts use role-specific workflows.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white">
          Back to site
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function CatalogForm({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => void;
  children: React.ReactNode;
}) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <h2 className="text-sm font-semibold text-[#F0EDEB]">{title}</h2>
      {children}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        min={min}
        className={inputClass}
        style={inputStyle}
      />
    </label>
  );
}

function TextArea({ label, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
      {label}
      <textarea name={name} className={`${inputClass} min-h-20 resize-y`} style={inputStyle} />
    </label>
  );
}

function SubmitButton({
  icon,
  label,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111118] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-[#8585A0]">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${tone}18`, color: tone }}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-[#8585A0]">{text}</p>;
}

function StatusBadge({ status }: { status: ConcertSummary["status"] }) {
  const styles: Record<ConcertSummary["status"], { label: string; bg: string; color: string }> = {
    PUBLISHED: { label: "Published", bg: "rgba(45,190,108,0.12)", color: "#2DBE6C" },
    DRAFT: { label: "Draft", bg: "rgba(245,200,66,0.12)", color: "#F5C842" },
    CANCELLED: { label: "Cancelled", bg: "rgba(232,49,91,0.12)", color: "#E8315B" },
    COMPLETED: { label: "Completed", bg: "rgba(255,255,255,0.08)", color: "#8585A0" },
  };
  const style = styles[status];

  return (
    <span
      className="inline-flex w-fit items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function tabLabel(tab: FormTab) {
  const labels: Record<FormTab, string> = {
    concert: "Event",
    venue: "Venue",
    zone: "Zone",
    ticket: "Ticket",
  };
  return labels[tab];
}

function statusLabel(status: Exclude<(typeof statusOptions)[number], "all">) {
  const labels: Record<Exclude<(typeof statusOptions)[number], "all">, string> = {
    PUBLISHED: "Published",
    DRAFT: "Draft",
    CANCELLED: "Cancelled",
    COMPLETED: "Completed",
  };
  return labels[status];
}

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function numberOrUndefined(data: FormData, key: string) {
  const value = text(data, key);
  if (!value) return undefined;
  return Number(value);
}

function dateTime(data: FormData, key: string) {
  return new Date(text(data, key)).toISOString();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const inputClass =
  "min-h-11 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]";

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  borderColor: "rgba(255,255,255,0.1)",
  color: "#F0EDEB",
};
