import * as Dialog from "@radix-ui/react-dialog";

export function CompleteOrderDialog({ open, busy, eligible, error, onClose, onConfirm, pickupPayment = false }: {
  open: boolean; busy: boolean; eligible: boolean; error?: string; onClose: () => void; onConfirm: () => void; pickupPayment?: boolean;
}) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="booking-deposit-backdrop" />
      <Dialog.Content className="booking-deposit-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
        <Dialog.Title className="modal-title booking-deposit-title">Complete This Order?</Dialog.Title>
        <div className="booking-deposit-body">
          <Dialog.Description>{pickupPayment ? "Please confirm that you received the full payment directly from the customer and handed over their pet supplies. Once confirmed, this order will be marked as Completed and Paid with Payment Method: Pay Upon Pickup." : "Please confirm that the customer has successfully received or picked up their pet supplies. Once confirmed, this order will be marked as Completed."}</Dialog.Description>
          {!eligible ? <p className="mt-3 text-sm" role="status">This order is no longer eligible for completion. Please refresh the orders.</p> : null}
          {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
        <div className="booking-deposit-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy || !eligible} onClick={onConfirm}>{busy ? "Saving..." : "Confirm Completion"}</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
