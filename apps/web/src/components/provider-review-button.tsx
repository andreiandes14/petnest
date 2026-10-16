import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { apiRequest } from "@/lib/api-request";
import { getListProvidersQueryKey, getGetProviderQueryKey } from "@workspace/api-client-react";
type EligibleBooking = { bookingId: number; providerId: number; serviceName: string; date: string };

export function ProviderReviewButton({ providerId, customerId }: { providerId: number; customerId?: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const key = ["review-eligibility", customerId];
  const eligibility = useQuery({ queryKey: key, queryFn: () => apiRequest<EligibleBooking[]>("/api/reviews/eligibility"),
    enabled: !!customerId, refetchInterval: customerId ? 15000 : false });
  const bookings = (eligibility.data ?? []).filter(b => b.providerId === providerId);
  const bookingId = bookings.some(b => b.bookingId === selected) ? selected : bookings[0]?.bookingId;
  const save = useMutation({ mutationFn: () => apiRequest(`/api/providers/${providerId}/reviews`, {
    method: "POST", body: JSON.stringify({ bookingId, rating: Number(rating), comment }),
  }), onSuccess: async () => {
    setOpen(false); setSelected(0); setRating(""); setComment("");
    await Promise.all([client.invalidateQueries({ queryKey: key }), client.invalidateQueries({ queryKey: getListProvidersQueryKey() }),
      client.invalidateQueries({ queryKey: getGetProviderQueryKey(providerId) })]);
  }, onError: () => { void client.invalidateQueries({ queryKey: key }); } });
  if (!customerId || eligibility.isError || !bookings.length) return null;
  return <>
    <button type="button" className="btn btn-secondary h-9 min-h-0 px-3 text-xs" onClick={() => { save.reset(); setOpen(true); }}>Add a Review</button>
    <Dialog.Root open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="booking-deposit-backdrop" />
        <Dialog.Content className="booking-deposit-dialog" onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (save.isPending) event.preventDefault(); }}>
          <Dialog.Title className="modal-title booking-deposit-title">Add a Review</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">Review one completed appointment with this provider.</Dialog.Description>
          <form className="booking-deposit-body" onSubmit={event => { event.preventDefault(); if (!save.isPending && bookingId && rating && comment.trim()) save.mutate(); }}>
            <label className="form-field"><span className="form-label">Completed booking</span>
              <select className="input select" value={bookingId} disabled={save.isPending} onChange={event => setSelected(Number(event.target.value))}>
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
