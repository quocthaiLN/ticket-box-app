import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { HomePage } from "./pages/HomePage";
import { EventsPage } from "./pages/EventsPage";
import { ConcertDetailPage } from "./pages/ConcertDetailPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { MyTicketsPage } from "./pages/MyTicketsPage";
import { AuthPage, OTPVerifyPage } from "./pages/AuthPage";
import { SeatSelectionPage } from "./pages/SeatSelectionPage";
import { CheckerPage } from "./pages/CheckerPage";

// Admin
import { AdminLayout, AdminDashboard, AdminUsersPage } from "./pages/admin/AdminDashboard";
import { AdminConcertList, AdminConcertForm } from "./pages/admin/AdminConcerts";
import { AdminGuestList } from "./pages/admin/AdminGuestList";
import { AdminOrganizerRequests } from "./pages/admin/AdminOrganizerRequests";
import { AdminDeletionRequests } from "./pages/admin/AdminDeletionRequests";

// Organizer
import { OrganizerLayout, OrganizerDashboard } from "./pages/organizer/OrganizerDashboard";
import { OrganizerRequests } from "./pages/organizer/OrganizerRequests";
import { OrganizerArtistBio } from "./pages/organizer/OrganizerArtistBio";

interface AuthUser {
  fullName: string;
  role: string;
}


function AppInner({ user, onAuth, onLogout }: {
  user: AuthUser | null;
  onAuth: (u: AuthUser) => void;
  onLogout: () => void;
}) {
  const location = useLocation();
  const isChecker = user?.role === "CHECKER";
  const isCheckerRoute = location.pathname === "/checker";

  // Checker can only access /checker — redirect everything else back
  if (isChecker && !isCheckerRoute) {
    return <Navigate to="/checker" replace />;
  }

  return (
    <div className="min-h-screen" style={{ background: "#08080E", color: "#F0EDEB", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {!isCheckerRoute && <Navbar user={user} onLogout={onLogout} />}

      <Routes>
        {/* Public */}
        <Route path="/" element={<><HomePage /><Footer /></>} />
        <Route path="/events" element={<><EventsPage /><Footer /></>} />
        <Route path="/concerts/:slug" element={<><ConcertDetailPage /><Footer /></>} />
        <Route path="/concerts/:slug/seats" element={<SeatSelectionPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/my-tickets" element={<><MyTicketsPage /><Footer /></>} />

        {/* Auth */}
        <Route path="/login" element={<AuthPage mode="login" onAuth={onAuth} />} />
        <Route path="/register" element={<AuthPage mode="register" onAuth={onAuth} />} />
        <Route path="/verify-otp" element={<OTPVerifyPage onAuth={onAuth} />} />

        {/* Checker — isolated, no navbar */}
        <Route path="/checker" element={<CheckerPage />} />

        {/* ── Admin routes ───────────────────────────────────────────── */}
        <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/organizer-requests" element={<AdminLayout><AdminOrganizerRequests /></AdminLayout>} />
        <Route path="/admin/deletion-requests" element={<AdminLayout><AdminDeletionRequests /></AdminLayout>} />
        <Route path="/admin/guest-list" element={<AdminLayout><AdminGuestList /></AdminLayout>} />
        <Route path="/admin/users" element={<AdminLayout><AdminUsersPage /></AdminLayout>} />

        {/* ── Organizer routes ───────────────────────────────────────── */}
        <Route path="/organizer" element={<OrganizerLayout><OrganizerDashboard /></OrganizerLayout>} />
        <Route path="/organizer/requests" element={<OrganizerLayout><OrganizerRequests /></OrganizerLayout>} />
        <Route path="/organizer/requests/new" element={<OrganizerLayout><OrganizerRequests /></OrganizerLayout>} />
        <Route path="/organizer/concerts" element={<OrganizerLayout><AdminConcertList /></OrganizerLayout>} />
        <Route path="/organizer/concerts/:id" element={<OrganizerLayout><AdminConcertForm /></OrganizerLayout>} />
        <Route path="/organizer/artist-bio" element={<OrganizerLayout><OrganizerArtistBio /></OrganizerLayout>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { const s = sessionStorage.getItem("authUser"); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  const handleAuth = (u: AuthUser) => {
    setUser(u);
    sessionStorage.setItem("authUser", JSON.stringify(u));
  };
  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem("authUser");
  };

  return (
    <BrowserRouter>
      <AppInner user={user} onAuth={handleAuth} onLogout={handleLogout} />
    </BrowserRouter>
  );
}
