import { useMemo, useState, type SyntheticEvent } from "react";
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
  allowed_seat_zones: Array<{ id: string; code: string; name: string }>;
  tickets: unknown[];
  guests: unknown[];
};

type CheckerState = {
  token: string;
  concertId: string;
  gateId: string;
  deviceId: string;
  qrPayload: string;
  guestId: string;
  phone: string;
};

const initialState: CheckerState = {
  token: "",
  concertId: "",
  gateId: "",
  deviceId: "",
  qrPayload: "",
  guestId: "",
  phone: ""
};

export function CheckerPage() {
  const [state, setState] = useState(initialState);
  const [preload, setPreload] = useState<PreloadData | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const token = state.token.trim();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [state.token]);

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
        include_guests: "true"
      });
      const response = await apiGet<ApiResponse<PreloadData>>(`/check-in/preload?${query}`, { headers: authHeaders });
      setPreload(response.data);
      setStatus(`Preloaded ${response.data.tickets.length} tickets and ${response.data.guests.length} guests`);
    });
  }

  async function scanTicket(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    await run(async () => {
      const response = await apiPost<ApiResponse<ScanResult>>(
        "/check-in/scans",
        {
          concert_id: state.concertId,
          gate_id: state.gateId,
          device_id: state.deviceId,
          qr_payload: state.qrPayload,
          scanned_at: new Date().toISOString()
        },
        { headers: authHeaders }
      );
      setResult(response.data);
      setStatus(`Ticket scan: ${response.data.result}`);
    });
  }

  async function scanGuest(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    await run(async () => {
      const response = await apiPost<ApiResponse<ScanResult>>(
        "/check-in/guests/scans",
        {
          concert_id: state.concertId,
          gate_id: state.gateId,
          device_id: state.deviceId,
          guest_id: state.guestId || undefined,
          phone: state.phone || undefined,
          scanned_at: new Date().toISOString()
        },
        { headers: authHeaders }
      );
      setResult(response.data);
      setStatus(`Guest scan: ${response.data.result}`);
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setResult(null);
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="checker-shell">
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

      <section className="checker-status">
        <strong>{busy ? "Working" : status}</strong>
        <span>{preload ? `Snapshot ${preload.snapshot_id}` : "No preload"}</span>
      </section>

      <div className="checker-grid">
        <form className="checker-panel" onSubmit={loadPreload}>
          <h1>Checker</h1>
          <button type="submit" disabled={busy}>
            Preload
          </button>
          <div className="zone-list">
            {(preload?.allowed_seat_zones ?? []).map((zone) => (
              <span key={zone.id}>{zone.code}</span>
            ))}
          </div>
        </form>

        <form className="checker-panel" onSubmit={scanTicket}>
          <h2>Ticket</h2>
          <textarea
            value={state.qrPayload}
            onChange={(event) => update("qrPayload", event.target.value)}
            placeholder="QR payload or token"
          />
          <button type="submit" disabled={busy}>
            Scan Ticket
          </button>
        </form>

        <form className="checker-panel" onSubmit={scanGuest}>
          <h2>Guest</h2>
          <input value={state.guestId} onChange={(event) => update("guestId", event.target.value)} placeholder="guest id" />
          <input value={state.phone} onChange={(event) => update("phone", event.target.value)} placeholder="phone" />
          <button type="submit" disabled={busy}>
            Scan Guest
          </button>
        </form>
      </div>

      <section className={`checker-result ${result?.result ?? ""}`}>
        <strong>{result?.result ?? "WAITING"}</strong>
        <span>{result?.ticket_id ?? result?.guest_id ?? result?.reason ?? "Scan result appears here"}</span>
        <span>{result?.checked_in_at ?? ""}</span>
      </section>
    </main>
  );
}
