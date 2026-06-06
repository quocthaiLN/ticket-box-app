import { NavLink, Outlet } from "react-router-dom";

// Layout chung chứa thanh điều hướng giữa audience, checker và admin.
export function AppLayout() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          TicketBox
        </a>
        <nav>
          <NavLink to="/">Audience</NavLink>
          <NavLink to="/checker">Checker</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>
      <Outlet />
    </>
  );
}
