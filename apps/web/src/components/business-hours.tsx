import { defaultOperatingDays } from "../../../../shared/shop-closure";
import { useEffect, useState } from "react";
import { businessTimeOptions, savedBusinessTimes, selectedBusinessHours } from "../../../../shared/business-hours";

export function BusinessHours({ hours, isOpen24Hours = false, operatingDays, save, saving }: {
  hours: string;
  isOpen24Hours?: boolean;
  operatingDays?: number[];
  save: (hours: string, isOpen24Hours: boolean, operatingDays: number[]) => Promise<unknown>;
  saving: boolean;
}) {
  const [times, setTimes] = useState(() => savedBusinessTimes(hours));
  const [days, setDays] = useState(() => operatingDays ?? defaultOperatingDays);
  const daysKey = operatingDays?.join(",");
  const [open24, setOpen24] = useState(isOpen24Hours);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => { setTimes(savedBusinessTimes(hours)); setOpen24(isOpen24Hours); setDays(operatingDays ?? defaultOperatingDays); setMessage(""); setFailed(false); }, [hours, isOpen24Hours, daysKey]);
  const normalized = selectedBusinessHours(times.opening, times.closing, hours);
  const error = !open24 && (times.opening || times.closing)
    ? !times.opening || !times.closing ? "Choose both an opening and closing time."
      : !normalized ? "Closing time must be later than opening time." : ""
    : "";
  return <div className="form-field">
    <h3 className="form-label">Business Hours</h3>
    <label className="form-label" htmlFor="provider-hours-mode">Operating Hours</label>
    <select id="provider-hours-mode" className="input select" disabled={saving} value={open24 ? "24" : "custom"} onChange={event => { setOpen24(event.target.value === "24"); setMessage(""); }}>
      <option value="custom">Custom Hours</option><option value="24">24 Hours Open</option>
    </select>
    {open24 ? <p className="text-sm font-semibold">Open 24 Hours</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
    </div>}
    <fieldset className="mt-3">
      <legend className="form-label">Days of Operation</legend>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[[1,"Monday"],[2,"Tuesday"],[3,"Wednesday"],[4,"Thursday"],[5,"Friday"],[6,"Saturday"],[0,"Sunday"]].map(([value, label]) => {
          const day = Number(value);
          return <label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-purple-600" checked={days.includes(day)} disabled={saving} onChange={event => { setDays(current => event.target.checked ? [...current, day].sort() : current.filter(item => item !== day)); setMessage(""); }} />{label}</label>;
        })}
      </div>
      {!days.length ? <p className="mt-2 text-xs text-destructive" role="alert">Select at least one operating day.</p> : null}
    </fieldset>
    {error ? <p id="provider-hours-error" className="text-xs text-destructive" role="alert">{error}</p> : null}
    <button type="button" className="btn btn-secondary self-start" disabled={saving || !days.length || (!open24 && !normalized) || (open24 === isOpen24Hours && (open24 || normalized === hours) && [...days].sort().join() === [...(operatingDays ?? defaultOperatingDays)].sort().join())} onClick={async () => {
      if ((!open24 && !normalized) || !days.length || saving) return;
      try { await save(open24 ? hours : normalized!, open24, days); setFailed(false); setMessage("Business hours saved."); }
      catch { setFailed(true); setMessage("Business hours could not be saved. Please try again."); }
    }}>{saving ? "Saving..." : "Save Business Hours"}</button>
    {message ? <p className={`text-xs ${failed ? "text-destructive" : "text-muted-foreground"}`} role={failed ? "alert" : "status"}>{message}</p> : null}
  </div>;
}
