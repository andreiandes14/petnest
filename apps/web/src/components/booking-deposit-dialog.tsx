import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function BookingDepositDialog({ open, onClose, onConfirm, busy, processing, error, children }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  processing: boolean;
  error?: string;
  children: ReactNode;
}) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="booking-deposit-backdrop" />
      <Dialog.Content className="booking-deposit-dialog" aria-describedby={undefined} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
        <Dialog.Title className="modal-title booking-deposit-title">Pay Booking Deposit</Dialog.Title>
        <div className="booking-deposit-body">
          {children}
          {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
        <div className="booking-deposit-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy || processing} onClick={onConfirm}>{busy ? "Preparing payment..." : "Proceed to PayMongo"}</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
