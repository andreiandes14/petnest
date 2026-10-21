import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { apiRequest } from "@/lib/api-request";
import { getListProvidersQueryKey, getGetProviderQueryKey } from "@workspace/api-client-react";
type EligibleBooking = { bookingId: number; providerId: number; serviceName: string; date: string; reviewed?: boolean };

export function ProviderReviewButton({ providerId, customerId, bookingId: targetBookingId, providerName }: { providerId: number; customerId?: string; bookingId?: number; providerName?: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const requestInFlight = useRef(false);
  const key = targetBookingId === undefined ? ["review-eligibility", customerId] : ["review-eligibility", customerId, "history"];
  const eligibility = useQuery({ queryKey: key, queryFn: () => apiRequest<EligibleBooking[]>(`/api/reviews/eligibility${targetBookingId === undefined ? "" : "?includeReviewed=1"}`),
    enabled: !!customerId, refetchInterval: customerId ? 15000 : false });
  const associated = (eligibility.data ?? []).filter(b => b.providerId === providerId && (targetBookingId === undefined || b.bookingId === targetBookingId));
  const alreadyReviewed = targetBookingId !== undefined && associated.some(b => b.reviewed);
  const bookings = associated.filter(b => !b.reviewed);
  const bookingId = bookings.some(b => b.bookingId === selected) ? selected : bookings[0]?.bookingId;
  const save = useMutation({ mutationFn: (reviewedBookingId: number) => apiRequest(`/api/providers/${providerId}/reviews`, {
    method: "POST", body: JSON.stringify({ bookingId: reviewedBookingId, rating: Number(rating), comment }),
  }), onSuccess: async (_result, reviewedBookingId) => {
    client.setQueryData<EligibleBooking[]>(key, (current = []) => targetBookingId === undefined ? current.filter(b => b.bookingId !== reviewedBookingId) : current.map(b => b.bookingId === reviewedBookingId ? { ...b, reviewed: true } : b));
    setOpen(false); setSelected(0); setRating(""); setComment("");
    await Promise.all([client.invalidateQueries({ queryKey: ["review-eligibility", customerId] }), client.invalidateQueries({ queryKey: getListProvidersQueryKey() }),
      client.invalidateQueries({ queryKey: getGetProviderQueryKey(providerId) }), client.invalidateQueries({ queryKey: ["public-provider-reviews", providerId] })]);
  }, onError: () => { void client.invalidateQueries({ queryKey: ["review-eligibility", customerId] }); },
  onSettled: () => { requestInFlight.current = false; } });
  if (!customerId || eligibility.isError) return null;
  if (alreadyReviewed) return <span className="text-xs font-semibold text-muted-foreground">Reviewed</span>;
  if (!bookings.length) return null;
  return <>
    <button type="button" className="btn btn-secondary h-9 min-h-0 px-3 text-xs" onClick={() => { save.reset(); setOpen(true); }}>Add a Review</button>
    <Dialog.Root open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="booking-deposit-backdrop" />
        <Dialog.Content className="booking-deposit-dialog" onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (save.isPending) event.preventDefault(); }}>
          <Dialog.Title className="modal-title booking-deposit-title">Add a Review</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">{providerName ? `Review your completed service with ${providerName}.` : "Review one completed appointment with this provider."}</Dialog.Description>
          <form className="booking-deposit-body" onSubmit={event => {
            event.preventDefault();
            if (requestInFlight.current || save.isPending || !bookingId || !bookings.some(b => b.bookingId === bookingId) || !rating || !comment.trim()) return;
            requestInFlight.current = true;
            save.mutate(bookingId);
          }}>
            <label className="form-field"><span className="form-label">Completed booking</span>
              <select className="input select" value={bookingId} disabled={save.isPending || targetBookingId !== undefined} onChange={event => setSelected(Number(event.target.value))}>
                {bookings.map(b => <option key={b.bookingId} value={b.bookingId}>{b.serviceName} · {b.date} · Booking #{b.bookingId}</option>)}
              </select>
            </label>
            <label className="form-field mt-3"><span className="form-label">Rating</span>
              <select className="input select" value={rating} required disabled={save.isPending} onChange={event => setRating(event.target.value)}>
                <option value="">Choose a rating</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n === 1 ? "star" : "stars"}</option>)}
              </select>
            </label>
            <label className="form-field mt-3"><span className="form-label">Your review</span><textarea className="input h-24 py-3" required maxLength={1000} value={comment} disabled={save.isPending} onChange={event => setComment(event.target.value)} /></label>
            {save.isError ? <p className="mt-3 text-sm text-destructive" role="alert">{save.error.message}</p> : null}
            <div className="booking-deposit-actions">
              <button type="button" className="btn btn-ghost" disabled={save.isPending} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={save.isPending || !rating || !comment.trim()}>{save.isPending ? "Saving..." : "Submit Review"}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
