import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConcertCard } from "../../components/ConcertCard";
import type { UiConcert } from "../../lib/catalog-ui";
import { getCityFilters, getEventsCatalog } from "../../services/catalog.service";

type LoadStatus = "loading" | "ready" | "error";

export function EventsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [city, setCity] = useState("all");
  const [concerts, setConcerts] = useState<UiConcert[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>(["all"]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let mounted = true;

    getEventsCatalog()
      .then((items) => {
        if (mounted) setCityOptions(getCityFilters(items, "all"));
      })
      .catch(() => {
        if (mounted) setCityOptions(["all"]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStatus("loading");
      getEventsCatalog({ search, city })
        .then((items) => {
          setConcerts(items);
          setStatus("ready");
        })
        .catch(() => setStatus("error"));
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [search, city]);

  return (
    <div className="min-h-screen bg-[#08080E] pt-16" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <header className="border-b border-white/10 px-4 py-12" style={{ background: "linear-gradient(to bottom, #111118, #08080E)" }}>
        <div className="mx-auto max-w-7xl">
          <h1
            className="mb-2 text-[#F0EDEB]"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700 }}
          >
            Khám phá sự kiện
          </h1>
          <p className="mb-6 text-sm text-[#8585A0]">
            {status === "ready" ? `${concerts.length} sự kiện phù hợp` : "Danh mục công khai từ TicketBox API"}
          </p>

          <div
            className="flex max-w-2xl items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <Search className="h-5 w-5 shrink-0 text-[#8585A0]" />
            <input
              type="text"
              placeholder="Tìm tên sự kiện hoặc nghệ sĩ..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#8585A0]"
              style={{
                width: "100%",
                border: 0,
                background: "transparent",
                color: "#F0EDEB",
                padding: 0,
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="shrink-0 lg:w-56">
            <div className="sticky top-20 overflow-hidden rounded-2xl border border-white/10 bg-[#111118]">
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[#F5C842]" />
                  <span className="text-sm font-semibold text-[#F0EDEB]">Bộ lọc</span>
                </div>
              </div>
              <div className="space-y-5 p-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#8585A0]">
                    <MapPin className="h-3 w-3" />
                    Thành phố
                  </p>
                  <div className="space-y-1">
                    {cityOptions.map((item) => (
                      <FilterButton
                        key={item}
                        label={item === "all" ? "Tất cả" : item}
                        active={city === item}
                        onClick={() => setCity(item)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-[#8585A0]">
                {status === "loading" ? "Đang tải..." : `${concerts.length} kết quả${search ? ` cho "${search}"` : ""}`}
              </p>
            </div>

            {status === "error" && <StatePanel text="Không thể tải dữ liệu sự kiện." tone="error" />}
            {status === "ready" && concerts.length === 0 && <StatePanel text="Không tìm thấy sự kiện phù hợp." />}
            {status === "loading" && <StatePanel text="Đang tải danh mục sự kiện..." />}

            {status === "ready" && concerts.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {concerts.map((concert) => (
                  <ConcertCard key={concert.id} concert={concert} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-all"
      style={{
        background: active ? "rgba(245,200,66,0.14)" : "transparent",
        border: active ? "1px solid rgba(245,200,66,0.32)" : "1px solid transparent",
        color: active ? "#F5C842" : "#8585A0",
        fontWeight: active ? 600 : 400,
      }}
      type="button"
    >
      {label}
    </button>
  );
}

function StatePanel({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111118] px-5 py-16 text-center text-sm" style={{ color: tone === "error" ? "#E8315B" : "#8585A0" }}>
      {text}
    </div>
  );
}
