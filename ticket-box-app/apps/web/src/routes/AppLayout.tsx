import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export function AppLayout() {
  const location = useLocation();
  const hideFooter =
    location.pathname.startsWith("/admin") || location.pathname.startsWith("/checker");

  return (
    <>
      <Navbar />
      <Outlet />
      {!hideFooter && <Footer />}
    </>
  );
}

