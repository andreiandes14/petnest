import * as Dialog from "@radix-ui/react-dialog";

export function RemoveProductDialog({ open, busy, error, onClose, onConfirm }: {
  open: boolean; busy: boolean; error?: string; onClose: () => void; onConfirm: () => void;
}) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="booking-deposit-backdrop" />
      <Dialog.Content className="booking-deposit-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
        <Dialog.Title className="modal-title booking-deposit-title">Remove Pet Supply?</Dialog.Title>
        <div className="booking-deposit-body">
          <Dialog.Description>Are you sure you want to remove this product? It will no longer be available for customers to purchase.</Dialog.Description>
          {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
        <div className="booking-deposit-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>{busy ? "Removing..." : "Remove Product"}</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
