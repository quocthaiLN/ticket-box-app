import { NavLink, Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          TicketBox
        </a>
        <nav>
          <NavLink to="/">Audience</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>
      <Outlet />
    </>
  );
}
