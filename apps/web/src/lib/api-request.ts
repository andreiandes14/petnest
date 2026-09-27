type ApiErrorBody = {
  error?: unknown;
};

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";
const CONNECTION_ERROR_MESSAGE =
  "We couldn't connect to PetNest. Please try again.";

export class ApiRequestError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function apiErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const error = (body as ApiErrorBody).error;
  return typeof error === "string" && error.trim() ? error : undefined;
}

function reportUnexpectedResponse(
  url: string,
  response: Response,
  detail: unknown,
) {
  if (!import.meta.env.DEV) return;
  console.error("Unexpected API response", {
    url,
    status: response.status,
    contentType: response.headers.get("content-type"),
    detail,
  });
}

export async function apiRequest<T>(
  url: string,
  init: RequestInit = {},
  fallbackMessage = DEFAULT_ERROR_MESSAGE,
): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      headers,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (import.meta.env.DEV) console.error("API request failed", { url, error });
    throw new ApiRequestError(CONNECTION_ERROR_MESSAGE);
  }

  if (response.status === 204 || response.status === 205) {
    if (!response.ok)
      throw new ApiRequestError(fallbackMessage, response.status);
    return undefined as T;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    !contentType.includes("application/json") &&
    !contentType.includes("+json")
  ) {
    const preview = (await response.text().catch(() => "")).slice(0, 200);
    reportUnexpectedResponse(url, response, preview);
    throw new ApiRequestError(fallbackMessage, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    reportUnexpectedResponse(url, response, error);
    throw new ApiRequestError(fallbackMessage, response.status);
  }

  if (!response.ok) {
    throw new ApiRequestError(
      response.status >= 500 ? fallbackMessage : apiErrorMessage(body) ?? fallbackMessage,
      response.status,
    );
  }

  return body as T;
}
