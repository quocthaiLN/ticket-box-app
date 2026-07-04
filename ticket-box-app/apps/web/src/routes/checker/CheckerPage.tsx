import {
  CheckCircle2,
  Clock3,
  Download,
  QrCode,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { apiGet, apiPost, ApiResponse } from "../../lib/api-client";

type ScanResult = {
  result: string;
  ticket_id?: string;
  guest_id?: string;
  reason?: string;
  checked_in_at?: string;
};

type PreloadData = {
  snapshot_id: string;
  generated_at: string;
  allowed_seat_zones: Array<{ id: string; code: string; name: string }>;
  tickets: Array<{ ticket_id: string; qr_payload_hash: string; status_snapshot: string }>;
  guests: Array<{ guest_id: string; full_name: string; status_snapshot: string }>;
  offline?: {
    full_offline_sync_ready: boolean;
    notes: string[];
  };
};

type OfflineSyncResponse = {
  batch_id: string;
  status: "PENDING" | "SYNCING" | "DONE" | "FAILED";
  accepted_item_count: number;
  conflict_item_count: number;
  results: Array<{
    client_item_id: string;
    status: OfflineQueueStatus;
    message: string;
    ticket_id?: string | null;
    guest_id?: string | null;
  }>;
};

type OfflineQueueStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed"
  | "SUCCESS"
  | "ALREADY_CHECKED_IN"
  | "WRONG_GATE"
  | "INVALID_TICKET"
  | "INVALID_GUEST"
  | "CONFLICT"
  | "DUPLICATE_ITEM"
  | "ERROR";

type OfflineQueueItem = {
  client_item_id: string;
  type: "TICKET" | "GUEST";
  qr_token?: string;
  guest_id?: string;
  phone?: string;
  concert_id: string;
  gate_id: string;
  scanned_at: string;
  status: OfflineQueueStatus;
  message?: string;
  ticket_id?: string | null;
};

type CheckerState = {
  token: string;
  concertId: string;
  gateId: string;
  deviceId: string;
  batchToken: string;
  qrPayload: string;
  guestId: string;
  phone: string;
};

const offlineQueueKey = "ticketbox:checker:offline-queue";
const initialState: CheckerState = {
  token: "",
  concertId: "",
  gateId: "",
  deviceId: "",
  batchToken: `batch-${Date.now()}`,
  qrPayload: "",
  guestId: "",
  phone: "",
};

export function CheckerPage() {
  const [state, setState] = useState(initialState);
  const [preload, setPreload] = useState<PreloadData | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [queue, setQueue] = useState<OfflineQueueItem[]>(() => loadQueue());
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    localStorage.setItem(offlineQueueKey, JSON.stringify(queue));
  }, [queue]);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const token = state.token.trim();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [state.token]);

  const queueSummary = useMemo(() => {
    const pending = queue.filter((item) => item.status === "pending" || item.status === "failed").length;
    const synced = queue.filter((item) => item.status === "synced").length;
    const conflicts = queue.filter((item) => item.status === "conflict").length;
    return { pending, synced, conflicts };
  }, [queue]);

  function update(field: keyof CheckerState, value: string) {
    setState((current) => ({ ...current, [field]: value }));
  }

  async function loadPreload(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    await run(async () => {
      const query = new URLSearchParams({
        concert_id: state.concertId,
        gate_id: state.gateId,
        device_id: state.deviceId,
        include_guests: "true",
      });
      const response = await apiGet<ApiResponse<PreloadData>>(`/check-in/preload?${query}`, { headers: authHeaders });
      setPreload(response.data);
      setStatus(`Preloaded ${response.data.tickets.length} tickets, ${response.data.guests.length} guests`);
    });
  }

  async function scanTicket(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (mode === "offline") {
      captureOffline("TICKET");
      return;
    }

    await run(async () => {
      const response = await apiPost<ApiResponse<ScanResult>>(
        "/check-in/scans",
        {
          concert_id: state.concertId,
          gate_id: state.gateId,
          device_id: state.deviceId,
          qr_payload: state.qrPayload,
          scanned_at: new Date().toISOString(),
        },
        { headers: authHeaders },
      );
      setResult(response.data);
      setStatus(`Ticket scan: ${response.data.result}`);
    });
  }

  async function scanGuest(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (mode === "offline") {
      captureOffline("GUEST");
      return;
    }

    await run(async () => {
      const response = await apiPost<ApiResponse<ScanResult>>(
        "/check-in/guests/scans",
        {
          concert_id: state.concertId,
          gate_id: state.gateId,
          device_id: state.deviceId,
          guest_id: state.guestId || undefined,
          phone: state.phone || undefined,
          scanned_at: new Date().toISOString(),
        },
        { headers: authHeaders },
      );
      setResult(response.data);
      setStatus(`Guest scan: ${response.data.result}`);
    });
  }

  function captureOffline(type: "TICKET" | "GUEST") {
    const ticketToken = state.qrPayload.trim();
    const guestId = state.guestId.trim();
    const phone = state.phone.trim();

    if (type === "TICKET" && !ticketToken) {
      setStatus("Ticket token is required");
      return;
    }

    if (type === "GUEST" && !guestId && !phone) {
      setStatus("Guest id or phone is required");
      return;
    }

    const item: OfflineQueueItem = {
      client_item_id: `local-${Date.now()}-${queue.length + 1}`,
      type,
      qr_token: type === "TICKET" ? ticketToken : undefined,
      guest_id: type === "GUEST" ? guestId || undefined : undefined,
      phone: type === "GUEST" ? phone || undefined : undefined,
      concert_id: state.concertId,
      gate_id: state.gateId,
      scanned_at: new Date().toISOString(),
      status: "pending",
    };

    setQueue((current) => [item, ...current]);
    setResult({ result: "OFFLINE_PENDING", ticket_id: item.qr_token, guest_id: item.guest_id });
    setStatus(`${type === "TICKET" ? "Ticket" : "Guest"} captured offline`);
  }

  async function syncOfflineQueue(onlyFailed = false) {
    const itemsToSync = queue.filter((item) =>
      onlyFailed ? item.status === "failed" || item.status === "conflict" : item.status === "pending" || item.status === "failed",
    );

    if (itemsToSync.length === 0) {
      setStatus("No offline items to sync");
      return;
    }

    await run(async () => {
      setQueue((current) =>
        current.map((item) =>
          itemsToSync.some((queued) => queued.client_item_id === item.client_item_id)
            ? { ...item, status: "syncing" }
            : item,
        ),
      );

      const response = await apiPost<ApiResponse<OfflineSyncResponse>>(
        "/check-in/offline-sync",
        {
          batch_id: state.batchToken,
          device_id: state.deviceId,
          concert_id: state.concertId,
          gate_id: state.gateId,
          items: itemsToSync.map((item) => ({
            client_item_id: item.client_item_id,
            type: item.type,
            qr_token: item.qr_token,
            guest_id: item.guest_id,
            phone: item.phone,
            concert_id: item.concert_id,
            gate_id: item.gate_id,
            local_scanned_at: item.scanned_at,
          })),
        },
        { headers: authHeaders },
      );

      const resultByClientId = new Map(response.data.results.map((item) => [item.client_item_id, item]));
      setQueue((current) =>
        current.map((item) => {
          const synced = resultByClientId.get(item.client_item_id);
          if (!synced) return item;
          return {
            ...item,
            status: mapSyncStatus(synced.status),
            message: synced.message,
            ticket_id: synced.ticket_id,
            guest_id: synced.guest_id ?? item.guest_id,
          };
        }),
      );
      setStatus(`Offline sync: ${response.data.accepted_item_count} accepted, ${response.data.conflict_item_count} conflicts`);
    });
  }

  function startNewBatch() {
    setState((current) => ({ ...current, batchToken: `batch-${Date.now()}` }));
    setQueue((current) => current.filter((item) => item.status !== "synced"));
    setStatus("New offline batch ready");
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setResult(null);
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
      setQueue((current) => current.map((item) => (item.status === "syncing" ? { ...item, status: "failed" } : item)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="checker-shell">
      <section className="checker-top">
        <div>
          <p className="checker-kicker">TicketBox Checker</p>
          <h1>Gate Console</h1>
        </div>
        <div className="checker-mode" role="tablist" aria-label="Scan mode">
          <button className={mode === "online" ? "active" : ""} onClick={() => setMode("online")} type="button">
            <Wifi size={16} />
            Online
          </button>
          <button className={mode === "offline" ? "active" : ""} onClick={() => setMode("offline")} type="button">
            <WifiOff size={16} />
            Offline
          </button>
        </div>
      </section>

      <section className="checker-toolbar">
        <label>
          Token
          <input value={state.token} onChange={(event) => update("token", event.target.value)} placeholder="Bearer token" />
        </label>
        <label>
          Concert
          <input value={state.concertId} onChange={(event) => update("concertId", event.target.value)} placeholder="concert id" />
        </label>
        <label>
          Gate
          <input value={state.gateId} onChange={(event) => update("gateId", event.target.value)} placeholder="gate id" />
        </label>
        <label>
          Device
          <input value={state.deviceId} onChange={(event) => update("deviceId", event.target.value)} placeholder="device id" />
        </label>
      </section>

      <section className="checker-status" aria-live="polite">
        <div>
          <strong>{busy ? "Working" : status}</strong>
          <span>{preload ? `Snapshot ${preload.snapshot_id}` : "No preload"}</span>
        </div>
        <div className="checker-metrics">
          <span>{queueSummary.pending} pending</span>
          <span>{queueSummary.synced} synced</span>
          <span>{queueSummary.conflicts} conflicts</span>
        </div>
      </section>

      <div className="checker-grid">
        <form className="checker-panel checker-preload" onSubmit={loadPreload}>
          <div className="checker-panel-title">
            <Download size={18} />
            <h2>Preload</h2>
          </div>
          <button className="checker-primary" type="submit" disabled={busy}>
            <Download size={16} />
            Load
          </button>
          <div className="checker-counts">
            <span>{preload?.tickets.length ?? 0} tickets</span>
            <span>{preload?.guests.length ?? 0} guests</span>
          </div>
          <div className="zone-list">
            {(preload?.allowed_seat_zones ?? []).map((zone) => (
              <span key={zone.id}>{zone.code}</span>
            ))}
          </div>
          <small>{preload?.offline?.full_offline_sync_ready ? "Offline sync ready" : "Awaiting preload"}</small>
        </form>

        <form className="checker-panel" onSubmit={scanTicket}>
          <div className="checker-panel-title">
            <QrCode size={18} />
            <h2>Ticket</h2>
          </div>
          <textarea
            value={state.qrPayload}
            onChange={(event) => update("qrPayload", event.target.value)}
            placeholder="QR payload or token"
          />
          <button className="checker-primary" type="submit" disabled={busy}>
            {mode === "online" ? <QrCode size={16} /> : <Clock3 size={16} />}
            {mode === "online" ? "Scan" : "Capture"}
          </button>
        </form>

        <form className="checker-panel" onSubmit={scanGuest}>
          <div className="checker-panel-title">
            <UserCheck size={18} />
            <h2>Guest</h2>
          </div>
          <input value={state.guestId} onChange={(event) => update("guestId", event.target.value)} placeholder="guest id" />
          <input value={state.phone} onChange={(event) => update("phone", event.target.value)} placeholder="phone" />
          <button className="checker-primary" type="submit" disabled={busy}>
            {mode === "online" ? <UserCheck size={16} /> : <Clock3 size={16} />}
            {mode === "online" ? "Scan" : "Capture"}
          </button>
        </form>
      </div>

      <section className={`checker-result ${statusClass(result?.result)}`}>
        <strong>{result?.result ?? "WAITING"}</strong>
        <span>{result?.ticket_id ?? result?.guest_id ?? result?.reason ?? "Scan result appears here"}</span>
        <span>{result?.checked_in_at ?? ""}</span>
      </section>

      <section className="checker-panel checker-queue">
        <div className="checker-panel-title">
          <Clock3 size={18} />
          <h2>Offline Queue</h2>
        </div>
        <label>
          Batch
          <input value={state.batchToken} onChange={(event) => update("batchToken", event.target.value)} placeholder="batch token" />
        </label>
        <div className="checker-actions">
          <button className="checker-primary" type="button" onClick={() => void syncOfflineQueue()} disabled={busy}>
            <RefreshCw size={16} />
            Sync
          </button>
          <button type="button" onClick={() => void syncOfflineQueue(true)} disabled={busy}>
            <RotateCcw size={16} />
            Retry
          </button>
          <button type="button" onClick={startNewBatch} disabled={busy}>
            <CheckCircle2 size={16} />
            New Batch
          </button>
          <button type="button" onClick={() => setQueue([])} disabled={busy || queue.length === 0}>
            <Trash2 size={16} />
            Clear
          </button>
        </div>
        <div className="checker-queue-list">
          {queue.length === 0 ? (
            <div className="checker-empty">No offline scans</div>
          ) : (
            queue.map((item) => (
              <article className="checker-queue-item" key={item.client_item_id}>
                <div>
                  <strong>{item.type}</strong>
                  <span>{item.qr_token ?? item.guest_id ?? item.phone}</span>
                  <small>{new Date(item.scanned_at).toLocaleString()}</small>
                </div>
                <span className={`checker-chip ${statusClass(item.status)}`}>{item.status}</span>
                <small>{item.message}</small>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function loadQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(offlineQueueKey);
    return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

function mapSyncStatus(status: OfflineQueueStatus): OfflineQueueStatus {
  if (status === "SUCCESS") return "synced";
  if (status === "ERROR" || status === "INVALID_TICKET" || status === "INVALID_GUEST") return "failed";
  return "conflict";
}

function statusClass(status: string | undefined) {
  if (!status) return "waiting";
  if (status === "SUCCESS" || status === "synced") return "success";
  if (status === "pending" || status === "syncing" || status === "OFFLINE_PENDING") return "pending";
  if (status === "WRONG_GATE" || status === "ALREADY_CHECKED_IN" || status === "CONFLICT" || status === "DUPLICATE_ITEM" || status === "conflict") {
    return "conflict";
  }
  return "failed";
}
