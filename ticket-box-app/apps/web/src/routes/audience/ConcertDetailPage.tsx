import { useParams } from "react-router-dom";

export function ConcertDetailPage() {
  const { concertId } = useParams();

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Concert Detail</p>
        <h1>{concertId}</h1>
        <p>Placeholder cho metadata, seat map, ticket types và inventory public.</p>
      </section>
    </main>
  );
}
