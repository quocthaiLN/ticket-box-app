import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { HomePage } from "./pages/HomePage";
import { EventsPage } from "./pages/EventsPage";
import { ConcertDetailPage } from "./pages/ConcertDetailPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { MyTicketsPage } from "./pages/MyTicketsPage";
import { AuthPage } from "./pages/AuthPage";
import { AdminLayout, AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminConcertList, AdminConcertForm } from "./pages/admin/AdminConcerts";
import { AdminGuestList } from "./pages/admin/AdminGuestList";
import { SeatSelectionPage } from "./pages/SeatSelectionPage";

interface AuthUser {
  fullName: string;
  role: string;
}

function AdminArtistBioPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [pdfFile, setPdfFile] = useState("");

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setResult("Nghệ sĩ là một trong những giọng ca tiêu biểu của làng nhạc Việt Nam, nổi bật với phong cách âm nhạc độc đáo và sâu sắc. Với nhiều năm hoạt động nghệ thuật, họ đã để lại dấu ấn không thể phai trong lòng người hâm mộ...");
      setLoading(false);
    }, 2500);
  };

  return (
    <div className="max-w-2xl">
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700, marginBottom: "0.5rem" }}>
        AI Artist Bio Generator
      </h1>
      <p style={{ color: "#8585A0", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        Upload file PDF/Press Kit để sinh bản giới thiệu nghệ sĩ tự động bằng AI
      </p>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="p-5 space-y-4">
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            <div className="text-3xl mb-2">📄</div>
            <p style={{ color: "#F0EDEB", fontSize: "0.875rem" }}>Kéo thả hoặc click để upload PDF/Press Kit</p>
            <p style={{ color: "#8585A0", fontSize: "0.75rem" }}>Hỗ trợ PDF, Word, TXT</p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.02]"
            style={{ background: "rgba(123,97,255,0.15)", color: "#7B61FF", border: "1px solid rgba(123,97,255,0.3)" }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#7B61FF transparent transparent transparent" }} />
                Đang xử lý AI...
              </>
            ) : "🤖 Sinh Artist Bio bằng AI"}
          </button>

          {result && (
            <div className="p-4 rounded-xl" style={{ background: "rgba(45,190,108,0.08)", border: "1px solid rgba(45,190,108,0.2)" }}>
              <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: "#2DBE6C" }}>
                ✅ Bio đã được sinh thành công
              </div>
              <p style={{ color: "#F0EDEB", fontSize: "0.875rem", lineHeight: 1.6 }}>{result}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminReportsPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700, marginBottom: "0.5rem" }}>
        Báo cáo & Thống kê
      </h1>
      <p style={{ color: "#8585A0", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Chi tiết doanh thu và vé theo từng sự kiện</p>
      <div style={{ color: "#8585A0", fontSize: "0.875rem" }}>Tính năng đang phát triển...</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const handleAuth = (u: AuthUser) => setUser(u);
  const handleLogout = () => setUser(null);

  return (
    <BrowserRouter>
      <div
        className="min-h-screen"
        style={{
          background: "#08080E",
          color: "#F0EDEB",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <Navbar user={user} onLogout={handleLogout} />

        <Routes>
          {/* Public routes */}
          <Route path="/" element={<><HomePage /><Footer /></>} />
          <Route path="/events" element={<><EventsPage /><Footer /></>} />
          <Route path="/concerts/:slug" element={<><ConcertDetailPage /><Footer /></>} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/concerts/:slug/seats" element={<SeatSelectionPage />} />
          <Route path="/my-tickets" element={<><MyTicketsPage /><Footer /></>} />

          {/* Auth routes */}
          <Route path="/login" element={<AuthPage mode="login" onAuth={handleAuth} />} />
          <Route path="/register" element={<AuthPage mode="register" onAuth={handleAuth} />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/concerts"
            element={
              <AdminLayout>
                <AdminConcertList />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/concerts/:id"
            element={
              <AdminLayout>
                <AdminConcertForm />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/guest-list"
            element={
              <AdminLayout>
                <AdminGuestList />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/artist-bio"
            element={
              <AdminLayout>
                <AdminArtistBioPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminLayout>
                <AdminReportsPage />
              </AdminLayout>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
