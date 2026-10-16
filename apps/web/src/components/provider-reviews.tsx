import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Star, X } from "lucide-react";
import { apiRequest } from "@/lib/api-request";

type Review = { id: string; rating: number; date: string; customerName: string; comment?: string;
  serviceCategory: "grooming" | "vaccination" | null };
type Reviews = { providerName: string; averageRating: number; reviewCount: number; reviews: Review[] };

export function ProviderReviews({ providerId, providerName }: { providerId: number; providerName: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ["public-provider-reviews", providerId],
    queryFn: () => apiRequest<Reviews>(`/api/providers/${providerId}/reviews`), enabled: open, refetchInterval: open ? 15000 : false });
  return <>
    <button type="button" className="btn btn-ghost shrink-0 border border-primary/25 bg-background hover:bg-primary/5" onClick={() => setOpen(true)}>
      <Star size={16} aria-hidden="true" /> View Reviews
    </button>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="booking-deposit-backdrop" />
        <Dialog.Content className="booking-deposit-dialog">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <Dialog.Title className="modal-title booking-deposit-title break-words">{query.data?.providerName ?? providerName}</Dialog.Title>
            <Dialog.Close className="btn btn-ghost btn-icon shrink-0" aria-label="Close reviews"><X size={18} /></Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 shrink-0 text-sm text-muted-foreground">Customer reviews from completed services.</Dialog.Description>
          <div className="booking-deposit-body">
            {query.isLoading ? <p role="status">Loading reviews...</p> : query.isError ? <div role="alert"><p>{query.error.message}</p><button type="button" className="btn btn-ghost mt-3" onClick={() => query.refetch()}>Try again</button></div> : query.data ? <>
              <p className="mb-4 flex items-center gap-2 font-semibold"><Star size={16} className="text-primary" aria-hidden="true" /> {query.data.averageRating.toFixed(1)} out of 5 · {query.data.reviewCount} {query.data.reviewCount === 1 ? "review" : "reviews"}</p>
              {!query.data.reviews.length ? <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
                <h3 className="font-semibold">No Reviews Yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">This pet shop hasn't received any customer reviews yet. Be the first to share your experience after completing a service!</p>
              </div> : <ul className="space-y-4">{query.data.reviews.map(review => <li key={review.id} className="rounded-2xl border border-primary/20 bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{review.customerName}</h3>
                  <span className="inline-flex items-center gap-1 text-sm" aria-label={`${review.rating} out of 5 stars`}><Star size={14} className="text-primary" fill="currentColor" aria-hidden="true" />{review.rating}/5</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground"><time dateTime={review.date}>{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(review.date))}</time> · {review.serviceCategory === "grooming" ? "Grooming" : review.serviceCategory === "vaccination" ? "Vaccination" : "Service unavailable"}</p>
                {review.comment ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{review.comment}</p> : null}
              </li>)}</ul>}
            </> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
