import { useState } from "react";
import { useSearchParams } from "react-router";
import { Search, Filter, MapPin, SlidersHorizontal } from "lucide-react";
import { ConcertCard } from "../components/ConcertCard";
import { CONCERTS } from "../data/mockData";

export function EventsPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [search, setSearch] = useState(initialSearch);
  const [city, setCity] = useState("all");
  const [genre, setGenre] = useState("all");
  const [status, setStatus] = useState("all");

  const cities = ["all", "Hồ Chí Minh", "Hà Nội"];
  const genres = ["all", "Indie/R&B", "Pop/Ballad", "Classical/Acoustic", "Pop/Electronic", "Nhạc Vàng"];

  const filtered = CONCERTS.filter((c) => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.artistName.toLowerCase().includes(search.toLowerCase());
    const matchCity = city === "all" || c.venue.city === city;
    const matchGenre = genre === "all" || c.genre.toLowerCase().includes(genre.toLowerCase().split("/")[0].toLowerCase());
    const matchStatus = status === "all" || c.status === status;
    return matchSearch && matchCity && matchGenre && matchStatus;
  });

  return (
    <div style={{ background: "#08080E", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: "4.5rem" }}>
      {/* Header */}
      <div
        className="py-12 px-4"
        style={{ background: "linear-gradient(to bottom, rgba(17,17,24,1), rgba(8,8,14,1))", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="max-w-7xl mx-auto">
          <h1
            className="mb-2"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", color: "#F0EDEB", fontWeight: 700 }}
          >
            Khám phá sự kiện
          </h1>
          <p className="text-sm mb-6" style={{ color: "#8585A0" }}>
            {CONCERTS.filter((c) => c.status === "PUBLISHED").length} sự kiện đang diễn ra và sắp tới
          </p>

          {/* Search bar */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl max-w-2xl"
            style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <Search className="w-5 h-5 flex-shrink-0" style={{ color: "#8585A0" }} />
            <input
              type="text"
              placeholder="Tìm kiếm tên sự kiện, nghệ sĩ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none flex-1 text-sm"
              style={{ color: "#F0EDEB" }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar filters */}
          <aside className="lg:w-56 flex-shrink-0">
            <div
              className="rounded-2xl overflow-hidden sticky top-20"
              style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" style={{ color: "#F5C842" }} />
                  <span className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Bộ lọc</span>
                </div>
              </div>
              <div className="p-4 space-y-5">
                {/* City */}
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#8585A0" }}>
                    <MapPin className="w-3 h-3" />
                    Thành phố
                  </p>
                  <div className="space-y-1">
                    {cities.map((c) => (
                      <FilterButton key={c} label={c === "all" ? "Tất cả" : c} active={city === c} onClick={() => setCity(c)} />
                    ))}
                  </div>
                </div>

                {/* Genre */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#8585A0" }}>Thể loại</p>
                  <div className="space-y-1">
                    <FilterButton label="Tất cả" active={genre === "all"} onClick={() => setGenre("all")} />
                    {genres.slice(1).map((g) => (
                      <FilterButton key={g} label={g} active={genre === g} onClick={() => setGenre(g)} />
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#8585A0" }}>Trạng thái</p>
                  <div className="space-y-1">
                    <FilterButton label="Tất cả" active={status === "all"} onClick={() => setStatus("all")} />
                    <FilterButton label="Đang mở bán" active={status === "PUBLISHED"} onClick={() => setStatus("PUBLISHED")} />
                    <FilterButton label="Sắp mở bán" active={status === "DRAFT"} onClick={() => setStatus("DRAFT")} />
                  </div>
                </div>

                {/* Reset */}
                {(city !== "all" || genre !== "all" || status !== "all" || search) && (
                  <button
                    onClick={() => { setCity("all"); setGenre("all"); setStatus("all"); setSearch(""); }}
                    className="w-full text-xs py-2 rounded-lg transition-colors hover:bg-white/5"
                    style={{ color: "#E8315B" }}
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* Results grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: "#8585A0" }}>
                {filtered.length} kết quả{search ? ` cho "${search}"` : ""}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Search className="w-10 h-10 mx-auto mb-3" style={{ color: "#8585A0" }} />
                <p className="text-sm" style={{ color: "#8585A0" }}>Không tìm thấy sự kiện phù hợp</p>
                <button
                  onClick={() => { setCity("all"); setGenre("all"); setStatus("all"); setSearch(""); }}
                  className="mt-3 text-xs"
                  style={{ color: "#F5C842" }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((concert) => (
                  <ConcertCard key={concert.id} concert={concert} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all"
      style={{
        background: active ? "rgba(245,200,66,0.1)" : "transparent",
        color: active ? "#F5C842" : "#8585A0",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}
