import * as Dialog from "@radix-ui/react-dialog";

export function NoShowDialog({ open, busy, eligible, explanation, error, onClose, onConfirm, completeService = false }: {
  completeService?: boolean; open: boolean; busy: boolean; eligible: boolean; explanation?: string; error?: string;
  onClose: () => void; onConfirm: () => void;
}) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="booking-deposit-backdrop" />
      <Dialog.Content className="booking-deposit-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
        <Dialog.Title className="modal-title booking-deposit-title">{completeService ? "Complete Service?" : "Mark Customer as No-Show?"}</Dialog.Title>
        <div className="booking-deposit-body">
          <Dialog.Description>{completeService ? "Confirm that this service was performed. The paid booking deposit is credited toward the service price. The remaining balance is payable directly to the provider and is not automatically marked as collected." : "Are you sure this customer did not attend their scheduled appointment? Confirming a No-Show will forfeit the ?50 booking deposit, which will be retained by the provider in accordance with the booking policy."}</Dialog.Description>
          {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
          {!eligible ? <p className="mt-3 text-sm" role="status">{explanation}</p> : null}
        </div>
        <div className="booking-deposit-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy || !eligible} onClick={onConfirm}>{busy ? "Saving…" : (completeService ? "Confirm Completion" : "Confirm No-Show")}</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
