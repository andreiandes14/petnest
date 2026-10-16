import * as Dialog from "@radix-ui/react-dialog";

export function CancelVaccinationDialog({ open, busy, error, onClose, onConfirm }: {
  open: boolean; busy: boolean; error?: string; onClose: () => void; onConfirm: () => void;
}) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="booking-deposit-backdrop" />
      <Dialog.Content className="booking-deposit-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
        <Dialog.Title className="modal-title booking-deposit-title">Mark Vaccination Course as Not Continued?</Dialog.Title>
        <div className="booking-deposit-body">
          <Dialog.Description>Are you sure you want to mark this vaccination course as Not Continued? Use this option if the customer will no longer continue their pet's vaccination schedule with your shop. Previous vaccination records will be preserved.</Dialog.Description>
          {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
        <div className="booking-deposit-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Keep Ongoing</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>{busy ? "Saving…" : "Confirm Not Continued"}</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
