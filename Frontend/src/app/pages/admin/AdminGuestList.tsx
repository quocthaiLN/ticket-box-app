import { useState, useRef } from "react";
import { Upload, Download, Search, CheckCircle, Clock, X, AlertCircle, FileText, RefreshCw } from "lucide-react";
import { GUEST_LIST, CONCERTS, GuestEntry } from "../../data/mockData";

export function AdminGuestList() {
  const [selectedConcert, setSelectedConcert] = useState(CONCERTS[0].id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const concert = CONCERTS.find((c) => c.id === selectedConcert);
  const guests = GUEST_LIST.filter((g) => {
    const matchConcert = g.concertId === selectedConcert;
    const matchSearch = !search || g.fullName.toLowerCase().includes(search.toLowerCase()) || g.phone.includes(search) || (g.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || g.status === statusFilter;
    return matchConcert && matchSearch && matchStatus;
  });

  const stats = {
    total: GUEST_LIST.filter((g) => g.concertId === selectedConcert).length,
    invited: GUEST_LIST.filter((g) => g.concertId === selectedConcert && g.status === "INVITED").length,
    checkedIn: GUEST_LIST.filter((g) => g.concertId === selectedConcert && g.status === "CHECKED_IN").length,
    cancelled: GUEST_LIST.filter((g) => g.concertId === selectedConcert && g.status === "CANCELLED").length,
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith(".csv")) { alert("Chỉ hỗ trợ file CSV"); return; }
    setImporting(true);
    setImportResult(null);
    setTimeout(() => {
      setImporting(false);
      setImportResult({ success: 42, errors: 3, total: 45 });
    }, 2000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>
            Danh sách Khách mời
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>Quản lý guest list VIP và import từ file CSV</p>
        </div>
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.07)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Download className="w-4 h-4" />
          Xuất CSV mẫu
        </button>
      </div>

      {/* Concert selector */}
      <div className="mb-6">
        <label className="text-xs mb-1.5 block" style={{ color: "#8585A0" }}>Chọn sự kiện</label>
        <select
          value={selectedConcert}
          onChange={(e) => setSelectedConcert(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB", minWidth: "280px" }}
        >
          {CONCERTS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left - Import section */}
        <div className="xl:col-span-1 space-y-4">
          {/* CSV Import */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Import từ CSV</h3>
            </div>
            <div className="p-5">
              <p className="text-xs mb-3" style={{ color: "#8585A0" }}>
                File CSV cần có các cột: <code style={{ color: "#F5C842" }}>full_name, phone, email, seat_zone_code, note</code>
              </p>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-3"
                style={{
                  borderColor: dragOver ? "#F5C842" : "rgba(255,255,255,0.12)",
                  background: dragOver ? "rgba(245,200,66,0.05)" : "transparent",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-7 h-7 mx-auto mb-2" style={{ color: dragOver ? "#F5C842" : "#8585A0" }} />
                <p className="text-sm mb-0.5" style={{ color: "#F0EDEB" }}>Kéo thả hoặc click</p>
                <p className="text-xs" style={{ color: "#8585A0" }}>Hỗ trợ file .CSV – tối đa 5MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                />
              </div>

              {importing && (
                <div className="flex items-center gap-2 text-xs p-3 rounded-lg mb-2" style={{ background: "rgba(123,97,255,0.1)", color: "#7B61FF" }}>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang xử lý file CSV...
                </div>
              )}

              {importResult && (
                <div className="p-3 rounded-xl space-y-2" style={{ background: "rgba(45,190,108,0.08)", border: "1px solid rgba(45,190,108,0.2)" }}>
                  <p className="text-xs font-semibold" style={{ color: "#2DBE6C" }}>Import hoàn tất</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <ImportStat label="Tổng" value={importResult.total} color="#F0EDEB" />
                    <ImportStat label="Thành công" value={importResult.success} color="#2DBE6C" />
                    <ImportStat label="Lỗi" value={importResult.errors} color="#E8315B" />
                  </div>
                  {importResult.errors > 0 && (
                    <button className="text-xs flex items-center gap-1" style={{ color: "#E8315B" }}>
                      <FileText className="w-3.5 h-3.5" />
                      Xem {importResult.errors} dòng lỗi
                    </button>
                  )}
                </div>
              )}

              <button
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs mt-3 transition-colors hover:bg-white/5"
                style={{ color: "#8585A0", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Download className="w-3.5 h-3.5" />
                Tải template CSV mẫu
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Thống kê</h3>
            </div>
            <div className="p-4 space-y-3">
              <StatRow label="Tổng khách mời" value={stats.total} color="#F0EDEB" />
              <StatRow label="Chờ check-in" value={stats.invited} color="#F5C842" />
              <StatRow label="Đã check-in" value={stats.checkedIn} color="#2DBE6C" />
              <StatRow label="Đã hủy" value={stats.cancelled} color="#E8315B" />
              {stats.total > 0 && (
                <div className="pt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "#8585A0" }}>Tỷ lệ check-in</span>
                    <span style={{ color: "#2DBE6C" }}>{Math.round((stats.checkedIn / stats.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((stats.checkedIn / stats.total) * 100)}%`, background: "#2DBE6C" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right - Guest table */}
        <div className="xl:col-span-2">
          {/* Search + filter */}
          <div className="flex gap-3 mb-4">
            <div
              className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl"
              style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#8585A0" }} />
              <input
                placeholder="Tên, SĐT, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm flex-1"
                style={{ color: "#F0EDEB" }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
            >
              <option value="all">Tất cả</option>
              <option value="INVITED">Chờ check-in</option>
              <option value="CHECKED_IN">Đã check-in</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            {guests.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "#8585A0" }} />
                <p className="text-sm" style={{ color: "#8585A0" }}>Không có khách mời nào</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Họ tên", "Liên hệ", "Mã VIP", "Khu", "Ghi chú", "Trạng thái"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#8585A0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guests.map((guest) => (
                    <GuestRow key={guest.id} guest={guest} concert={concert} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GuestRow({ guest, concert }: { guest: GuestEntry; concert: typeof CONCERTS[0] | undefined }) {
  const zone = concert?.seatZones.find((z) => z.id === guest.seatZoneId);

  return (
    <tr
      className="transition-colors hover:bg-white/[0.03]"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      <td className="px-4 py-3">
        <p className="text-sm font-medium" style={{ color: "#F0EDEB" }}>{guest.fullName}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs" style={{ color: "#8585A0" }}>{guest.phone}</p>
        {guest.email && <p className="text-xs" style={{ color: "#8585A0" }}>{guest.email}</p>}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842" }}>
          {guest.code}
        </span>
      </td>
      <td className="px-4 py-3">
        {zone ? (
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${zone.color}20`, color: zone.color }}>
            {zone.name}
          </span>
        ) : "–"}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs truncate max-w-[120px] block" style={{ color: "#8585A0" }}>{guest.note || "–"}</span>
      </td>
      <td className="px-4 py-3">
        <GuestStatusBadge status={guest.status} />
      </td>
    </tr>
  );
}

function GuestStatusBadge({ status }: { status: GuestEntry["status"] }) {
  if (status === "INVITED") return (
    <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842" }}>
      <Clock className="w-3 h-3" />Chờ
    </span>
  );
  if (status === "CHECKED_IN") return (
    <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(45,190,108,0.1)", color: "#2DBE6C" }}>
      <CheckCircle className="w-3 h-3" />Đã vào
    </span>
  );
  return (
    <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(232,49,91,0.1)", color: "#E8315B" }}>
      <X className="w-3 h-3" />Hủy
    </span>
  );
}

function ImportStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className="font-bold text-base" style={{ color }}>{value}</p>
      <p style={{ color: "#8585A0" }}>{label}</p>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "#8585A0" }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
