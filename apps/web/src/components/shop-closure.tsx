import { useEffect, useState } from "react";
import { shopClosed, scheduledClosed, nextManilaMidnight } from "../../../../shared/shop-closure";
export function useShopClosed(closedUntil?: string | null, operatingDays?: number[]) {
  const [closed, setClosed] = useState(() => ({ value: shopClosed({ closedUntil, operatingDays }) }));
  const daysKey = operatingDays?.join(",");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = Date.now();
      setClosed({ value: shopClosed({ closedUntil, operatingDays }, now) });
      const manual = closedUntil ? Date.parse(closedUntil) : Infinity;
      const next = Math.min(Date.parse(nextManilaMidnight(now)), manual > now ? manual : Infinity);
      timer = setTimeout(refresh, Math.max(50, next - now + 50));
    };
    refresh();
    return () => clearTimeout(timer);
  }, [closedUntil, daysKey]);
  return closed.value;
}
export function ShopClosureControl({ closedUntil, operatingDays, save }: { closedUntil?: string | null; operatingDays?: number[]; save: (closed: boolean) => Promise<unknown> }) {
  const closed = useShopClosed(closedUntil, operatingDays);
  const scheduled = closed && scheduledClosed({ operatingDays });
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <section className="surface-card mt-6 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className={`status ${closed ? "status-cancelled" : "status-completed"}`}>{closed ? "Closed for Today" : "Shop Open"}</span>
      <button type="button" className="btn btn-secondary" disabled={saving || scheduled} onClick={async () => {
        setError("");
        if (!closed) { setConfirming(true); return; }
        setSaving(true);
        try { await save(false); } catch { setError("The shop status could not be saved. Please try again."); } finally { setSaving(false); }
      }}>{closed ? "Reopen Shop" : "Close for Today"}</button>
    </div>
    {scheduled ? <p className="mt-3 text-sm text-muted-foreground">Closed by your Days of Operation. Update your schedule to open today.</p> : null}
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
