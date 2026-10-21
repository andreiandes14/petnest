import type { AddressLocation } from "../../../../shared/address-location";

/** Start only from Search Address; abort obsolete replies and back off shared rate limits. */
export function scheduleAddressSearch(request: (signal: AbortSignal) => Promise<{ result: AddressLocation | null }>,
  result: (location: AddressLocation | null) => void, failure: () => void, settled: () => void,
  timers: Pick<typeof globalThis, "setTimeout" | "clearTimeout"> = globalThis) {
  const controller = new AbortController();
  let cancelled = false, retries = 0;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    try {
      const response = await request(controller.signal);
      if (!cancelled) result(response.result);
    } catch (error) {
      if (cancelled) return;
      if (error && typeof error === "object" && "status" in error && error.status === 429 && retries++ < 2) {
        timer = timers.setTimeout(run, 2000 * retries); return;
      }
      failure();
    }
    if (!cancelled) settled();
  };
  timer = timers.setTimeout(run, 0);
  return () => { cancelled = true; controller.abort(); timers.clearTimeout(timer); };
}
