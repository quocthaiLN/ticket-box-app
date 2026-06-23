import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  QrCode, Wifi, WifiOff, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Clock, ChevronRight, LogOut, Bell, RotateCcw,
  ShieldAlert, Scan, History, CloudUpload, User, MapPin, Info
} from "lucide-react";
import { CONCERTS } from "../data/mockData";

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanResult = "SUCCESS" | "WRONG_GATE" | "ALREADY_CHECKED_IN" | "INVALID" | "CONFLICT";
type Tab = "scan" | "log" | "sync";

interface ScanLog {
  id: string;
  qrToken: string;
  holderName: string;
  ticketType: string;
  zoneName: string;
  zoneColor: string;
  result: ScanResult;
  scannedAt: string;
  synced: boolean;
  reason?: string;
}

interface SyncBatch {
  id: string;
  batchToken: string;
  createdAt: string;
  status: "PENDING" | "SYNCING" | "DONE" | "FAILED";
  itemCount: number;
  acceptedCount: number;
  conflictCount: number;
}

interface Notification {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  at: string;
}

// ── Gate / Device Config ─────────────────────────────────────────────────────

const DEVICE = {
  deviceCode: "CHECKER-night-lights",
  concertId: "concert-1",
  gateId: "gate-vip",
  gateName: "Cổng VIP",
  allowedZones: [
    { id: "zone-1-2", code: "VIP", name: "VIP", color: "#E8315B" },
  ],
};

const concert = CONCERTS.find((c) => c.id === DEVICE.concertId)!;

// ── Mock ticket pool ─────────────────────────────────────────────────────────

const MOCK_TICKETS = [
  { qrToken: "TB-2026-A8F3K9", holderName: "Nguyễn Văn An", ticketType: "VIP", zoneName: "VIP", zoneColor: "#E8315B", zoneId: "zone-1-2" },
  { qrToken: "TB-2026-C2M7P1", holderName: "Trần Thị Bích", ticketType: "VIP", zoneName: "VIP", zoneColor: "#E8315B", zoneId: "zone-1-2" },
  { qrToken: "TB-2026-X9L4W5", holderName: "Lê Hoàng Nam", ticketType: "VIP", zoneName: "VIP", zoneColor: "#E8315B", zoneId: "zone-1-2" },
  { qrToken: "TB-2026-D5T8R2", holderName: "Phạm Quỳnh Anh", ticketType: "SVIP", zoneName: "SVIP", zoneColor: "#F5C842", zoneId: "zone-1-1" },  // wrong zone
  { qrToken: "TB-2026-K3N6Q8", holderName: "Vũ Minh Đức", ticketType: "CAT 1", zoneName: "CAT 1", zoneColor: "#7B61FF", zoneId: "zone-1-3" },   // wrong zone
  { qrToken: "TB-2026-M1P4Y7", holderName: "Hoàng Thu Hà", ticketType: "GA", zoneName: "GA", zoneColor: "#3B9AF8", zoneId: "zone-1-4" },         // wrong zone
  { qrToken: "TB-2026-F7H2J5", holderName: "Đỗ Khánh Linh", ticketType: "VIP", zoneName: "VIP", zoneColor: "#E8315B", zoneId: "zone-1-2" },
  { qrToken: "INVALID-QR-XXXX", holderName: "???", ticketType: "???", zoneName: "???", zoneColor: "#8585A0", zoneId: "" },                        // invalid
];

function resolveTicket(qrToken: string) {
  return MOCK_TICKETS.find((t) => t.qrToken === qrToken) ?? null;
}

function evaluateScan(ticket: typeof MOCK_TICKETS[0] | null, checkedSet: Set<string>): ScanResult {
  if (!ticket || !ticket.zoneId) return "INVALID";
  const allowed = DEVICE.allowedZones.some((z) => z.id === ticket.zoneId);
  if (!allowed) return "WRONG_GATE";
  if (checkedSet.has(ticket.qrToken)) return "ALREADY_CHECKED_IN";
  return "SUCCESS";
}

// ── Result config ─────────────────────────────────────────────────────────────

const RESULT_CFG: Record<ScanResult, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; reason: string }> = {
  SUCCESS:            { label: "Hợp lệ — Cho vào",    color: "#2DBE6C", bg: "rgba(45,190,108,0.12)",  border: "rgba(45,190,108,0.4)",  icon: <CheckCircle2 className="w-8 h-8" />, reason: "" },
  WRONG_GATE:         { label: "Sai cổng / Sai khu",   color: "#F5C842", bg: "rgba(245,200,66,0.1)",   border: "rgba(245,200,66,0.4)",  icon: <ShieldAlert className="w-8 h-8" />,  reason: "Vé này không thuộc khu được phép ở cổng này." },
  ALREADY_CHECKED_IN: { label: "Đã check-in rồi",      color: "#E8315B", bg: "rgba(232,49,91,0.1)",    border: "rgba(232,49,91,0.4)",   icon: <AlertTriangle className="w-8 h-8" />, reason: "Vé này đã được quét trước đó." },
  INVALID:            { label: "Mã QR không hợp lệ",   color: "#E8315B", bg: "rgba(232,49,91,0.1)",    border: "rgba(232,49,91,0.4)",   icon: <XCircle className="w-8 h-8" />,      reason: "QR sai chữ ký hoặc không tồn tại." },
  CONFLICT:           { label: "Xung đột dữ liệu",      color: "#7B61FF", bg: "rgba(123,97,255,0.1)",   border: "rgba(123,97,255,0.4)",  icon: <AlertTriangle className="w-8 h-8" />, reason: "Vé đã check-in ở cổng khác khi sync." },
};

// ── Main Component ────────────────────────────────────────────────────────────

export function CheckerPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("scan");
  const [isOnline, setIsOnline] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<ScanLog | null>(null);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [checkedSet, setCheckedSet] = useState<Set<string>>(new Set());
  const [syncBatches, setSyncBatches] = useState<SyncBatch[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [logFilter, setLogFilter] = useState<ScanResult | "all">("all");
  const ticketCursor = useRef(0);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unread notification count
  const unreadCount = notifications.filter((n) => !n._read).length;

  const addNotification = useCallback((message: string, type: Notification["type"]) => {
    const n: Notification & { _read?: boolean } = { id: Date.now().toString(), message, type, at: new Date().toLocaleTimeString("vi-VN") };
    setNotifications((prev) => [n, ...prev].slice(0, 30));
  }, []);

  const pendingLogs = scanLogs.filter((l) => !l.synced);

  // Auto-dismiss last scan result after 4s
  useEffect(() => {
    if (lastScan) {
      if (resultTimer.current) clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => setLastScan(null), 4000);
    }
    return () => { if (resultTimer.current) clearTimeout(resultTimer.current); };
  }, [lastScan]);

  // Simulate a QR scan
  const handleScan = () => {
    if (scanning) return;
    setScanning(true);
    setTimeout(() => {
      const ticket = MOCK_TICKETS[ticketCursor.current % MOCK_TICKETS.length];
      ticketCursor.current += 1;
      const result = evaluateScan(ticket, checkedSet);

      const log: ScanLog = {
        id: `scan-${Date.now()}`,
        qrToken: ticket.qrToken,
        holderName: ticket.holderName,
        ticketType: ticket.ticketType,
        zoneName: ticket.zoneName,
        zoneColor: ticket.zoneColor,
        result,
        scannedAt: new Date().toLocaleTimeString("vi-VN"),
        synced: isOnline,
        reason: RESULT_CFG[result].reason,
      };

      if (result === "SUCCESS") {
        setCheckedSet((prev) => new Set([...prev, ticket.qrToken]));
      }

      setScanLogs((prev) => [log, ...prev]);
      setLastScan(log);

      // Notification
      const msg = result === "SUCCESS"
        ? `✓ ${ticket.holderName} — Check-in thành công`
        : result === "WRONG_GATE"
        ? `⚠ ${ticket.holderName} — Sai cổng/khu (${ticket.zoneName})`
        : result === "ALREADY_CHECKED_IN"
        ? `✗ ${ticket.holderName} — Đã check-in rồi`
        : `✗ ${ticket.qrToken} — QR không hợp lệ`;
      addNotification(msg, result === "SUCCESS" ? "success" : result === "WRONG_GATE" ? "warning" : "error");

      setScanning(false);
    }, 900);
  };

  // Sync offline items
  const handleSync = () => {
    if (syncing || pendingLogs.length === 0) return;
    setSyncing(true);
    const batchToken = `BATCH-${Date.now().toString(36).toUpperCase()}`;
    const batchId = `batch-${Date.now()}`;

    setSyncBatches((prev) => [{
      id: batchId, batchToken, createdAt: new Date().toLocaleTimeString("vi-VN"),
      status: "SYNCING", itemCount: pendingLogs.length, acceptedCount: 0, conflictCount: 0,
    }, ...prev]);

    setTimeout(() => {
      const conflicts = pendingLogs.filter((l) => l.result === "SUCCESS" && Math.random() < 0.1).length;
      const accepted = pendingLogs.filter((l) => l.result === "SUCCESS").length - conflicts;

      setScanLogs((prev) => prev.map((l) => ({ ...l, synced: true })));
      setSyncBatches((prev) => prev.map((b) => b.id === batchId
        ? { ...b, status: "DONE", acceptedCount: accepted, conflictCount: conflicts }
        : b
      ));
      setSyncing(false);
      addNotification(`Sync hoàn tất: ${accepted} accepted, ${conflicts} conflict`, conflicts > 0 ? "warning" : "success");
    }, 2200);
  };

  const stats = {
    total: scanLogs.length,
    success: scanLogs.filter((l) => l.result === "SUCCESS").length,
    wrongGate: scanLogs.filter((l) => l.result === "WRONG_GATE").length,
    invalid: scanLogs.filter((l) => l.result === "INVALID" || l.result === "ALREADY_CHECKED_IN").length,
    pending: pendingLogs.length,
  };

  const filteredLogs = logFilter === "all" ? scanLogs : scanLogs.filter((l) => l.result === logFilter);

  const handleLogout = () => {
    sessionStorage.removeItem("authUser");
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto" style={{ background: "#08080E", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Top header ── */}
      <header className="px-4 pt-4 pb-3 flex items-center justify-between" style={{ background: "#0D0D15", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B61FF, #5B41CF)" }}>
            <Scan className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold leading-tight" style={{ color: "#F0EDEB" }}>{DEVICE.gateName}</p>
            <p className="text-xs leading-tight" style={{ color: "#8585A0" }}>{concert?.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Online/offline toggle */}
          <button
            onClick={() => { setIsOnline((v) => !v); addNotification(isOnline ? "Đã chuyển sang chế độ offline" : "Đã kết nối lại", isOnline ? "warning" : "success"); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: isOnline ? "rgba(45,190,108,0.12)" : "rgba(232,49,91,0.12)",
              border: `1px solid ${isOnline ? "rgba(45,190,108,0.3)" : "rgba(232,49,91,0.3)"}`,
              color: isOnline ? "#2DBE6C" : "#E8315B",
            }}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? "Online" : "Offline"}
          </button>

          {/* Notifications */}
          <button onClick={() => setShowNotifPanel((v) => !v)} className="relative p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#8585A0" }}>
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold" style={{ background: "#E8315B", color: "#fff" }}>
                {Math.min(notifications.length, 9)}
              </span>
            )}
          </button>

          {/* Logout */}
          <button onClick={handleLogout} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#8585A0" }}>
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </header>

      {/* Offline banner */}
      {!isOnline && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs" style={{ background: "rgba(232,49,91,0.08)", borderBottom: "1px solid rgba(232,49,91,0.2)" }}>
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#E8315B" }} />
          <span style={{ color: "#E8315B" }}>
            Chế độ offline — Scan được lưu local. {stats.pending > 0 && `${stats.pending} vé chờ sync.`}
          </span>
        </div>
      )}

      {/* Notification panel */}
      {showNotifPanel && (
        <div className="absolute top-16 right-4 z-50 w-80 rounded-2xl overflow-hidden shadow-xl" style={{ background: "#1A1A24", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Thông báo</span>
            <button onClick={() => setShowNotifPanel(false)} className="text-xs" style={{ color: "#8585A0" }}>Đóng</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "#8585A0" }}>Chưa có thông báo</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: n.type === "success" ? "#2DBE6C" : n.type === "warning" ? "#F5C842" : n.type === "error" ? "#E8315B" : "#7B61FF" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: "#F0EDEB" }}>{n.message}</p>
                    <p className="text-xs" style={{ color: "#8585A0" }}>{n.at}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Gate info strip ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 overflow-x-auto" style={{ background: "#111118", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <MapPin className="w-3.5 h-3.5" style={{ color: "#7B61FF" }} />
          <span className="text-xs" style={{ color: "#8585A0" }}>Khu hợp lệ:</span>
          {DEVICE.allowedZones.map((z) => (
            <span key={z.id} className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${z.color}20`, color: z.color }}>{z.name}</span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          <User className="w-3.5 h-3.5" style={{ color: "#8585A0" }} />
          <span className="text-xs" style={{ color: "#8585A0" }}>Demo Checker</span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">

        {/* SCAN TAB */}
        {tab === "scan" && (
          <div className="h-full flex flex-col p-4 gap-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <StatChip label="Thành công" value={stats.success} color="#2DBE6C" />
              <StatChip label="Sai cổng" value={stats.wrongGate} color="#F5C842" />
              <StatChip label="Lỗi / Trùng" value={stats.invalid} color="#E8315B" />
            </div>

            {/* Scan result card */}
            {lastScan ? (
              <ResultCard log={lastScan} />
            ) : (
              <div
                className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-3 min-h-[220px]"
                style={{ background: "#111118", border: "2px dashed rgba(255,255,255,0.1)" }}
              >
                <QrCode className="w-16 h-16" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="text-sm" style={{ color: "#8585A0" }}>Sẵn sàng quét vé</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Kết quả sẽ hiện ở đây</p>
              </div>
            )}

            {/* Scan button */}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="w-full py-5 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
              style={{
                background: scanning
                  ? "rgba(123,97,255,0.3)"
                  : "linear-gradient(135deg, #7B61FF, #5B41CF)",
                color: "#fff",
                boxShadow: scanning ? "none" : "0 12px 36px rgba(123,97,255,0.4)",
              }}
            >
              {scanning ? (
                <><RefreshCw className="w-6 h-6 animate-spin" />Đang quét...</>
              ) : (
                <><Scan className="w-6 h-6" />Quét mã QR</>
              )}
            </button>

            {!isOnline && stats.pending > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)" }}>
                <div className="flex items-center gap-2">
                  <CloudUpload className="w-4 h-4" style={{ color: "#F5C842" }} />
                  <span className="text-xs" style={{ color: "#F5C842" }}>{stats.pending} vé chờ đồng bộ</span>
                </div>
                <button onClick={() => setTab("sync")} className="text-xs" style={{ color: "#F5C842" }}>
                  Xem <ChevronRight className="w-3 h-3 inline" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {tab === "log" && (
          <div className="h-full flex flex-col">
            {/* Filter */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {(["all", "SUCCESS", "WRONG_GATE", "ALREADY_CHECKED_IN", "INVALID"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={logFilter === f
                    ? { background: "#7B61FF", color: "#fff", fontWeight: 600 }
                    : { background: "rgba(255,255,255,0.05)", color: "#8585A0", border: "1px solid rgba(255,255,255,0.07)" }
                  }
                >
                  {f === "all" ? `Tất cả (${scanLogs.length})`
                    : f === "SUCCESS" ? `✓ Thành công (${stats.success})`
                    : f === "WRONG_GATE" ? `⚠ Sai cổng (${stats.wrongGate})`
                    : f === "ALREADY_CHECKED_IN" ? `⊘ Trùng`
                    : `✗ Lỗi`}
                </button>
              ))}
            </div>

            {/* Log list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-16">
                  <History className="w-10 h-10 mx-auto mb-2" style={{ color: "#8585A0" }} />
                  <p className="text-sm" style={{ color: "#8585A0" }}>Chưa có lịch sử quét</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const cfg = RESULT_CFG[log.result];
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl"
                      style={{ background: "#111118", border: `1px solid ${log.result === "SUCCESS" ? "rgba(45,190,108,0.12)" : "rgba(255,255,255,0.06)"}` }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                        <div className="w-4 h-4">{log.result === "SUCCESS" ? <CheckCircle2 className="w-4 h-4" /> : log.result === "WRONG_GATE" ? <ShieldAlert className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold truncate" style={{ color: "#F0EDEB" }}>{log.holderName}</p>
                          {!log.synced && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842" }}>Chờ sync</span>}
                        </div>
                        <p className="text-xs" style={{ color: "#8585A0" }}>
                          <span style={{ color: log.zoneColor }}>{log.zoneName}</span>
                          {" · "}<span style={{ color: cfg.color }}>{cfg.label}</span>
                          {" · "}{log.scannedAt}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SYNC TAB */}
        {tab === "sync" && (
          <div className="h-full flex flex-col p-4 gap-4 overflow-y-auto">
            {/* Status card */}
            <div className="rounded-2xl p-4" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Trạng thái đồng bộ</h3>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: isOnline ? "rgba(45,190,108,0.12)" : "rgba(232,49,91,0.12)", color: isOnline ? "#2DBE6C" : "#E8315B" }}
                >
                  {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  {isOnline ? "Online" : "Offline"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatChip label="Đã sync" value={scanLogs.filter((l) => l.synced).length} color="#2DBE6C" />
                <StatChip label="Chờ sync" value={stats.pending} color="#F5C842" />
                <StatChip label="Tổng scan" value={stats.total} color="#7B61FF" />
              </div>

              <button
                onClick={handleSync}
                disabled={syncing || stats.pending === 0 || !isOnline}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: stats.pending > 0 && isOnline ? "linear-gradient(135deg, #2DBE6C, #1E9B55)" : "rgba(255,255,255,0.05)",
                  color: stats.pending > 0 && isOnline ? "#fff" : "#8585A0",
                  boxShadow: stats.pending > 0 && isOnline ? "0 8px 24px rgba(45,190,108,0.3)" : "none",
                }}
              >
                {syncing
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Đang đồng bộ...</>
                  : <><CloudUpload className="w-4 h-4" />Đồng bộ {stats.pending > 0 ? `${stats.pending} vé` : "ngay"}</>
                }
              </button>

              {!isOnline && stats.pending > 0 && (
                <p className="text-xs text-center mt-2" style={{ color: "#8585A0" }}>Bật lại kết nối để đồng bộ</p>
              )}
            </div>

            {/* Offline flow info */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" style={{ color: "#7B61FF" }} />
                <p className="text-xs font-semibold" style={{ color: "#F0EDEB" }}>Quy trình offline sync</p>
              </div>
              {[
                { step: "1", text: "Khi offline, scan được lưu vào SQLite local" },
                { step: "2", text: "Khi có mạng, tạo batch token idempotent" },
                { step: "3", text: "Server validate từng item: zone, gate, conflict" },
                { step: "4", text: "Kết quả trả về: accepted / conflict count" },
              ].map((s) => (
                <div key={s.step} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: "rgba(123,97,255,0.15)", color: "#7B61FF" }}>{s.step}</div>
                  <p className="text-xs leading-relaxed" style={{ color: "#8585A0" }}>{s.text}</p>
                </div>
              ))}
            </div>

            {/* Batch history */}
            {syncBatches.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold mb-2 px-1" style={{ color: "#8585A0" }}>Lịch sử batch sync</h3>
                <div className="space-y-2">
                  {syncBatches.map((batch) => (
                    <div key={batch.id} className="p-3 rounded-xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono" style={{ color: "#8585A0" }}>{batch.batchToken}</span>
                        <BatchStatusBadge status={batch.status} />
                      </div>
                      {batch.status === "DONE" && (
                        <div className="flex gap-4 text-xs">
                          <span style={{ color: "#2DBE6C" }}>✓ {batch.acceptedCount} accepted</span>
                          {batch.conflictCount > 0 && <span style={{ color: "#F5C842" }}>⚠ {batch.conflictCount} conflict</span>}
                          <span style={{ color: "#8585A0" }}>{batch.itemCount} total</span>
                        </div>
                      )}
                      {batch.status === "SYNCING" && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: "#7B61FF" }}>
                          <RefreshCw className="w-3 h-3 animate-spin" />Đang xử lý...
                        </div>
                      )}
                      <p className="text-xs mt-1" style={{ color: "#8585A0" }}>{batch.createdAt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom tab bar ── */}
      <div className="flex" style={{ background: "#0D0D15", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {([
          { key: "scan" as Tab, icon: <Scan className="w-5 h-5" />, label: "Quét vé" },
          { key: "log" as Tab, icon: <History className="w-5 h-5" />, label: "Lịch sử", badge: stats.total },
          { key: "sync" as Tab, icon: <CloudUpload className="w-5 h-5" />, label: "Đồng bộ", badge: stats.pending },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 flex flex-col items-center gap-1 py-3 relative transition-all"
            style={{ color: tab === t.key ? "#7B61FF" : "#8585A0" }}
          >
            <div className="relative">
              {t.icon}
              {t.badge != null && t.badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: t.key === "sync" ? "#F5C842" : "#E8315B", color: t.key === "sync" ? "#0A0A0F" : "#fff", fontSize: "9px" }}
                >
                  {t.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: "10px" }}>{t.label}</span>
            {tab === t.key && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: "#7B61FF" }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultCard({ log }: { log: ScanLog }) {
  const cfg = RESULT_CFG[log.result];
  return (
    <div
      className="flex-1 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-center min-h-[180px]"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
    >
      <div style={{ color: cfg.color }}>{cfg.icon}</div>
      <div>
        <p className="text-lg font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
        {log.result === "SUCCESS" && (
          <>
            <p className="text-base font-semibold mt-1" style={{ color: "#F0EDEB" }}>{log.holderName}</p>
            <p className="text-sm mt-0.5">
              <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${log.zoneColor}25`, color: log.zoneColor }}>{log.zoneName}</span>
              <span className="ml-2 text-xs" style={{ color: "#8585A0" }}>{log.ticketType}</span>
            </p>
          </>
        )}
        {log.result !== "SUCCESS" && (
          <>
            <p className="text-sm mt-1" style={{ color: "#F0EDEB" }}>{log.holderName !== "???" ? log.holderName : log.qrToken}</p>
            {cfg.reason && <p className="text-xs mt-1" style={{ color: "#8585A0" }}>{cfg.reason}</p>}
            {log.result === "WRONG_GATE" && (
              <p className="text-xs mt-1 px-3 py-1 rounded-full inline-block" style={{ background: `${log.zoneColor}20`, color: log.zoneColor }}>
                Vé zone: {log.zoneName} — Cổng này chỉ nhận: {DEVICE.allowedZones.map((z) => z.name).join(", ")}
              </p>
            )}
          </>
        )}
      </div>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{log.scannedAt} · {log.synced ? "Synced" : "Local only"}</p>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl py-2.5 text-center" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>{label}</p>
    </div>
  );
}

function BatchStatusBadge({ status }: { status: SyncBatch["status"] }) {
  const cfg = {
    PENDING:  { bg: "rgba(255,255,255,0.07)", color: "#8585A0", label: "Chờ" },
    SYNCING:  { bg: "rgba(123,97,255,0.1)",   color: "#7B61FF", label: "Syncing" },
    DONE:     { bg: "rgba(45,190,108,0.1)",   color: "#2DBE6C", label: "Done" },
    FAILED:   { bg: "rgba(232,49,91,0.1)",    color: "#E8315B", label: "Lỗi" },
  }[status];
  return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
}
