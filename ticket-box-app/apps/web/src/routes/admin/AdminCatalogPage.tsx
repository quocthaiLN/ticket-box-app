export function AdminCatalogPage() {
  return (
    <main className="shell">
      <section className="hero admin">
        <p className="eyebrow">Admin Catalog</p>
        <h1>Concert Management</h1>
        <p>Form CRUD sẽ được nối với Catalog admin API trong Sprint 2-3.</p>
      </section>

      <section className="panel">
        <h2>Route placeholders</h2>
        <ul>
          <li>Venues</li>
          <li>Concerts</li>
          <li>Seat zones</li>
          <li>Ticket types</li>
        </ul>
      </section>
    </main>
  );
}
