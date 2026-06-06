import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listConcerts, type ConcertSummary } from "../../lib/api-client";

export function AudienceHomePage() {
  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    let mounted = true;
    setStatus("loading");

    listConcerts({ q: query, city, sort: "starts_at" })
      .then((items) => {
        if (mounted) {
          setConcerts(items);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, [query, city]);

  const cities = useMemo(() => Array.from(new Set(concerts.map((concert) => concert.venue.city))).sort(), [concerts]);

  return (
    <main className="shell">
      <section className="hero hero-compact">
        <p className="eyebrow">Audience</p>
        <h1>TicketBox Concerts</h1>
        <p>Concert public, giá vé và tình trạng mở bán được lấy trực tiếp từ Catalog API.</p>
      </section>

      <section className="toolbar">
        <label>
          <span>Tìm kiếm</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên concert hoặc nghệ sĩ" />
        </label>
        <label>
          <span>Thành phố</span>
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">Tất cả</option>
            {cities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </section>

      {status === "loading" && <p className="muted">Đang tải catalog...</p>}
      {status === "error" && <p className="error-text">Không tải được Catalog API.</p>}
      {status === "ready" && concerts.length === 0 && <p className="muted">Chưa có concert public phù hợp.</p>}

      <section className="concert-grid">
        {concerts.map((concert) => (
          <Link className="concert-card" to={`/concerts/${concert.id}`} key={concert.id}>
            <div className="concert-card__media">
              {concert.cover_image_url ? <img src={concert.cover_image_url} alt={concert.title} /> : <div className="media-fallback" />}
            </div>
            <div className="concert-card__body">
              <div className="row-between">
                <span className="badge">{concert.venue.city}</span>
                <span className="muted">{formatDate(concert.starts_at)}</span>
              </div>
              <h2>{concert.title}</h2>
              <p>{concert.artist_name}</p>
              <div className="row-between">
                <span>{concert.venue.name}</span>
                <strong>{formatPriceRange(concert)}</strong>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatPriceRange(concert: ConcertSummary) {
  if (!concert.ticket_price_range) return "Chưa mở bán";
  const formatter = new Intl.NumberFormat("vi-VN");
  return `${formatter.format(concert.ticket_price_range.min_amount)} - ${formatter.format(concert.ticket_price_range.max_amount)} VND`;
}
