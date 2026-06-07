import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getConcert,
  getConcertMetadata,
  getInventory,
  listTicketTypes,
  type ConcertDetail,
  type ConcertMetadata,
  type Inventory,
  type TicketType
} from "../../lib/api-client";

type OrderPreview = {
  id: string;
  status: "HELD";
  ticket_type_id: string;
  quantity: number;
  total_amount: number;
};

export function ConcertDetailPage() {
  const { concertId } = useParams();
  const [concert, setConcert] = useState<ConcertDetail | null>(null);
  const [metadata, setMetadata] = useState<ConcertMetadata | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [order, setOrder] = useState<OrderPreview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!concertId) return;
    let mounted = true;
    setStatus("loading");

    Promise.all([
      getConcert(concertId),
      getConcertMetadata(concertId),
      listTicketTypes(concertId, true),
      getInventory(concertId)
    ])
      .then(([concertData, metadataData, ticketTypeData, inventoryData]) => {
        if (!mounted) return;
        setConcert(concertData);
        setMetadata(metadataData);
        setTicketTypes(ticketTypeData);
        setInventory(inventoryData);
        setSelectedTicketTypeId(ticketTypeData.find((item) => item.status === "ON_SALE")?.id ?? ticketTypeData[0]?.id ?? "");
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, [concertId]);

  const selectedTicketType = useMemo(
    () => ticketTypes.find((ticketType) => ticketType.id === selectedTicketTypeId),
    [selectedTicketTypeId, ticketTypes]
  );
  const selectedInventory = inventory?.items.find((item) => item.ticket_type_id === selectedTicketTypeId);

  function holdPreview() {
    if (!selectedTicketType) return;
    setOrder({
      id: `demo_order_${Date.now()}`,
      status: "HELD",
      ticket_type_id: selectedTicketType.id,
      quantity,
      total_amount: selectedTicketType.price.amount * quantity
    });
  }

  if (status === "loading") {
    return (
      <main className="shell">
        <p className="muted">Đang tải chi tiết concert...</p>
      </main>
    );
  }

  if (status === "error" || !concert) {
    return (
      <main className="shell">
        <p className="error-text">Không tải được chi tiết concert.</p>
      </main>
    );
  }

  return (
    <main>
      <section className="detail-hero">
        {concert.cover_image_url && <img src={concert.cover_image_url} alt={concert.title} />}
        <div className="detail-hero__content">
          <p className="eyebrow">{concert.venue.city}</p>
          <h1>{concert.title}</h1>
          <p>{concert.artist_name}</p>
          <p>{formatDate(concert.starts_at)} · {concert.venue.name}</p>
        </div>
      </section>

      <div className="shell detail-layout">
        <section className="stack">
          <article className="panel">
            <h2>Thông tin</h2>
            <p>{concert.description ?? "Concert đang được cập nhật thông tin."}</p>
            {metadata?.artist_bio && <p>{metadata.artist_bio}</p>}
          </article>

          <article className="panel">
            <h2>Sơ đồ khu vực</h2>
            <div className="zone-grid">
              {metadata?.seat_zones.map((zone) => (
                <div className="zone-tile" key={zone.id}>
                  <strong>{zone.code}</strong>
                  <span>{zone.name}</span>
                  <small>{zone.capacity.toLocaleString("vi-VN")} chỗ</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="panel checkout-panel">
          <h2>Chọn vé</h2>
          <div className="ticket-list">
            {ticketTypes.map((ticketType) => {
              const item = inventory?.items.find((entry) => entry.ticket_type_id === ticketType.id);
              return (
                <label className="ticket-option" key={ticketType.id}>
                  <input
                    type="radio"
                    name="ticket_type"
                    value={ticketType.id}
                    checked={selectedTicketTypeId === ticketType.id}
                    onChange={() => setSelectedTicketTypeId(ticketType.id)}
                  />
                  <span>
                    <strong>{ticketType.name}</strong>
                    <small>{ticketType.zone_code} · {formatMoney(ticketType.price.amount)}</small>
                  </span>
                  <em>{item ? item.display_status : ticketType.status}</em>
                </label>
              );
            })}
          </div>

          <label className="field">
            <span>Số lượng</span>
            <input
              type="number"
              min="1"
              max={selectedTicketType?.max_per_user ?? 1}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
            />
          </label>

          <div className="summary-line">
            <span>Còn lại</span>
            <strong>{selectedInventory ? selectedInventory.available_quantity.toLocaleString("vi-VN") : "-"}</strong>
          </div>
          <div className="summary-line">
            <span>Tạm tính</span>
            <strong>{selectedTicketType ? formatMoney(selectedTicketType.price.amount * quantity) : "-"}</strong>
          </div>

          <button className="primary-button" type="button" disabled={!selectedTicketType} onClick={holdPreview}>
            Giữ vé
          </button>

          {order && (
            <div className="order-status">
              <span>{order.status}</span>
              <strong>{order.id}</strong>
              <small>{order.quantity} vé · {formatMoney(order.total_amount)}</small>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}
