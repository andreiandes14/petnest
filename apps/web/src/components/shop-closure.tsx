import { useEffect, useState } from "react";
import { shopClosed } from "../../../../shared/shop-closure";
export function useShopClosed(closedUntil?: string | null) {
  const [closed, setClosed] = useState(() => shopClosed({ closedUntil }));
  useEffect(() => {
    const active = shopClosed({ closedUntil });
    setClosed(active);
    if (!active || !closedUntil) return;
    const timer = window.setTimeout(() => setClosed(false), Math.min(Date.parse(closedUntil) - Date.now() + 50, 2147483647));
    return () => window.clearTimeout(timer);
  }, [closedUntil]);
  return closed;
}
export function ShopClosureControl({ closedUntil, save }: { closedUntil?: string | null; save: (closed: boolean) => Promise<unknown> }) {
  const closed = useShopClosed(closedUntil);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <section className="surface-card mt-6 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className={`status ${closed ? "status-cancelled" : "status-completed"}`}>{closed ? "Closed for Today" : "Shop Open"}</span>
      <button type="button" className="btn btn-secondary" disabled={saving} onClick={async () => {
        setError("");
        if (!closed) { setConfirming(true); return; }
        setSaving(true);
        try { await save(false); } catch { setError("The shop status could not be saved. Please try again."); } finally { setSaving(false); }
      }}>{closed ? "Reopen Shop" : "Close for Today"}</button>
    </div>
    {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
    {confirming ? <div className="modal-backdrop" role="presentation"><div className="modal animate-in" role="dialog" aria-modal="true" aria-labelledby="shop-closure-title">
      <h2 id="shop-closure-title" className="modal-title">Close for Today?</h2>
      <p className="mt-3 text-sm">New bookings and orders will be paused until midnight in Philippine time. You can continue managing existing records and reopen your shop earlier.</p>
      {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={async () => {
          if (saving) return;
          setSaving(true); setError("");
          try { await save(true); setConfirming(false); } catch { setError("The shop status could not be saved. Please try again."); } finally { setSaving(false); }
        }}>{saving ? "Saving..." : "Confirm Closure"}</button>
      </div>
    </div></div> : null}
  </section>;
}
