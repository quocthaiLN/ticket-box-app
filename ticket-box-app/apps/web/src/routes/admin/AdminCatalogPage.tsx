import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  createCatalogConcert,
  createCatalogSeatZone,
  createCatalogTicketType,
  createCatalogVenue,
  getAdminCatalogData,
  publishCatalogConcert,
  type ConcertSummary,
  type Venue
} from "../../services/admin-catalog.service";

type LoadStatus = "loading" | "ready" | "error";

export function AdminCatalogPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [selectedConcertId, setSelectedConcertId] = useState("");
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void reload();
  }, []);

  const selectedConcert = useMemo(
    () => concerts.find((concert) => concert.id === selectedConcertId) ?? concerts[0],
    [concerts, selectedConcertId]
  );

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

  async function handleVenueSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction(async () => {
      await createCatalogVenue({
        name: text(data, "name"),
        address: text(data, "address"),
        city: text(data, "city"),
        capacity: numberOrUndefined(data, "capacity"),
        map_url: text(data, "map_url") || undefined
      });
      event.currentTarget.reset();
    }, "Venue created.");
  }

  async function handleConcertSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction(async () => {
      await createCatalogConcert({
        venue_id: text(data, "venue_id"),
        title: text(data, "title"),
        slug: slugify(text(data, "title")),
        description: text(data, "description"),
        artist_name: text(data, "artist_name"),
        starts_at: dateTime(data, "starts_at"),
        ends_at: dateTime(data, "ends_at"),
        cover_image_object_key: text(data, "cover_image_object_key"),
        seat_map_object_key: text(data, "seat_map_object_key")
      });
      event.currentTarget.reset();
    }, "Draft concert created.");
  }

  async function handleZoneSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!selectedConcert) return;
    const data = new FormData(event.currentTarget);
    await runAction(async () => {
      await createCatalogSeatZone(selectedConcert.id, {
        code: text(data, "code"),
        name: text(data, "name"),
        capacity: numberOrUndefined(data, "capacity"),
        sort_order: numberOrUndefined(data, "sort_order") ?? 0,
        svg_path: text(data, "svg_path")
      });
      event.currentTarget.reset();
    }, "Seat zone created.");
  }

  async function handleTicketSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!selectedConcert) return;
    const data = new FormData(event.currentTarget);
    await runAction(async () => {
      await createCatalogTicketType(selectedConcert.id, {
        seat_zone_id: text(data, "seat_zone_id"),
        name: text(data, "name"),
        price: {
          amount: numberOrUndefined(data, "price") ?? 0,
          currency: "VND"
        },
        total_quantity: numberOrUndefined(data, "total_quantity"),
        max_per_user: numberOrUndefined(data, "max_per_user"),
        sale_start_at: dateTime(data, "sale_start_at"),
        sale_end_at: dateTime(data, "sale_end_at")
      });
      event.currentTarget.reset();
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
    <main className="shell">
      <section className="hero hero-compact">
        <p className="eyebrow">Admin Catalog</p>
        <h1>Concert Management</h1>
        <p>Manage venues, concerts, seat zones, and ticket types from the Catalog API.</p>
      </section>

      {loadStatus === "loading" && <p className="muted">Loading admin data...</p>}
      {loadStatus === "error" && <p className="error-text">Could not load the Catalog admin API.</p>}
      {message && <p className={message.includes("failed") || message.includes("errors") ? "error-text" : "success-text"}>{message}</p>}

      <section className="admin-layout">
        <aside className="panel">
          <h2>Concerts</h2>
          <div className="stack tight">
            {concerts.map((concert) => (
              <button
                className={concert.id === selectedConcert?.id ? "list-button active" : "list-button"}
                type="button"
                key={concert.id}
                onClick={() => setSelectedConcertId(concert.id)}
              >
                <span>{concert.title}</span>
                <small>{concert.status} - {concert.venue.city}</small>
              </button>
            ))}
          </div>
          {selectedConcert && (
            <button className="primary-button" type="button" onClick={() => runAction(() => publishCatalogConcert(selectedConcert.id), "Concert published.")}>
              Publish
            </button>
          )}
        </aside>

        <section className="stack">
          <form className="panel form-grid" onSubmit={handleVenueSubmit}>
            <h2>Venue</h2>
            <input name="name" placeholder="Venue name" required />
            <input name="city" placeholder="City" required />
            <input name="address" placeholder="Address" required />
            <input name="capacity" type="number" min="1" placeholder="Capacity" />
            <input name="map_url" placeholder="Map URL" />
            <button className="primary-button" type="submit">Create venue</button>
          </form>

          <form className="panel form-grid" onSubmit={handleConcertSubmit}>
            <h2>Concert</h2>
            <select name="venue_id" required defaultValue={venues[0]?.id ?? ""}>
              <option value="" disabled>Select venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
            <input name="title" placeholder="Concert name" required />
            <input name="artist_name" placeholder="Artist" required />
            <textarea name="description" placeholder="Description" />
            <input name="starts_at" type="datetime-local" required />
            <input name="ends_at" type="datetime-local" required />
            <input name="cover_image_object_key" placeholder="concerts/demo/cover.jpg" />
            <input name="seat_map_object_key" placeholder="seat-maps/demo/map.svg" />
            <button className="primary-button" type="submit">Create concert</button>
          </form>

          <form className="panel form-grid" onSubmit={handleZoneSubmit}>
            <h2>Seat Zone</h2>
            <input name="code" placeholder="VIP" required />
            <input name="name" placeholder="VIP" required />
            <input name="capacity" type="number" min="1" placeholder="Capacity" required />
            <input name="sort_order" type="number" placeholder="Sort order" />
            <input name="svg_path" placeholder="SVG path" />
            <button className="primary-button" type="submit" disabled={!selectedConcert}>Create zone</button>
          </form>

          <form className="panel form-grid" onSubmit={handleTicketSubmit}>
            <h2>Ticket Type</h2>
            <input name="seat_zone_id" placeholder="Seat zone ID" required />
            <input name="name" placeholder="Ticket name" required />
            <input name="price" type="number" min="0" placeholder="Price" required />
            <input name="total_quantity" type="number" min="1" placeholder="Quantity" required />
            <input name="max_per_user" type="number" min="1" placeholder="Limit per user" required />
            <input name="sale_start_at" type="datetime-local" required />
            <input name="sale_end_at" type="datetime-local" required />
            <button className="primary-button" type="submit" disabled={!selectedConcert}>Create ticket</button>
          </form>
        </section>
      </section>
    </main>
  );
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
