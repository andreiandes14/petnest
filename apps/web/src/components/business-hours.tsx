import { useEffect, useState } from "react";
import { businessTimeOptions, savedBusinessTimes, selectedBusinessHours } from "../../../../shared/business-hours";

export function BusinessHours({ hours, save, saving }: {
  hours: string;
  save: (hours: string) => Promise<unknown>;
  saving: boolean;
}) {
  const [times, setTimes] = useState(() => savedBusinessTimes(hours));
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => { setTimes(savedBusinessTimes(hours)); setMessage(""); setFailed(false); }, [hours]);
  const normalized = selectedBusinessHours(times.opening, times.closing, hours);
  const error = times.opening || times.closing
    ? !times.opening || !times.closing ? "Choose both an opening and closing time."
      : !normalized ? "Closing time must be later than opening time." : ""
    : "";
  return <div className="form-field">
    <h3 className="form-label">Business Hours</h3>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(["opening", "closing"] as const).map(field => {
        const value = times[field];
        // Keep a valid legacy time visible without silently rounding it.
        const legacy = value && !businessTimeOptions.some(option => option.value === value);
        const hour = Number(value.slice(0, 2));
        return <div className="form-field" key={field}>
          <label className="form-label" htmlFor={`provider-${field}-time`}>{field === "opening" ? "Opening Time" : "Closing Time"}</label>
          <select id={`provider-${field}-time`} className="input select" value={value} disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? "provider-hours-error" : undefined} onChange={event => {
            setTimes(current => ({ ...current, [field]: event.target.value })); setMessage(""); setFailed(false);
          }}>
            <option value="">Select time</option>
            {legacy ? <option value={value}>{hour % 12 || 12}:{value.slice(3)} {hour < 12 ? "AM" : "PM"} (saved)</option> : null}
            {businessTimeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>;
      })}
    </div>
    {error ? <p id="provider-hours-error" className="text-xs text-destructive" role="alert">{error}</p> : null}
    <button type="button" className="btn btn-secondary self-start" disabled={saving || !normalized || normalized === hours} onClick={async () => {
      if (!normalized || saving) return;
      try { await save(normalized); setFailed(false); setMessage("Business hours saved."); }
      catch { setFailed(true); setMessage("Business hours could not be saved. Please try again."); }
    }}>{saving ? "Saving..." : "Save Business Hours"}</button>
    {message ? <p className={`text-xs ${failed ? "text-destructive" : "text-muted-foreground"}`} role={failed ? "alert" : "status"}>{message}</p> : null}
  </div>;
}
