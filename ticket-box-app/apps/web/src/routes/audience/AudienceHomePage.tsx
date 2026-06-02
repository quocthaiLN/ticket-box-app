import { useEffect, useState } from "react";
import { listConcerts, type ConcertSummary } from "../../lib/api-client";

export function AudienceHomePage() {
  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;

    listConcerts()
      .then((items) => {
        if (mounted) {
          setConcerts(items);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (mounted) {
          setStatus("error");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Audience</p>
        <h1>TicketBox Concerts</h1>
        <p>Xem danh sách concert public và chuẩn bị luồng chọn vé ở Sprint 3.</p>
      </section>

      <section className="panel">
        <h2>Concerts</h2>
        {status === "loading" && <p className="muted">Đang tải catalog...</p>}
        {status === "error" && <p className="muted">Catalog API chưa sẵn sàng hoặc chưa chạy.</p>}
        {status === "ready" && concerts.length === 0 && (
          <p className="muted">Catalog API đang ở trạng thái scaffold, chưa có dữ liệu public.</p>
        )}
        {concerts.length > 0 && (
          <ul>
            {concerts.map((concert) => (
              <li key={concert.id}>{concert.title}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
