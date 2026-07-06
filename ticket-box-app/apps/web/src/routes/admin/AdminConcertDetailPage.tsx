import {
  Calendar,
  Eye,
  FileText,
  Info,
  Loader2,
  MapPin,
  Music,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  apiGet,
  cancelConcert,
  listAdminConcerts,
  publishConcert,
  type ApiResponse,
  type ConcertMetadata,
} from "../../lib/api-client";
import { formatCurrency, formatDate, formatTime } from "../../lib/catalog-ui";
import { AdminAccessState, AdminShell } from "./AdminShell";
import { GuestListPanel } from "./GuestListPanel";

type TabId = "info" | "guests" | "bio";

type LoadStatus = "loading" | "ready" | "error";

// Trang chi tiết concert của Admin: gộp Thông tin / Khách mời / Bio vào một chỗ
// (thay cho trang "Khách mời" độc lập trước đây).
export function AdminConcertDetailPage() {
  const { concertId } = useParams<{ concertId: string }>();
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";

  const [metadata, setMetadata] = useState<ConcertMetadata | null>(null);
  const [driveFolderId, setDriveFolderId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [tab, setTab] = useState<TabId>("info");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!canUseAdmin || !concertId) return;
    let mounted = true;
    setStatus("loading");

    Promise.all([
      apiGet<ApiResponse<ConcertMetadata>>(`/admin/concerts/${concertId}/metadata`),
      // Metadata không mang guest_drive_folder_id → lấy từ danh sách admin.
      listAdminConcerts().catch(() => []),
    ])
      .then(([metadataResponse, concerts]) => {
        if (!mounted) return;
        setMetadata(metadataResponse.data);
        setDriveFolderId(
          concerts.find((concert) => concert.id === concertId)?.guest_drive_folder_id,
        );
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, [canUseAdmin, concertId]);

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} />;
  }

  async function handleStatusAction(action: "publish" | "cancel") {
    if (!concertId) return;
    setActionBusy(true);
    setActionMessage("");
    try {
      const result = action === "publish" ? await publishConcert(concertId) : await cancelConcert(concertId);
      setMetadata((current) =>
        current ? { ...current, concert: { ...current.concert, status: result.data.status } } : current,
      );
      setActionMessage(action === "publish" ? "Đã publish concert." : "Đã hủy concert.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Thao tác thất bại.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <AdminShell>
      <section className="mx-auto max-w-5xl">
        {status === "loading" && (
          <p className="flex items-center gap-2 py-16 text-center text-sm text-[#8585A0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải concert…
          </p>
        )}
        {status === "error" && (
          <p className="py-16 text-center text-sm text-[#E8315B]">Không tải được concert.</p>
        )}

        {status === "ready" && metadata && concertId && (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
                  <Music className="h-4 w-4" />
                  Concert
                </div>
                <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  {metadata.concert.title}
                </h1>
                <p className="mt-1 text-sm text-[#8585A0]">
                  {metadata.concert.artist_name} · <StatusChip status={metadata.concert.status} />
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/admin/concerts/${concertId}/preview`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#F0EDEB] hover:bg-white/10"
                >
                  <Eye className="h-4 w-4" />
                  Xem trước
                </Link>
                {metadata.concert.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleStatusAction("publish")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DBE6C] px-3 py-2 text-sm font-semibold text-[#0D0D14] disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                {metadata.concert.status === "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleStatusAction("cancel")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8315B]/40 bg-[#E8315B]/10 px-3 py-2 text-sm font-semibold text-[#E8315B] disabled:opacity-50"
                  >
                    Hủy concert
                  </button>
                )}
              </div>
            </div>

            {actionMessage && (
              <div className="mb-5 rounded-2xl border border-[#7B61FF]/25 bg-[#7B61FF]/10 px-4 py-3 text-sm text-[#C9BCFF]">
                {actionMessage}
              </div>
            )}

            <div className="mb-6 flex gap-1 border-b border-white/10">
              {(
                [
                  { id: "info", label: "Thông tin concert", icon: <Info className="h-4 w-4" /> },
                  { id: "guests", label: "Khách mời", icon: <Users className="h-4 w-4" /> },
                  { id: "bio", label: "Bio", icon: <FileText className="h-4 w-4" /> },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                  style={{
                    color: tab === item.id ? "#F5C842" : "#8585A0",
                    borderBottom: tab === item.id ? "2px solid #F5C842" : "2px solid transparent",
                    marginBottom: "-1px",
                    fontWeight: tab === item.id ? 600 : 400,
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "info" && <InfoTab metadata={metadata} />}
            {tab === "guests" && <GuestListPanel concertId={concertId} driveFolderId={driveFolderId} />}
            {tab === "bio" && <BioTab metadata={metadata} />}
          </>
        )}
      </section>
    </AdminShell>
  );
}

function InfoTab({ metadata }: { metadata: ConcertMetadata }) {
  const { concert, venue, seat_zones: zones, ticket_types: ticketTypes } = metadata;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard icon={<Calendar className="h-4 w-4 text-[#F5C842]" />} label="Ngày diễn" value={formatDate(concert.starts_at)} />
        <InfoCard
          icon={<Calendar className="h-4 w-4 text-[#F5C842]" />}
          label="Giờ diễn"
          value={`${formatTime(concert.starts_at)} - ${formatTime(concert.ends_at)}`}
        />
        <InfoCard icon={<MapPin className="h-4 w-4 text-[#F5C842]" />} label="Địa điểm" value={`${venue.name}, ${venue.city}`} />
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
        <h2 className="mb-3 text-sm font-semibold">Zone ({zones.length})</h2>
        {zones.length === 0 ? (
          <p className="text-sm text-[#8585A0]">Chưa có zone.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {zones.map((zone) => (
              <div key={zone.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm">
                <p className="font-medium">{zone.name} ({zone.code})</p>
                <p className="text-xs text-[#8585A0]">{zone.capacity.toLocaleString("vi-VN")} chỗ</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
        <h2 className="mb-3 text-sm font-semibold">Loại vé ({ticketTypes.length})</h2>
        {ticketTypes.length === 0 ? (
          <p className="text-sm text-[#8585A0]">Chưa có loại vé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-[#8585A0]">
                  <th className="px-2 py-2 font-semibold">Tên vé</th>
                  <th className="px-2 py-2 font-semibold">Zone</th>
                  <th className="px-2 py-2 font-semibold">Giá</th>
                  <th className="px-2 py-2 font-semibold">Tối đa/người</th>
                  <th className="px-2 py-2 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {ticketTypes.map((ticketType) => (
                  <tr key={ticketType.id} className="border-t border-white/[0.06]">
                    <td className="px-2 py-2">{ticketType.name}</td>
                    <td className="px-2 py-2 text-[#8585A0]">{ticketType.zone_code ?? "—"}</td>
                    <td className="px-2 py-2 text-[#F5C842]">{formatCurrency(ticketType.price.amount)}</td>
                    <td className="px-2 py-2 text-[#8585A0]">{ticketType.max_per_user}</td>
                    <td className="px-2 py-2 text-[#8585A0]">{ticketType.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BioTab({ metadata }: { metadata: ConcertMetadata }) {
  const { concert } = metadata;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#F5C842]">Giới thiệu concert (tab "Thông tin" phía audience)</h2>
        <div className="flex flex-col gap-4 sm:flex-row">
          <BioImage url={concert.cover_image_url} label="Ảnh concert (tách từ press kit — trang 1)" wide />
          <p className="min-w-0 flex-1 whitespace-pre-line text-sm leading-relaxed text-[#B0B0C0]">
            {concert.description || "Chưa có giới thiệu concert — AI sẽ tự sinh từ press kit nếu hồ sơ có file PDF."}
          </p>
        </div>
      </div>

      {(metadata.artists && metadata.artists.length > 0
        ? metadata.artists.map((artist) => ({
            name: artist.name || concert.artist_name,
            bio: artist.bio,
            imageUrl: artist.image_url ?? undefined,
          }))
        : [
            {
              name: concert.artist_name,
              bio: metadata.artist_bio ?? "",
              imageUrl: metadata.artist_bio_image_url,
            },
          ]
      ).map((artist, index, list) => (
        <div key={`${artist.name}-${index}`} className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#F5C842]">
            {list.length > 1 ? `Nghệ sĩ ${index + 1}/${list.length}: ${artist.name}` : `Bio nghệ sĩ (tab "Nghệ sĩ" phía audience)`}
          </h2>
          <div className="flex flex-col gap-4 sm:flex-row">
            <BioImage url={artist.imageUrl} label="Ảnh nghệ sĩ (tách từ press kit — trang 2+)" />
            <div className="min-w-0 flex-1">
              {list.length === 1 && <p className="mb-1 text-sm font-semibold text-[#F0EDEB]">{artist.name}</p>}
              <p className="whitespace-pre-line text-sm leading-relaxed text-[#B0B0C0]">
                {artist.bio || "Chưa có bio nghệ sĩ — AI sẽ tự sinh từ press kit nếu hồ sơ có file PDF."}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Khung ảnh của tab Bio: luôn hiển thị (kèm placeholder khi chưa có ảnh)
// để admin thấy rõ press kit đã tách được ảnh hay chưa.
function BioImage({ url, label, wide = false }: { url?: string | null; label: string; wide?: boolean }) {
  const sizeClass = wide ? "h-36 w-64" : "h-36 w-36";
  return (
    <div className="shrink-0">
      {url ? (
        <img src={url} alt={label} className={`${sizeClass} rounded-xl object-cover`} />
      ) : (
        <div
          className={`${sizeClass} flex items-center justify-center rounded-xl border border-dashed border-white/15 px-3 text-center text-xs text-[#8585A0]`}
        >
          Chưa có ảnh
        </div>
      )}
      <p className="mt-1.5 max-w-64 text-xs text-[#8585A0]">{label}</p>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#111118] p-4">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="mb-0.5 text-xs text-[#8585A0]">{label}</p>
        <p className="text-sm font-medium text-[#F0EDEB]">{value}</p>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    DRAFT: { color: "#F5C842", bg: "rgba(245,200,66,0.12)" },
    PUBLISHED: { color: "#2DBE6C", bg: "rgba(45,190,108,0.12)" },
    CANCELLED: { color: "#E8315B", bg: "rgba(232,49,91,0.12)" },
    COMPLETED: { color: "#8585A0", bg: "rgba(255,255,255,0.08)" },
  };
  const item = map[status] ?? map.DRAFT;
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: item.bg, color: item.color }}>
      {status}
    </span>
  );
}
