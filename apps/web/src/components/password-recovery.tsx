import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/api-request";

export function PasswordRecovery() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(""), [answer, setAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const sending = useRef(false);
  const close = () => { if (sending.current) return; setOpen(false); setEmail(""); setAnswer(""); setPassword(""); setShow(false); setMessage(""); setError(""); };
  return <>
    <button type="button" className="mt-2 text-sm font-semibold text-primary hover:underline" onClick={() => setOpen(true)}>Forgot Password?</button>
    <Dialog.Root open={open} onOpenChange={value => { if (!value) close(); }}>
      <Dialog.Portal><Dialog.Overlay className="booking-deposit-backdrop reset-password-backdrop" />
        <Dialog.Content className="booking-deposit-dialog reset-password-dialog" onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
          <Dialog.Title className="modal-title reset-password-title">Reset Password</Dialog.Title>
          <Dialog.Description className="reset-password-description">Enter your email and answer the security question. Answer is case-insensitive. After 5 failed attempts, you will be locked out for 1 hour.</Dialog.Description>
          <form className="reset-password-form" onSubmit={async event => {
            event.preventDefault(); event.stopPropagation(); if (sending.current) return;
            sending.current = true; setBusy(true); setError(""); setMessage("");
            try {
              const result = await apiRequest<{ message: string }>("/api/auth/password-recovery/reset", { method: "POST", body: JSON.stringify({ email, answer, newPassword: password }) });
              setMessage(result.message);
              setPassword(""); setAnswer(""); setShow(false);
            } catch (failure) { setError(failure instanceof Error ? failure.message : "Recovery could not be completed. Please try again."); }
            finally { sending.current = false; setBusy(false); }
          }}>
            <label className="form-field"><span className="form-label">Email</span><input type="email" autoComplete="email" className="input" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
            <label className="form-field"><span className="form-label">Who is your favorite person?</span><input className="input" type="password" autoComplete="off" required maxLength={200} value={answer} disabled={busy} onChange={event => setAnswer(event.target.value)} /></label>
            <label className="form-field"><span className="form-label">New Password</span><div className="relative"><input id="recovery-password" className="input pr-12" autoComplete="new-password" type={show ? "text" : "password"} required minLength={8} maxLength={1024} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /><button type="button" className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-muted-foreground" aria-label={show ? "Hide password" : "Show password"} aria-controls="recovery-password" aria-pressed={show} onClick={() => setShow(value => !value)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {message ? <p className="text-sm" role="status">{message}</p> : null}
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <div className="reset-password-actions"><button type="button" className="btn reset-password-cancel" disabled={busy} onClick={close}>Cancel</button><button type="submit" className="btn btn-primary reset-password-submit" disabled={busy}>{busy ? "Please wait..." : "Reset Password"}</button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}

export function SecurityQuestionSettings() {
  const [answer, setAnswer] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const saving = useRef(false);
  return <section className="surface-card mt-6 p-5"><h2 className="section-title">Security Question</h2><p className="mt-2 text-sm text-muted-foreground">Set or change your security-question answer for password recovery.</p>
    <form className="mt-4 space-y-3" onSubmit={async event => {
      event.preventDefault(); if (saving.current) return; saving.current = true; setBusy(true); setMessage("");
      try { await apiRequest("/api/auth/security-question", { method: "POST", body: JSON.stringify({ answer, currentPassword: password }) }); setMessage("Security question saved."); setAnswer(""); setPassword(""); }
      catch { setMessage("Security question could not be saved. Check your current password and try again."); }
      finally { saving.current = false; setBusy(false); }
    }}>
      <label className="form-field"><span className="form-label">Current Password</span><input className="input" type="password" autoComplete="current-password" required maxLength={1024} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
      <label className="form-field"><span className="form-label">Who is your favorite person? — Your Answer</span><input className="input" type="password" autoComplete="off" required maxLength={200} value={answer} disabled={busy} onChange={event => setAnswer(event.target.value)} /></label>
      <button className="btn btn-secondary" disabled={busy || !answer.trim()}>{busy ? "Saving..." : "Save Security Question"}</button>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </form>
  </section>;
}
