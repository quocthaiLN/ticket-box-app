import { ArrowRight, Search, Shield, Smartphone, Star, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatedSection } from "../../components/AnimatedSection";
import { ConcertCard } from "../../components/ConcertCard";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import {
  formatDate,
  type UiConcert,
} from "../../lib/catalog-ui";
import {
  filterHomeConcerts,
  getCityFilters,
  getHomeCatalogConcerts,
} from "../../services/catalog.service";

type LoadStatus = "loading" | "ready" | "error";

export function AudienceHomePage() {
  const [concerts, setConcerts] = useState<UiConcert[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    let mounted = true;
    setStatus("loading");

    getHomeCatalogConcerts()
      .then((items) => {
        if (!mounted) return;
        setConcerts(items);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const cityFilters = useMemo(
    () => getCityFilters(concerts),
    [concerts],
  );

  const filtered = filterHomeConcerts(concerts, { searchQuery, activeFilter });

  const featured = concerts[0];

  return (
    <div className="min-h-screen bg-[#08080E]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {featured && (
        <section className="relative min-h-[92vh] overflow-hidden pt-16">
          <div className="absolute inset-0">
            <ImageWithFallback src={featured.coverImageUrl} alt={featured.title} className="h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, rgba(8,8,14,0.95) 38%, rgba(8,8,14,0.62) 70%, rgba(8,8,14,0.3) 100%), linear-gradient(to top, rgba(8,8,14,1) 0%, transparent 52%)",
              }}
            />
          </div>

          <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-center px-4 pb-16 pt-24 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full border border-[#F5C842]/30 bg-[#F5C842]/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#F5C842]">
                  Featured
                </span>
                <span className="text-xs text-[#8585A0]">{featured.genre}</span>
              </div>

              <h1
                className="mb-3 leading-tight text-[#F0EDEB]"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {featured.title}
              </h1>

              <p className="mb-2 text-lg text-[#F5C842]">{featured.artistName}</p>
              <p className="mb-6 max-w-lg text-sm leading-relaxed text-[#8585A0]">
                {featured.description}
              </p>

              <div className="mb-8 flex flex-wrap items-center gap-2">
                <InfoBadge label={formatDate(featured.startsAt)} />
                <InfoBadge label={featured.venue.name} />
                <InfoBadge label={featured.venue.city} />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={`/concerts/${featured.id}`}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#E8315B] to-[#C41E42] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#E8315B]/30 transition-transform hover:scale-105"
                >
                  View tickets now
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/events"
                  className="rounded-xl border border-white/15 bg-white/[0.07] px-6 py-3 text-sm font-medium text-[#F0EDEB] transition-colors hover:bg-white/10"
                >
                  Explore more
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-0 right-0 z-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {concerts.slice(1, 4).map((concert) => (
                  <Link
                    key={concert.id}
                    to={`/concerts/${concert.id}`}
                    className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-[#111118]/80 px-4 py-3 backdrop-blur transition-colors hover:bg-white/10"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                      <ImageWithFallback src={concert.coverImageUrl} alt={concert.title} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="line-clamp-1 text-xs font-medium text-[#F0EDEB]">{concert.title}</p>
                      <p className="text-xs text-[#8585A0]">{concert.artistName}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <AnimatedSection>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-[#111118] px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-[#8585A0]" />
              <input
                type="text"
                placeholder="Search artists, events, or venues..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="flex-1 bg-transparent text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {cityFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className="shrink-0 rounded-lg px-4 py-2 text-sm transition-all"
                style={
                  activeFilter === filter
                    ? { background: "#F5C842", color: "#0A0A0F", fontWeight: 600 }
                    : { background: "rgba(255,255,255,0.06)", color: "#8585A0", border: "1px solid rgba(255,255,255,0.07)" }
                }
              >
                {filter}
              </button>
            ))}
          </div>
        </section>
      </AnimatedSection>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="mb-6 flex items-center justify-between">
            <h2
              className="text-[#F0EDEB]"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.75rem", fontWeight: 600 }}
            >
              {activeFilter !== "All" ? `${activeFilter} events` : "Upcoming events"}
            </h2>
            <Link to="/events" className="flex items-center gap-1 text-sm text-[#8585A0] transition-colors hover:text-amber-400">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </AnimatedSection>

        {status === "loading" && <StatePanel text="Loading catalog..." />}
        {status === "error" && <StatePanel text="Could not load the Catalog API." tone="error" />}
        {status === "ready" && filtered.length === 0 && <StatePanel text="No matching events found." />}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((concert, index) => (
              <AnimatedSection key={concert.id} delay={index * 0.05}>
                <ConcertCard concert={concert} featured={index === 0 && !searchQuery} />
              </AnimatedSection>
            ))}
          </div>
        )}
      </section>

      <section className="bg-[#0D0D15] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="mb-10 text-center">
              <h2
                className="text-[#F0EDEB]"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "2rem", fontWeight: 600 }}
              >
                Why choose TicketBox?
              </h2>
              <p className="mt-2 text-sm text-[#8585A0]">A trusted ticketing platform for concerts and live events.</p>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Zap className="h-6 w-6" />, title: "Fast checkout", desc: "A clear checkout flow with payment sandbox support for demos." },
              { icon: <Shield className="h-6 w-6" />, title: "Verified tickets", desc: "Each e-ticket has its own QR code to reduce disputes and prevent fake tickets." },
              { icon: <Smartphone className="h-6 w-6" />, title: "Easy check-in", desc: "QR tickets are ready for online gate scanning and offline sync." },
              { icon: <Star className="h-6 w-6" />, title: "Centralized admin", desc: "Catalog, guest lists, and artist bios live in one operational system." },
            ].map((feature, index) => (
              <AnimatedSection key={feature.title} delay={index * 0.08}>
                <FeatureCard icon={feature.icon} title={feature.title} desc={feature.desc} />
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoBadge({ label }: { label: string }) {
  return (
    <span className="rounded-lg border border-white/10 bg-white/[0.08] px-3 py-1 text-xs text-[#F0EDEB]">
      {label}
    </span>
  );
}

function StatePanel({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111118] px-5 py-12 text-center text-sm" style={{ color: tone === "error" ? "#E8315B" : "#8585A0" }}>
      {text}
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111118] p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5C842]/10 text-[#F5C842]">
        {icon}
      </div>
      <h3 className="mb-2 text-sm font-semibold text-[#F0EDEB]">{title}</h3>
      <p className="text-xs leading-relaxed text-[#8585A0]">{desc}</p>
    </div>
  );
}
