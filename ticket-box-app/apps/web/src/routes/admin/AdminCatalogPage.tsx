import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createConcert,
  createSeatZone,
  createTicketType,
  createVenue,
  listAdminConcerts,
  listVenues,
  publishConcert,
  type ConcertSummary,
  type Venue
} from "../../lib/api-client";

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
      const [venueItems, concertItems] = await Promise.all([listVenues(), listAdminConcerts()]);
      setVenues(venueItems);
      setConcerts(concertItems);
      setSelectedConcertId((current) => current || concertItems[0]?.id || "");
      setLoadStatus("ready");
    } catch {
      setLoadStatus("error");
    }
  }

  async function handleVenueSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction(async () => {
      await createVenue({
        name: text(data, "name"),
        address: text(data, "address"),
        city: text(data, "city"),
        capacity: numberOrUndefined(data, "capacity"),
        map_url: text(data, "map_url") || undefined
      });
      event.currentTarget.reset();
    }, "Đã tạo venue.");
  }

  async function handleConcertSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction(async () => {
      await createConcert({
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
    }, "Đã tạo concert draft.");
  }

  async function handleZoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConcert) return;
    const data = new FormData(event.currentTarget);
    await runAction(async () => {
      await createSeatZone(selectedConcert.id, {
        code: text(data, "code"),
        name: text(data, "name"),
        capacity: numberOrUndefined(data, "capacity"),
        sort_order: numberOrUndefined(data, "sort_order") ?? 0,
        svg_path: text(data, "svg_path")
      });
      event.currentTarget.reset();
    }, "Đã tạo seat zone.");
  }

  async function handleTicketSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConcert) return;
    const data = new FormData(event.currentTarget);
    await runAction(async () => {
      await createTicketType(selectedConcert.id, {
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
    }, "Đã tạo ticket type draft.");
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setMessage("");
    try {
      await action();
      await reload();
      setMessage(successMessage);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Thao tác thất bại.");
    }
  }

  return (
    <main className="shell">
      <section className="hero hero-compact">
        <p className="eyebrow">Admin Catalog</p>
        <h1>Concert Management</h1>
        <p>Quản trị venue, concert, seat zone và ticket type từ Catalog API.</p>
      </section>

      {loadStatus === "loading" && <p className="muted">Đang tải dữ liệu admin...</p>}
      {loadStatus === "error" && <p className="error-text">Không tải được Catalog admin API.</p>}
      {message && <p className={message.includes("thất bại") || message.includes("errors") ? "error-text" : "success-text"}>{message}</p>}

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
                <small>{concert.status} · {concert.venue.city}</small>
              </button>
            ))}
          </div>
          {selectedConcert && (
            <button className="primary-button" type="button" onClick={() => runAction(() => publishConcert(selectedConcert.id).then(() => undefined), "Đã publish concert.")}>
              Publish
            </button>
          )}
        </aside>

        <section className="stack">
          <form className="panel form-grid" onSubmit={handleVenueSubmit}>
            <h2>Venue</h2>
            <input name="name" placeholder="Tên venue" required />
            <input name="city" placeholder="Thành phố" required />
            <input name="address" placeholder="Địa chỉ" required />
            <input name="capacity" type="number" min="1" placeholder="Sức chứa" />
            <input name="map_url" placeholder="Map URL" />
            <button className="primary-button" type="submit">Tạo venue</button>
          </form>

          <form className="panel form-grid" onSubmit={handleConcertSubmit}>
            <h2>Concert</h2>
            <select name="venue_id" required defaultValue={venues[0]?.id ?? ""}>
              <option value="" disabled>Chọn venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
            <input name="title" placeholder="Tên concert" required />
            <input name="artist_name" placeholder="Nghệ sĩ" required />
            <textarea name="description" placeholder="Mô tả" />
            <input name="starts_at" type="datetime-local" required />
            <input name="ends_at" type="datetime-local" required />
            <input name="cover_image_object_key" placeholder="concerts/demo/cover.jpg" />
            <input name="seat_map_object_key" placeholder="seat-maps/demo/map.svg" />
            <button className="primary-button" type="submit">Tạo concert</button>
          </form>

          <form className="panel form-grid" onSubmit={handleZoneSubmit}>
            <h2>Seat Zone</h2>
            <input name="code" placeholder="VIP" required />
            <input name="name" placeholder="VIP" required />
            <input name="capacity" type="number" min="1" placeholder="Sức chứa" required />
            <input name="sort_order" type="number" placeholder="Thứ tự" />
            <input name="svg_path" placeholder="SVG path" />
            <button className="primary-button" type="submit" disabled={!selectedConcert}>Tạo zone</button>
          </form>

          <form className="panel form-grid" onSubmit={handleTicketSubmit}>
            <h2>Ticket Type</h2>
            <input name="seat_zone_id" placeholder="Seat zone ID" required />
            <input name="name" placeholder="Tên vé" required />
            <input name="price" type="number" min="0" placeholder="Giá" required />
            <input name="total_quantity" type="number" min="1" placeholder="Số lượng" required />
            <input name="max_per_user" type="number" min="1" placeholder="Giới hạn/user" required />
            <input name="sale_start_at" type="datetime-local" required />
            <input name="sale_end_at" type="datetime-local" required />
            <button className="primary-button" type="submit" disabled={!selectedConcert}>Tạo ticket</button>
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
