import { Link } from "react-router-dom";

export function AdminHomePage() {
  return (
    <main className="shell">
      <section className="hero hero-compact">
        <p className="eyebrow">Admin</p>
        <h1>TicketBox Operations</h1>
        <p>Manage venues, concerts, seat zones, ticket types, and operational catalog data.</p>
      </section>

      <section className="dashboard-grid">
        <Link className="panel dashboard-card" to="/admin/catalog">
          <h2>Catalog</h2>
          <p>Manage concerts, venues, seat maps, and ticket types.</p>
        </Link>
        <Link className="panel dashboard-card" to="/">
          <h2>Audience Site</h2>
          <p>Open the public site to verify the buyer experience.</p>
        </Link>
      </section>
    </main>
  );
}
