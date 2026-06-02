export function AdminHomePage() {
  return (
    <main className="shell">
      <section className="hero admin">
        <p className="eyebrow">Admin</p>
        <h1>Catalog Dashboard</h1>
        <p>Placeholder cho quản trị venue, concert, seat zone và ticket type.</p>
      </section>

      <section className="grid">
        <a className="panel" href="/admin/catalog">
          <h2>Catalog</h2>
          <p>Quản lý concert, venue, seat map và loại vé.</p>
        </a>
        <a className="panel" href="/">
          <h2>Audience Preview</h2>
          <p>Mở trang public để kiểm tra flow người mua vé.</p>
        </a>
      </section>
    </main>
  );
}
