import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import {
  useCreateBooking,
  useCreateOrder,
  useCreatePet,
  useGetDashboardSummary,
  useGetPetRecords,
  useGetProvider,
  useHealthCheck,
  useListBookings,
  useListOrders,
  useListPets,
  useListProviders,
  useUpdatePet,
  getGetPetRecordsQueryKey,
  getGetProviderQueryKey,
  getListBookingsQueryKey,
  getListOrdersQueryKey,
  getListPetsQueryKey,
  getListProvidersQueryKey,
  getGetDashboardSummaryQueryKey,
  getHealthCheckQueryKey,
} from "@workspace/api-client-react";
import type {
  CareRecord,
  Booking,
  Pet,
  Provider,
  ProviderDetail,
  ProviderProduct,
  ProviderService,
} from "@workspace/api-client-react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Heart,
  House,
  MapPin,
  Package,
  PawPrint,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Syringe,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  Link,
  Redirect,
  Route,
  Switch,
  useLocation,
  useParams,
  useSearch,
  Router as WouterRouter,
} from "wouter";

const queryClient = new QueryClient();
const presentationMode = false;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
type UserRole = "customer" | "provider" | "admin";
type AuthUser = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  providerId?: number;
};
type AuthState = {
  user: AuthUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
};
const AuthContext = createContext<AuthState | undefined>(undefined);

function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch(`${basePath}/api/auth/me`, { credentials: "same-origin" })
      .then(async (response) =>
        response.ok ? (response.json() as Promise<{ user: AuthUser }>) : null,
      )
      .then((body) => setUser(body?.user ?? null))
      .finally(() => setLoaded(true));
  }, []);
  return (
    <AuthContext.Provider
      value={{ user, isLoaded, isSignedIn: Boolean(user), setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
const categoryMeta = {
  grooming: {
    label: "Grooming",
    icon: Sparkles,
    copy: "Fresh cuts, calm baths, happy tails.",
  },
  vaccination: {
    label: "Vaccination",
    icon: Syringe,
    copy: "Keep their care plan on track.",
  },
  "pet-supplies": {
    label: "Pet supplies",
    icon: ShoppingBag,
    copy: "Good essentials from people who know pets.",
  },
} as const;

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function money(value?: number) {
  return typeof value === "number" ? `₱${value.toFixed(2)}` : "—";
}

function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    cancellation_pending: "Cancellation Pending",
    cancelled: "Cancelled",
    completed: "Completed",
  };
  return (
    labels[value.toLowerCase()] ??
    (value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value)
  );
}

/** Two-tone wordmark. Colour is swapped by CSS when it sits on the sidebar. */
function BrandWord({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-word ${className}`}>
      <span className="brand-word-a">Pet</span>
      <span className="brand-word-b">Nest</span>
    </span>
  );
}

function BrandLockup({ size = 38 }: { size?: number }) {
  return (
    <span className="brand-mark">
      <span
        className="brand-mark-badge"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <PawPrint size={Math.round(size * 0.53)} />
      </span>
      <BrandWord />
    </span>
  );
}

/** Round social buttons shown under the auth forms, matching the design. */
function SocialRow() {
  return (
    <div className="social-row">
      <button
        type="button"
        className="social-btn"
        aria-label="Continue with Google"
        title="Google sign-in is not connected yet"
        disabled
      >
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 5-.9 6.7-2.3l-3.2-2.5c-.9.6-2 1-3.5 1a6 6 0 0 1-5.6-4.1l-3.3 2.6A10 10 0 0 0 12 22"
          />
          <path
            fill="#FBBC05"
            d="M6.4 14.1a6 6 0 0 1 0-3.8L3.1 7.7a10 10 0 0 0 0 8.6z"
          />
          <path
            fill="#4285F4"
            d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.7l3.3 2.6A6 6 0 0 1 12 5.9"
          />
        </svg>
      </button>
      <button
        type="button"
        className="social-btn"
        aria-label="Continue with Facebook"
        title="Facebook sign-in is not connected yet"
        disabled
      >
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
          <path
            fill="#1877F2"
            d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12"
          />
        </svg>
      </button>
    </div>
  );
}

function LoadingState({
  label = "Gathering your pet-care options",
}: {
  label?: string;
}) {
  return (
    <div className="surface-card p-6" data-testid="state-loading">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton mt-4 h-4 w-72 max-w-full" />
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div className="skeleton h-28" key={item} />
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ErrorState({
  onRetry,
  message = "We could not load this just now.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div className="error-state" data-testid="state-error">
      <div className="flex items-start gap-3">
        <CircleHelp size={19} className="mt-0.5 text-destructive" />
        <div>
          <p className="font-semibold">{message}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick retry usually gets things moving again.
          </p>
          <button
            className="btn btn-ghost mt-4"
            onClick={onRetry}
            data-testid="button-retry"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon = PawPrint,
  title,
  copy,
  action,
}: {
  icon?: typeof PawPrint;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" data-testid="state-empty">
      <div className="empty-icon">
        <Icon size={23} />
      </div>
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {copy}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const navItems = [
  { href: "/", label: "Discover", icon: House },
  { href: "/providers", label: "Providers", icon: MapPin },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/pets", label: "My pets", icon: PawPrint },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/account", label: "Account", icon: UserRound },
];
const visibleNavItems = presentationMode
  ? navItems.filter(({ href }) => href !== "/orders" && href !== "/account")
  : navItems;
const visibleCategories = Object.entries(categoryMeta);

function AppShell({ children }: { children: ReactNode }) {
  const { isSignedIn, user } = useAuth();
  const role = user?.role;
  const shellNavItems = !isSignedIn
    ? visibleNavItems.filter(({ href }) => href === "/")
    : role === "admin"
      ? [
          { href: "/admin/providers", label: "Providers", icon: ShieldCheck },
          { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
        ]
      : role === "provider"
        ? [{ href: "/provider", label: "Provider", icon: Pencil }]
        : [
            ...visibleNavItems,
            { href: "/profile", label: "Profile", icon: UserRound },
          ];
  const [location] = useLocation();
  const pathname = location.split("?")[0];
  const activePath = pathname.startsWith("/admin/")
    ? "/admin/bookings"
    : pathname === "/"
      ? "/"
      : `/${pathname.split("/")[1]}`;
  return (
    <div
      className={`petnest-app ${presentationMode ? "presentation-mode" : ""}`}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/" className="brand-mark" data-testid="link-brand">
            <span className="brand-mark-badge">
              <PawPrint size={20} />
            </span>
            <BrandWord />
          </Link>
          <p className="sidebar-tagline">The softer place to care for them.</p>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {shellNavItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${activePath === href ? "active" : ""}`}
                data-testid={`link-nav-${label.toLowerCase().replace(" ", "-")}`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          {!presentationMode ? (
            <div className="sidebar-footer">
              <Show when="signed-in">
                <div className="mb-4 flex items-center gap-3">
                  <div className="sidebar-user-avatar">
                    {initials(user?.name ?? "Pet parent")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {user?.name ?? "Pet parent"}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      Pet parent
                    </p>
                  </div>
                </div>
              </Show>
              <Show when="signed-out">
                <div className="sidebar-promo">
                  <p className="font-display text-base leading-tight">
                    Keep your care history close.
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 opacity-75">
                    Sign in to save pets, visits, and orders.
                  </p>
                  <Link
                    href="/sign-in"
                    className="btn btn-primary mt-4 h-10 min-h-0 w-full text-xs"
                    data-testid="link-sidebar-sign-in"
                  >
                    Sign in <ArrowRight size={13} />
                  </Link>
                </div>
              </Show>
            </div>
          ) : null}
        </aside>
        <main className="main-shell">
          <header className="topbar">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <PawPrint size={14} className="text-primary" /> Local pet care
            </div>
            <div className="ml-auto flex items-center gap-2">
              {isSignedIn && role !== "admin" && role !== "provider" ? (
                <Link
                  href="/pets"
                  className="btn btn-ghost hidden sm:inline-flex"
                  data-testid="link-top-pets"
                >
                  <PawPrint size={15} /> My pets
                </Link>
              ) : null}
              {!presentationMode ? (
                <Link
                  href="/account"
                  className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-secondary-foreground"
                  data-testid="link-top-account"
                >
                  AR
                </Link>
              ) : null}
              {isSignedIn ? (
                <LogoutButton />
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="btn btn-ghost"
                    data-testid="link-top-sign-in"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="btn btn-primary"
                    data-testid="link-top-sign-up"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </header>
          <div className="main-content">{children}</div>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {shellNavItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={activePath === href ? "active" : ""}
            data-testid={`link-mobile-${label.toLowerCase().replace(" ", "-")}`}
          >
            <Icon />
            <span>{label === "Discover" ? "Home" : label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function HeroSearch() {
  const [, setLocation] = useLocation();
  const [value, setValue] = useState("");
  return (
    <form
      className="search-pill mt-8 max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        setLocation(
          `/providers${value ? `?search=${encodeURIComponent(value)}` : ""}`,
        );
      }}
    >
      <Search size={18} className="ml-3 shrink-0 text-muted-foreground" />
      <input
        className="input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search care or a provider"
        aria-label="Search providers"
        data-testid="input-home-search"
      />
      <button
        className="btn btn-primary"
        type="submit"
        data-testid="button-home-search"
      >
        Find care <ArrowRight size={15} />
      </button>
    </form>
  );
}

function ProviderCard({ provider }: { provider: Provider }) {
  const [saved, setSaved] = useState(false);
  const queryString = useSearch();
  const selectedCategory = new URLSearchParams(queryString).get("category");
  return (
    <div className="wavy-shadow">
      <Link
        href={`/providers/${provider.id}${selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : ""}`}
        className="provider-card surface-card wavy block"
        data-testid={`card-provider-${provider.id}`}
      >
        <div className="provider-media">
          {provider.imageUrl ? (
            <img
              className="provider-image"
              src={provider.imageUrl}
              alt={`${provider.name} storefront`}
            />
          ) : (
            <div
              className={`provider-image provider-image-fallback tone-${provider.id % 4}`}
              aria-label="No provider image"
            >
              {initials(provider.name)}
            </div>
          )}
          <span
            role="button"
            tabIndex={0}
            aria-pressed={saved}
            aria-label={
              saved
                ? `Remove ${provider.name} from saved`
                : `Save ${provider.name}`
            }
            className={`fav-btn ${saved ? "is-on" : ""}`}
            data-testid={`button-save-provider-${provider.id}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSaved((current) => !current);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              setSaved((current) => !current);
            }}
          >
            <Heart size={16} fill={saved ? "currentColor" : "none"} />
          </span>
        </div>
        <div className="provider-card-body">
          {/* Name and rating lead, so the card can be scanned in one pass. */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="provider-name">{provider.name}</h3>
            <span className="rating shrink-0 pt-0.5">
              <Star size={13} fill="currentColor" />{" "}
              {provider.rating.toFixed(1)}
            </span>
          </div>
          <p className="provider-meta">
            <MapPin size={13} /> {provider.location}
            <span aria-hidden>·</span>
            <span>{provider.reviewCount} reviews</span>
          </p>
          <p className="provider-desc line-clamp-2">{provider.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {provider.verified ? (
              <span className="tag tag-accent">
                <ShieldCheck size={12} className="mr-1" /> Verified
              </span>
            ) : null}
            {provider.categories.map((category) => (
              <span className="tag" key={category}>
                {category}
              </span>
            ))}
          </div>
          <div className="provider-foot">
            <span className="provider-price">
              {money(provider.startingPrice)}
              <span>starting price</span>
            </span>
            <span className="btn btn-ghost h-9 min-h-0 px-4 text-xs">
              View <ArrowRight size={13} />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

function Home({ authenticated = true }: { authenticated?: boolean }) {
  const providersQuery = useListProviders(undefined, {
    query: { queryKey: getListProvidersQueryKey() },
  });
  const summaryQuery = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      enabled: authenticated,
    },
  });
  const providers = providersQuery.data ?? [];
  const nextBooking = summaryQuery.data?.nextBooking;
  const petCount = summaryQuery.data?.petCount;
  const visitCount = summaryQuery.data?.upcomingBookingCount;
  return (
    <div className="animate-in">
      <section className="hero-panel wavy wavy-lg">
        <div className="hero-copy">
          <p className="eyebrow eyebrow-indigo">Care, from people who get it</p>
          <h1 className="hero-title mt-4">
            Good care starts
            <br />
            with a <em>soft place.</em>
          </h1>
          <p className="hero-blurb">
            Find thoughtful groomers and trusted pet-care providers — all in one
            nest, ready when you are.
          </p>
          <HeroSearch />
        </div>
      </section>

      {/* Browsing on the left, everything personal parked in a rail that
          follows you down the page. */}
      <div className="discover-layout">
        <div className="discover-main">
          <section>
            <div className="section-head">
              <div>
                <p className="eyebrow">Start here</p>
                <h2 className="section-title mt-2">What does your pet need?</h2>
              </div>
            </div>
            <div className="category-grid">
              {visibleCategories.map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <Link
                    href={`/providers?category=${key}`}
                    className="category-card wavy"
                    key={key}
                    data-testid={`link-category-${key}`}
                  >
                    <span className="category-icon">
                      <Icon size={20} />
                    </span>
                    <div>
                      <h3 className="category-name">{meta.label}</h3>
                      <p className="category-copy">{meta.copy}</p>
                    </div>
                    <ChevronRight className="category-chevron" size={18} />
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <div className="section-head">
              <div>
                <p className="eyebrow">Around Laguna</p>
                <h2 className="section-title mt-2">A few good places</h2>
              </div>
              <Link
                href="/providers"
                className="btn btn-ghost"
                data-testid="link-all-providers"
              >
                See all <ArrowRight size={14} />
              </Link>
            </div>
            {providersQuery.isLoading ? (
              <LoadingState label="Finding kind people for your pets" />
            ) : providersQuery.isError ? (
              <ErrorState onRetry={() => providersQuery.refetch()} />
            ) : providers.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Your neighborhood is quiet"
                copy="We are adding more local pet-care people every week. Try another search or check back soon."
              />
            ) : (
              <div className="provider-grid">
                {providers.slice(0, 4).map((provider) => (
                  <ProviderCard provider={provider} key={provider.id} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="discover-rail" aria-label="Your nest">
          {nextBooking ? (
            <div className="rail-card rail-next surface-card wavy">
              <p className="eyebrow">Next up</p>
              <h3 className="rail-card-title">{nextBooking.serviceName}</h3>
              <p className="rail-next-meta">
                {nextBooking.providerName}
                <br />
                {formatDate(nextBooking.date)} at {nextBooking.time} ·{" "}
                {nextBooking.petName}
              </p>
              <Link
                href="/bookings"
                className="btn btn-primary mt-4 h-10 min-h-0 w-full text-xs"
                data-testid="link-next-booking"
              >
                View booking <ArrowRight size={13} />
              </Link>
            </div>
          ) : null}

          {authenticated ? (
            <div className="rail-card surface-card wavy">
              <p className="eyebrow eyebrow-indigo">Your nest</p>
              <ul className="rail-stats">
                <li className="rail-stat">
                  <span className="rail-stat-icon">
                    <PawPrint size={17} />
                  </span>
                  <span className="rail-stat-value">{petCount ?? "—"}</span>
                  <span className="rail-stat-label">
                    {petCount === 1 ? "pet" : "pets"} in your nest
                  </span>
                </li>
                <li className="rail-stat">
                  <span className="rail-stat-icon">
                    <CalendarDays size={17} />
                  </span>
                  <span className="rail-stat-value">{visitCount ?? "—"}</span>
                  <span className="rail-stat-label">
                    upcoming {visitCount === 1 ? "visit" : "visits"}
                  </span>
                </li>
              </ul>
            </div>
          ) : (
            <div className="rail-card rail-promo wavy">
              <p className="rail-card-title mt-0">
                Keep your care history close.
              </p>
              <p className="rail-next-meta">
                Sign in to save pets, visits, and orders.
              </p>
              <Link
                href="/sign-in"
                className="btn btn-primary mt-4 h-10 min-h-0 w-full text-xs"
                data-testid="link-rail-sign-in"
              >
                Sign in <ArrowRight size={13} />
              </Link>
            </div>
          )}

          <nav className="rail-card rail-actions surface-card wavy">
            <p className="eyebrow eyebrow-sun">Jump to</p>
            <Link
              href="/pets"
              className="rail-link"
              data-testid="link-rail-pets"
            >
              <PawPrint size={16} /> My pets <ChevronRight size={15} />
            </Link>
            <Link
              href="/bookings"
              className="rail-link"
              data-testid="link-rail-bookings"
            >
              <CalendarDays size={16} /> Bookings <ChevronRight size={15} />
            </Link>
            <Link
              href="/providers"
              className="rail-link"
              data-testid="link-rail-providers"
            >
              <MapPin size={16} /> All providers <ChevronRight size={15} />
            </Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function ProvidersPage() {
  const [, setLocation] = useLocation();
  const queryString = useSearch();
  const params = new URLSearchParams(queryString);
  const category = params.get("category") ?? "";
  const submittedSearch = params.get("search") ?? "";
  const [search, setSearch] = useState(submittedSearch);
  useEffect(() => {
    setSearch(submittedSearch);
  }, [submittedSearch]);
  const queryParams = useMemo(
    () => ({
      ...(category
        ? { category: category as "grooming" | "vaccination" | "pet-supplies" }
        : {}),
      ...(submittedSearch ? { search: submittedSearch } : {}),
    }),
    [category, submittedSearch],
  );
  const query = useListProviders(queryParams, {
    query: { queryKey: getListProvidersQueryKey(queryParams) },
  });
  const results: Provider[] = query.isFetching ? [] : (query.data ?? []);
  const unfiltered = !category && !submittedSearch;
  const spotlight =
    unfiltered && results.length > 2
      ? results.reduce((best, item) =>
          item.rating > best.rating ? item : best,
        )
      : undefined;
  const rest = spotlight
    ? results.filter((item) => item.id !== spotlight.id)
    : results;
  return (
    <div className="animate-in">
      <header className="page-head">
        <div>
          <p className="eyebrow">The PetNest directory</p>
          <h1 className="page-title">
            Find your kind
            <br className="sm:hidden" /> of people.
          </h1>
          <p className="page-subtitle">
            Browse providers who make the practical parts of pet care feel a
            little more personal.
          </p>
        </div>
      </header>
      {/* One sticky toolbar: search, filters, and the result count together,
          so the controls stay reachable while scrolling a long list. */}
      <div className="surface-card filter-bar">
        <form
          className="filter-bar-search"
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams();
            if (category) next.set("category", category);
            if (search) next.set("search", search);
            setLocation(`/providers${next.size ? `?${next}` : ""}`);
          }}
        >
          <Search size={17} className="shrink-0 text-muted-foreground" />
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search providers or neighborhoods"
            aria-label="Search providers"
            data-testid="input-provider-search"
          />
          <button
            className="btn btn-primary h-10 min-h-0"
            type="submit"
            data-testid="button-provider-search"
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button
            className={`filter-chip ${!category ? "active" : ""}`}
            onClick={() => {
              setLocation("/providers");
            }}
            data-testid="button-filter-all"
          >
            All providers
          </button>
          {visibleCategories.map(([key, meta]) => (
            <button
              className={`filter-chip ${category === key ? "active" : ""}`}
              key={key}
              onClick={() => {
                setLocation(`/providers?category=${encodeURIComponent(key)}`);
              }}
              data-testid={`button-filter-${key}`}
            >
              {meta.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <p className="result-count" aria-live="polite">
            {query.isLoading
              ? "Looking around…"
              : `${results.length} providers`}
          </p>
          {category || submittedSearch ? (
            <button
              className="text-sm font-bold text-primary hover:underline"
              onClick={() => {
                  setSearch("");
                setLocation("/providers");
              }}
              data-testid="button-clear-filter"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : results.length ? (
        <>
          {/* With no filter applied, lead with the best-rated place as a
              full-width spotlight, then the rest as a grid. */}
          {spotlight ? (
            <Link
              href={`/providers/${spotlight.id}${category ? `?category=${encodeURIComponent(category)}` : ""}`}
              className={`spotlight wavy tone-${spotlight.id % 4}`}
              data-testid={`card-spotlight-${spotlight.id}`}
            >
              <span className="spotlight-mark" aria-hidden>
                {initials(spotlight.name)}
              </span>
              <span className="spotlight-body">
                <span className="eyebrow eyebrow-sun">Best rated nearby</span>
                <span className="spotlight-name">{spotlight.name}</span>
                <span className="spotlight-meta">
                  <span className="rating">
                    <Star size={13} fill="currentColor" />{" "}
                    {spotlight.rating.toFixed(1)}
                  </span>
                  <span>
                    <MapPin size={13} /> {spotlight.location}
                  </span>
                  <span>{spotlight.reviewCount} reviews</span>
                </span>
                <span className="spotlight-copy">{spotlight.description}</span>
                <span className="spotlight-foot">
                  <span className="provider-price">
                    {money(spotlight.startingPrice)}
                    <span>starting price</span>
                  </span>
                  <span className="btn btn-primary h-10 min-h-0 text-xs">
                    View provider <ArrowRight size={13} />
                  </span>
                </span>
              </span>
            </Link>
          ) : null}
          <div className="provider-grid">
            {rest.map((provider) => (
              <ProviderCard provider={provider} key={provider.id} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={MapPin}
          title="No perfect match yet"
          copy="Try a broader search or another care category. Your pet's next favorite place may be a click away."
          action={
            <Link
              href="/"
              className="btn btn-primary"
              data-testid="link-empty-home"
            >
              Back to discovery <ArrowRight size={14} />
            </Link>
          }
        />
      )}
    </div>
  );
}

function LegacyBookingModal({
  provider,
  service,
  onClose,
}: {
  provider: ProviderDetail;
  service: ProviderService;
  onClose: () => void;
}) {
  const petsQuery = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const createBooking = useCreateBooking();
  const [petId, setPetId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [complete, setComplete] = useState(false);
  const submit = () => {
    if (!petId || !date) return;
    createBooking.mutate(
      {
        data: {
          providerId: provider.id,
          serviceId: service.id,
          petId: Number(petId),
          recordId: null,
          date,
          time,
          notes,
        },
      },
      { onSuccess: () => setComplete(true) },
    );
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Make it official</p>
            <h2 id="booking-title" className="mt-2 font-display text-3xl">
              Book {service.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {provider.name} · {money(service.price)} ·{" "}
              {service.durationMinutes} minutes
            </p>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close booking"
            data-testid="button-close-booking"
          >
            <X size={17} />
          </button>
        </div>
        {complete ? (
          <div className="py-10 text-center">
            <div className="empty-icon">
              <Check size={24} />
            </div>
            <h3 className="font-display text-3xl">Request submitted.</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your booking request has been submitted and is waiting for
              confirmation from {provider.name}.
            </p>
            <button
              className="btn btn-primary mt-6"
              onClick={onClose}
              data-testid="button-done-booking"
            >
              Done
            </button>
          </div>
        ) : petsQuery.isLoading ? (
          <LoadingState label="Loading your pet profiles" />
        ) : petsQuery.isError ? (
          <ErrorState onRetry={() => petsQuery.refetch()} />
        ) : petsQuery.data?.length ? (
          <div className="mt-7 space-y-4">
            <div className="form-field">
              <label className="form-label" htmlFor="booking-pet">
                Who is coming?
              </label>
              <select
                className="input select"
                id="booking-pet"
                value={petId}
                onChange={(event) => setPetId(event.target.value)}
                data-testid="select-booking-pet"
              >
                <option value="">Choose a pet</option>
                {petsQuery.data.map((pet) => (
                  <option value={pet.id} key={pet.id}>
                    {pet.name} · {pet.breed}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="booking-date">
                  Preferred date
                </label>
                <input
                  className="input"
                  id="booking-date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  data-testid="input-booking-date"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="booking-time">
                  Preferred time
                </label>
                <select
                  className="input select"
                  id="booking-time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  data-testid="select-booking-time"
                >
                  <option>09:00</option>
                  <option>10:00</option>
                  <option>11:30</option>
                  <option>13:00</option>
                  <option>15:30</option>
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="booking-notes">
                Anything they should know?{" "}
                <span className="font-normal">(optional)</span>
              </label>
              <textarea
                className="input h-24 resize-none py-3"
                id="booking-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Temperament, sensitivities, or a little context"
                data-testid="textarea-booking-notes"
              />
            </div>
            {createBooking.isError ? (
              <p
                className="text-sm text-destructive"
                data-testid="text-booking-error"
              >
                {createBooking.error instanceof Error
                  ? createBooking.error.message
                  : "We could not send that booking. Please try again."}
              </p>
            ) : null}
            <button
              className="btn btn-primary w-full"
              onClick={submit}
              disabled={createBooking.isPending || !petId || !date}
              data-testid="button-submit-booking"
            >
              {createBooking.isPending
                ? "Sending request…"
                : "Request this time"}
            </button>
          </div>
        ) : (
          <EmptyState
            icon={PawPrint}
            title="Add a pet first"
            copy="A pet profile helps providers prepare for a visit."
            action={
              <Link
                href="/pets"
                className="btn btn-primary"
                onClick={onClose}
                data-testid="link-booking-add-pet"
              >
                Add pet profile <ArrowRight size={14} />
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

function BookingModal({
  provider,
  service,
  onClose,
}: {
  provider: ProviderDetail;
  service: ProviderService;
  onClose: () => void;
}) {
  const petsQuery = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const createBooking = useCreateBooking();
  const [petId, setPetId] = useState("");
  const [recordId, setRecordId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [complete, setComplete] = useState(false);
  const [savedBooking, setSavedBooking] = useState<Booking | null>(null);
  const recordsQuery = useGetPetRecords(Number(petId), {
    query: {
      enabled: Boolean(petId),
      queryKey: getGetPetRecordsQueryKey(Number(petId)),
    },
  });
  const recordType =
    service.category === "vaccination" ? "vaccinations" : "grooming";
  const relevantRecords = recordsQuery.data?.[recordType] ?? [];
  const pet = petsQuery.data?.find(
    (candidate) => candidate.id === Number(petId),
  );
  const record = relevantRecords.find(
    (candidate) => candidate.id === Number(recordId),
  );

  const confirm = () => {
    if (!petId || !date) return;
    createBooking.mutate(
      {
        data: {
          providerId: provider.id,
          serviceId: service.id,
          petId: Number(petId),
          recordId: recordId ? Number(recordId) : null,
          date,
          time,
          notes,
        },
      },
      {
        onSuccess: (booking) => {
          queryClient.invalidateQueries({
            queryKey: getListBookingsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardSummaryQueryKey(),
          });
          setSavedBooking(booking);
          setComplete(true);
        },
      },
    );
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              {reviewing ? "Review booking" : `Book ${service.category}`}
            </p>
            <h2 id="booking-title" className="mt-2 font-display text-3xl">
              {service.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {provider.name} · {money(service.price)} ·{" "}
              {service.durationMinutes} minutes
            </p>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close booking"
          >
            <X size={17} />
          </button>
        </div>
        {complete ? (
          <div className="py-10 text-center">
            <div className="empty-icon">
              <Check size={24} />
            </div>
            <h3 className="font-display text-3xl">Request submitted.</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your {service.category} booking is saved for {pet?.name} and is
              waiting for confirmation.
            </p>
            {savedBooking ? (
              <div className="surface-card mx-auto mt-5 max-w-sm bg-muted p-4 text-left text-sm">
                <p>
                  <strong>Provider:</strong> {savedBooking.providerName}
                </p>
                <p className="mt-2">
                  <strong>Service:</strong> {savedBooking.serviceName}
                </p>
                <p className="mt-2">
                  <strong>When:</strong> {formatDate(savedBooking.date)} at{" "}
                  {savedBooking.time}
                </p>
                <p className="mt-2">
                  <strong>Status:</strong> {statusLabel(savedBooking.status)}
                </p>
              </div>
            ) : null}
            <button className="btn btn-primary mt-6" onClick={onClose}>
              Done
            </button>
          </div>
        ) : reviewing ? (
          <div className="mt-7 space-y-4">
            <div className="surface-card bg-muted p-5 text-sm">
              <p>
                <strong>Service:</strong> {service.name}
              </p>
              <p className="mt-2">
                <strong>Pet:</strong> {pet?.name}
              </p>
              <p className="mt-2">
                <strong>Record:</strong>{" "}
                {record?.title ?? "No previous record selected"}
              </p>
              <p className="mt-2">
                <strong>Schedule:</strong> {formatDate(date)} at {time}
              </p>
              <p className="mt-2">
                <strong>Price:</strong> {money(service.price)}
              </p>
              {notes ? (
                <p className="mt-2">
                  <strong>Notes:</strong> {notes}
                </p>
              ) : null}
            </div>
            {createBooking.isError ? (
              <p className="text-sm text-destructive">
                {createBooking.error instanceof Error
                  ? createBooking.error.message
                  : "We could not confirm that booking."}
              </p>
            ) : null}
            <div className="flex gap-3">
              <button
                className="btn btn-ghost flex-1"
                onClick={() => setReviewing(false)}
              >
                Back
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={confirm}
                disabled={createBooking.isPending}
              >
                {createBooking.isPending ? "Confirming…" : "Confirm booking"}
              </button>
            </div>
          </div>
        ) : petsQuery.isLoading ? (
          <LoadingState label="Loading your pet profiles" />
        ) : petsQuery.isError ? (
          <ErrorState onRetry={() => petsQuery.refetch()} />
        ) : petsQuery.data?.length ? (
          <div className="mt-7 space-y-4">
            <div className="form-field">
              <label className="form-label" htmlFor="booking-pet">
                Pet
              </label>
              <select
                className="input select"
                id="booking-pet"
                value={petId}
                onChange={(event) => {
                  setPetId(event.target.value);
                  setRecordId("");
                }}
              >
                <option value="">Choose a pet</option>
                {petsQuery.data.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.breed}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="booking-record">
                Relevant {service.category} record
              </label>
              <select
                className="input select"
                id="booking-record"
                value={recordId}
                onChange={(event) => setRecordId(event.target.value)}
                disabled={!petId || recordsQuery.isLoading}
              >
                <option value="">No previous record</option>
                {relevantRecords.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title} · {formatDate(item.date)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="booking-date">
                  Date
                </label>
                <input
                  className="input"
                  id="booking-date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="booking-time">
                  Time
                </label>
                <select
                  className="input select"
                  id="booking-time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                >
                  <option>09:00</option>
                  <option>10:00</option>
                  <option>11:30</option>
                  <option>13:00</option>
                  <option>15:30</option>
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="booking-notes">
                Pet notes <span className="font-normal">(optional)</span>
              </label>
              <textarea
                className="input h-24 resize-none py-3"
                id="booking-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Temperament, sensitivities, or context"
              />
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={() => setReviewing(true)}
              disabled={!petId || !date}
            >
              Review booking
            </button>
          </div>
        ) : (
          <EmptyState
            icon={PawPrint}
            title="Add a pet first"
            copy="A pet profile is required before booking."
            action={
              <Link href="/pets" className="btn btn-primary" onClick={onClose}>
                Add pet profile
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

function ProviderDetailPage() {
  const { user } = useAuth();
  const queryString = useSearch();
  const selectedCategory = new URLSearchParams(queryString).get("category");
  const suppliesOnly = selectedCategory === "pet-supplies";
  const params = useParams<{ providerId?: string }>();
  const providerId = Number(params.providerId);
  const query = useQuery({
    queryKey: [...getGetProviderQueryKey(providerId), selectedCategory],
    enabled: !!providerId,
    queryFn: ({ signal }) =>
      adminRequest<ProviderDetail>(
        `/api/providers/${providerId}${selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : ""}`,
        { signal },
      ),
  });
  const [bookingService, setBookingService] = useState<ProviderService | null>(
    null,
  );
  const [cart, setCart] = useState<
    { product: ProviderProduct; quantity: number }[]
  >(() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          `petnest-cart-${user?.id ?? "guest"}-${providerId}`,
        ) ?? "[]",
      );
    } catch {
      return [];
    }
  });
  const [checkingOut, setCheckingOut] = useState(false);
  const createOrder = useCreateOrder();
  const [notice, setNotice] = useState("");
  useEffect(() => {
    localStorage.setItem(
      `petnest-cart-${user?.id ?? "guest"}-${providerId}`,
      JSON.stringify(cart),
    );
  }, [cart, providerId, user?.id]);
  if (query.isLoading)
    return <LoadingState label="Opening this provider's nest" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        onRetry={() => query.refetch()}
        message="This provider is taking a little longer to appear."
      />
    );
  const provider = query.data;
  const visibleServices =
    selectedCategory === "grooming" || selectedCategory === "vaccination"
      ? provider.services.filter(
          (service) => service.category === selectedCategory,
        )
      : selectedCategory
        ? []
        : provider.services;
  const visibleProducts =
    selectedCategory === "pet-supplies"
      ? provider.products.filter(
          (product) => product.category === "pet-supplies" && product.active,
        )
      : selectedCategory
        ? []
        : provider.products;
  const addProduct = (product: ProviderProduct) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing?.quantity === product.stock) return current;
      return existing
        ? current.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...current, { product, quantity: 1 }];
    });
    setNotice(`${product.name} added to your basket`);
    queryClient.invalidateQueries({ queryKey: ["shopping-cart"] });
    window.setTimeout(() => setNotice(""), 2500);
  };
  const changeQuantity = (productId: number, quantity: number) =>
    setCart((current) =>
      current.flatMap((item) =>
        item.product.id !== productId
          ? [item]
          : quantity < 1
            ? []
            : [{ ...item, quantity: Math.min(quantity, item.product.stock) }],
      ),
    );
  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const placeOrder = () => {
    if (!cart.length) return;
    createOrder.mutate(
      {
        data: {
          providerId: provider.id,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        },
      },
      {
        onSuccess: () => {
          setCart([]);
          setCheckingOut(false);
          query.refetch();
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          setNotice("Order placed — we will keep an eye on it.");
          window.setTimeout(() => setNotice(""), 3500);
        },
      },
    );
  };
  return (
    <div className="animate-in">
      <Link
        href={
          selectedCategory
            ? `/providers?category=${encodeURIComponent(selectedCategory)}`
            : "/providers"
        }
        className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary"
        data-testid="link-back-providers"
      >
        ← All providers
      </Link>
      <div className="detail-hero">
        {provider.imageUrl ? (
          <img
            className="detail-image"
            src={provider.imageUrl}
            alt={`${provider.name} care space`}
          />
        ) : (
          <div
            className={`detail-image provider-image-fallback tone-${provider.id % 4}`}
            aria-label="No provider image"
          >
            {initials(provider.name)}
          </div>
        )}
        <div className="detail-info">
          <div className="flex items-center gap-2">
            {provider.verified ? (
              <span className="tag tag-accent">
                <ShieldCheck size={12} className="mr-1" /> Verified provider
              </span>
            ) : null}
            <span className="rating">
              <Star size={12} fill="currentColor" />{" "}
              {provider.rating.toFixed(1)}
            </span>
          </div>
          <h1 className="mt-4">{provider.name}</h1>
          <div className="detail-meta">
            <span>
              <MapPin size={14} className="mr-1 inline text-primary" />
              {provider.location}
            </span>
            <span>
              <Clock3 size={14} className="mr-1 inline text-primary" />
              {provider.hours}
            </span>
            <span>{provider.contact}</span>
          </div>
          <p className="mt-6 max-w-xl text-[15px] leading-7 text-muted-foreground">
            {provider.description}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {provider.categories.map((category) => (
              <span className="tag" key={category}>
                {category}
              </span>
            ))}
          </div>
        </div>
      </div>
      {notice ? (
        <div
          className="surface-card mt-5 flex items-center gap-2 border-primary/30 bg-accent p-4 text-sm font-semibold text-accent-foreground"
          role="status"
          data-testid="status-provider-notice"
        >
          <Check size={16} /> {notice}
        </div>
      ) : null}
      <div className="detail-panels">
        {!suppliesOnly ? (
          <section className="surface-card p-5">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="eyebrow">Care menu</p>
                <h2 className="section-title mt-1">Services</h2>
              </div>
              <span className="tag">{visibleServices.length} options</span>
            </div>
            <div className="list-stack">
              {visibleServices.map((service) => (
                <div
                  className="service-row"
                  key={service.id}
                  data-testid={`row-service-${service.id}`}
                >
                  {service.imageUrl ? (
                    <img
                      className="product-thumb mb-3"
                      src={service.imageUrl}
                      alt=""
                    />
                  ) : null}
                  <div className="min-w-0">
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {service.description}
                    </p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {service.durationMinutes} min · {money(service.price)}
                    </p>
                  </div>
                  <button
                    className="btn btn-primary shrink-0"
                    onClick={() => setBookingService(service)}
                    disabled={service.available === false}
                    data-testid={`button-book-service-${service.id}`}
                  >
                    {service.available === false ? "Unavailable" : "Book"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {suppliesOnly || !selectedCategory ? (
          <section className="surface-card p-5">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="eyebrow">From their shelves</p>
                <h2 className="section-title mt-1">Pet supplies</h2>
              </div>
              {cart.length ? (
                <span className="tag tag-accent">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} in basket
                </span>
              ) : null}
            </div>
            <div className="list-stack">
              {visibleProducts.map((product) => (
                <div
                  className="product-row"
                  key={product.id}
                  data-testid={`row-product-${product.id}`}
                >
                  {product.imageUrl ? (
                    <img
                      className="product-thumb"
                      src={product.imageUrl}
                      alt=""
                    />
                  ) : (
                    <div
                      className="product-thumb grid place-items-center bg-muted text-muted-foreground"
                      aria-label="No product image"
                    >
                      <Package size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {product.description}
                    </p>
                    <p className="mt-2 font-mono text-xs">
                      {money(product.price)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.stock > 0
                        ? `${product.stock} in stock`
                        : "Out of stock"}
                    </p>
                  </div>
                  <input
                    className="input w-16"
                    type="number"
                    min="1"
                    max={product.stock}
                    defaultValue="1"
                    aria-label={`Quantity for ${product.name}`}
                    id={`quantity-${product.id}`}
                  />
                  <button
                    className="btn btn-ghost shrink-0"
                    onClick={() => {
                      const input = document.getElementById(
                        `quantity-${product.id}`,
                      ) as HTMLInputElement | null;
                      const amount = Math.max(
                        1,
                        Math.min(product.stock, Number(input?.value) || 1),
                      );
                      for (let count = 0; count < amount; count += 1)
                        addProduct(product);
                    }}
                    disabled={product.stock < 1}
                    data-testid={`button-add-product-${product.id}`}
                  >
                    {product.stock > 0 ? (
                      <>
                        <Plus size={14} /> Add
                      </>
                    ) : (
                      "Out of Stock"
                    )}
                  </button>
                </div>
              ))}
            </div>
            {cart.length ? (
              <div className="mt-5 rounded-2xl bg-muted p-4">
                <div className="mb-3 space-y-2">
                  {cart.map((item) => (
                    <div
                      className="flex items-center gap-2 text-sm"
                      key={item.product.id}
                    >
                      <span className="flex-1 font-semibold">
                        {item.product.name}
                      </span>
                      <button
                        className="btn btn-ghost h-8 min-h-0 px-2"
                        onClick={() =>
                          changeQuantity(item.product.id, item.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        className="btn btn-ghost h-8 min-h-0 px-2"
                        disabled={item.quantity >= item.product.stock}
                        onClick={() =>
                          changeQuantity(item.product.id, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                      <button
                        className="btn btn-ghost h-8 min-h-0 px-2"
                        onClick={() => changeQuantity(item.product.id, 0)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Basket total</span>
                  <span className="font-mono">{money(total)}</span>
                </div>
                <Link
                  href="/orders"
                  className="btn btn-secondary mt-3 w-full"
                  data-testid="button-open-cart"
                >
                  Open cart and checkout <ArrowRight size={14} />
                </Link>
                {createOrder.isError ? (
                  <p className="mt-2 text-xs text-destructive">
                    We could not place that order. Please try again.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      {checkingOut ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal animate-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Pet Supplies</p>
                <h2 id="checkout-title" className="modal-title">
                  Review your order
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  From {provider.name}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setCheckingOut(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="list-stack mt-5">
              {cart.map((item) => (
                <div className="product-row" key={item.product.id}>
                  {item.product.imageUrl ? (
                    <img
                      className="product-thumb"
                      src={item.product.imageUrl}
                      alt=""
                    />
                  ) : (
                    <div className="product-thumb grid place-items-center bg-muted">
                      <Package size={18} />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {money(item.product.price)}
                    </p>
                  </div>
                  <span className="font-mono text-sm">
                    {money(item.quantity * item.product.price)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-4 font-semibold">
              <span>Subtotal / Total</span>
              <span className="font-mono">{money(total)}</span>
            </div>
            <button
              className="btn btn-primary mt-5 w-full"
              onClick={placeOrder}
              disabled={createOrder.isPending}
            >
              {createOrder.isPending ? "Placing order…" : "Place Order"}
            </button>
            {createOrder.isError ? (
              <p className="mt-3 text-sm text-destructive">
                {createOrder.error instanceof Error
                  ? createOrder.error.message
                  : "Order could not be placed."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {bookingService ? (
        <BookingModal
          provider={provider}
          service={bookingService}
          onClose={() => setBookingService(null)}
        />
      ) : null}
    </div>
  );
}

function BookingsPage() {
  const query = useListBookings({
    query: { queryKey: getListBookingsQueryKey() },
  });
  const [cancellationBooking, setCancellationBooking] =
    useState<Booking | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      adminRequest<Booking>(`/api/bookings/${id}/cancellation-request`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      setCancellationBooking(null);
      setCancellationReason("");
      queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    },
  });
  const bookings: Booking[] = query.data ?? [];
  const isOver = (status: string) =>
    ["completed", "cancelled"].includes(status.toLowerCase());
  const upcoming = bookings.filter((booking) => !isOver(booking.status));
  const past = bookings.filter((booking) => isOver(booking.status));

  const renderBooking = (booking: Booking) => {
    const when = new Date(booking.date);
    const valid = !Number.isNaN(when.getTime());
    return (
      <li
        className={`booking-row status-tone-${booking.status.toLowerCase()}`}
        key={booking.id}
        data-testid={`row-booking-${booking.id}`}
      >
        <div className="booking-date" aria-hidden>
          <span className="booking-date-day">
            {valid ? when.getDate() : "—"}
          </span>
          <span className="booking-date-month">
            {valid
              ? when.toLocaleDateString(undefined, { month: "short" })
              : ""}
          </span>
        </div>
        <div className="booking-main">
          <h3 className="booking-service">{booking.serviceName}</h3>
          <p className="booking-meta">
            <Link
              href={`/providers/${booking.providerId}`}
              className="booking-provider"
              data-testid={`link-booking-provider-${booking.id}`}
            >
              {booking.providerName}
            </Link>
            <span aria-hidden>·</span>
            <span>
              <PawPrint size={12} /> {booking.petName}
            </span>
            <span aria-hidden>·</span>
            <span>
              <Clock3 size={12} /> {booking.time}
            </span>
          </p>
          {booking.status.toLowerCase() === "pending" ? (
            <p className="booking-note">
              Waiting for {booking.providerName} to confirm.
            </p>
          ) : null}
          {booking.status.toLowerCase() === "cancellation_pending" ? (
            <p className="booking-note">
              Cancellation request is waiting for provider review.
            </p>
          ) : null}
          {booking.cancellationDecision === "rejected" ? (
            <p className="booking-note">
              Cancellation request rejected. Your booking remains active.
            </p>
          ) : null}
        </div>
        <div className="booking-side">
          <span className={`status status-${booking.status.toLowerCase()}`}>
            {statusLabel(booking.status)}
          </span>
          <span className="booking-price">{money(booking.price)}</span>
        </div>
        {!isOver(booking.status) &&
        booking.status.toLowerCase() !== "cancellation_pending" ? (
          <button
            className="btn btn-ghost booking-cancel"
            disabled={cancel.isPending}
            onClick={() => {
              setCancellationBooking(booking);
              setCancellationReason("");
            }}
            data-testid={`button-cancel-booking-${booking.id}`}
          >
            Cancel
          </button>
        ) : null}
      </li>
    );
  };

  return (
    <div className="animate-in">
      <header className="page-head">
        <div>
          <p className="eyebrow">Your plans</p>
          <h1 className="page-title">
            Bookings,
            <br />
            kept simple.
          </h1>
        </div>
        <div className="page-head-counts">
          <span className="head-count">
            <strong>{upcoming.length}</strong> upcoming
          </span>
          <span className="head-count">
            <strong>{past.length}</strong> in history
          </span>
        </div>
      </header>

      <div className="mt-7">
        {query.isLoading ? (
          <LoadingState label="Finding your upcoming care" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : !bookings.length ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing on the calendar"
            copy="When your pet is ready for a little care, it will show up here."
            action={
              <Link
                href="/providers"
                className="btn btn-primary"
                data-testid="link-bookings-discover"
              >
                Find a provider <ArrowRight size={14} />
              </Link>
            }
          />
        ) : (
          <>
            {/* A dated timeline reads far faster than a table of rows. */}
            {upcoming.length ? (
              <section className="booking-group">
                <h2 className="booking-group-title">
                  <span className="eyebrow eyebrow-indigo">Coming up</span>
                </h2>
                <ul className="booking-list">{upcoming.map(renderBooking)}</ul>
              </section>
            ) : null}
            {past.length ? (
              <section className="booking-group">
                <h2 className="booking-group-title">
                  <span className="eyebrow">Already done</span>
                </h2>
                <ul className="booking-list is-past">
                  {past.map(renderBooking)}
                </ul>
              </section>
            ) : null}
            {cancel.isError ? (
              <p className="mt-4 text-sm font-semibold text-destructive">
                {cancel.error.message}
              </p>
            ) : null}
          </>
        )}
      </div>
      {cancellationBooking ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal animate-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
          >
            <h2 id="cancel-booking-title" className="modal-title">
              Request cancellation
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your provider must review this request before the booking is
              cancelled.
            </p>
            <textarea
              className="input mt-5 h-28 py-3"
              placeholder="Cancellation reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
            />
            <div className="mt-2 text-sm text-destructive">
              {cancel.isError
                ? cancel.error.message
                : !cancellationReason.trim() && cancel.isIdle
                  ? "Cancellation reason is required."
                  : ""}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => setCancellationBooking(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={cancel.isPending || !cancellationReason.trim()}
                onClick={() =>
                  cancel.mutate({
                    id: cancellationBooking.id,
                    reason: cancellationReason,
                  })
                }
              >
                Send request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type AdminBooking = Booking & { customerId: string };
type ProviderRecord = CareRecord & {
  petId: number;
  ownerId: string;
  nextDue?: string | null;
};
type ProviderPet = Pet & { ownerName: string; ownerEmail: string };

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body =
    response.status === 204
      ? null
      : ((await response.json().catch(() => null)) as {
          error?: string;
        } | null);
  if (!response.ok)
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}

function AdminBookingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const query = useQuery({
    queryKey: ["admin", "bookings"],
    queryFn: () => adminRequest<AdminBooking[]>("/api/admin/bookings"),
    enabled: isAdmin,
  });
  if (!isAdmin) return <NotFound />;
  if (query.isLoading) return <LoadingState label="Loading ongoing bookings" />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => query.refetch()}
        message="Admin bookings could not be loaded."
      />
    );

  const bookings = query.data ?? [];
  return (
    <div className="animate-in">
      <p className="eyebrow">Admin workspace</p>
      <h1 className="page-title">Booking visibility.</h1>
      <p className="page-subtitle">
        Review system bookings. Status decisions belong to the assigned
        provider.
      </p>
      <div className="mt-8">
        {bookings.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Customer</th>
                  <th>Pet</th>
                  <th>Schedule</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    data-testid={`row-admin-booking-${booking.id}`}
                  >
                    <td>
                      <p className="font-semibold">{booking.serviceName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {booking.providerName}
                      </p>
                    </td>
                    <td className="font-mono text-xs">{booking.customerId}</td>
                    <td>
                      {booking.petName}
                      {booking.cancellationReason ? (
                        <p className="mt-1 text-xs text-destructive">
                          Reason: {booking.cancellationReason}
                        </p>
                      ) : null}
                    </td>
                    <td>
                      <p>{formatDate(booking.date)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {booking.time}
                      </p>
                    </td>
                    <td>
                      <span
                        className={`status status-${booking.status.toLowerCase()}`}
                      >
                        {statusLabel(booking.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No bookings to manage"
            copy="Customer bookings will appear here when they are created."
          />
        )}
      </div>
    </div>
  );
}

type AdminProvider = ProviderDetail & { active?: boolean };
const emptyProviderForm = {
  name: "",
  email: "",
  password: "",
  location: "",
  description: "",
  contact: "",
  hours: "",
  categories: ["grooming"] as string[],
};

function AdminProvidersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [form, setForm] = useState(emptyProviderForm);
  const [editing, setEditing] = useState<AdminProvider | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminProvider | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminProvider | null>(null);
  const query = useQuery({
    queryKey: ["admin", "providers"],
    queryFn: () => adminRequest<AdminProvider[]>("/api/admin/providers"),
    enabled: isAdmin,
  });
  const save = useMutation({
    mutationFn: () =>
      adminRequest<AdminProvider>(
        editing ? `/api/admin/providers/${editing.id}` : "/api/admin/providers",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(
            editing ? { ...form, active: editing.active !== false } : form,
          ),
        },
      ),
    onSuccess: () => {
      setForm(emptyProviderForm);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
    },
  });
  const deactivate = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      adminRequest<AdminProvider>(`/api/admin/providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      setStatusTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      queryClient.invalidateQueries({ queryKey: getListProvidersQueryKey() });
    },
  });
  const removeProvider = useMutation({
    mutationFn: (id: number) =>
      adminRequest<AdminProvider>(`/api/admin/providers/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      queryClient.invalidateQueries({ queryKey: getListProvidersQueryKey() });
    },
  });
  if (!isAdmin) return <NotFound />;
  if (query.isLoading) return <LoadingState label="Loading providers" />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => query.refetch()}
        message="Providers could not be loaded."
      />
    );
  const toggleCategory = (category: string) =>
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  const editProvider = (provider: AdminProvider) => {
    setEditing(provider);
    setForm({
      name: provider.name,
      email: "",
      password: "",
      location: provider.location,
      description: provider.description,
      contact: provider.contact,
      hours: provider.hours,
      categories: provider.categories,
    });
  };
  return (
    <div className="animate-in">
      <p className="eyebrow">Admin workspace</p>
      <h1 className="page-title">Provider directory.</h1>
      <p className="page-subtitle">
        Create and maintain the providers customers can discover.
      </p>
      <section className="surface-card mt-8 p-6">
        <h2 className="section-title">
          {editing ? "Edit provider" : "Add provider"}
        </h2>
        <div className="form-grid mt-5">
          {(["name", "location", "contact", "hours"] as const).map((field) => (
            <div className="form-field" key={field}>
              <label className="form-label">
                {field[0].toUpperCase() + field.slice(1)}
              </label>
              <input
                className="input"
                value={form[field]}
                onChange={(event) =>
                  setForm({ ...form, [field]: event.target.value })
                }
              />
            </div>
          ))}
          {!editing ? (
            <>
              <div className="form-field">
                <label className="form-label">Provider login email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label className="form-label">Temporary password</label>
                <input
                  className="input"
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                />
              </div>
            </>
          ) : null}
          <div className="form-field full">
            <label className="form-label">Description</label>
            <textarea
              className="input h-24 py-3"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {(["grooming", "vaccination", "pet-supplies"] as const).map(
            (category) => (
              <label className="flex items-center gap-2 text-sm" key={category}>
                <input
                  type="checkbox"
                  checked={form.categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />{" "}
                {category}
              </label>
            ),
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            className="btn btn-primary"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending
              ? "Saving…"
              : editing
                ? "Save provider"
                : "Create provider"}
          </button>
          {editing ? (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setEditing(null);
                setForm(emptyProviderForm);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
        {save.isError ? (
          <p className="mt-3 text-sm text-destructive">{save.error.message}</p>
        ) : null}
      </section>
      <section className="surface-card mt-6 p-6">
        <h2 className="section-title">Registered providers</h2>
        <div className="list-stack mt-5">
          {(query.data ?? []).map((provider) => (
            <div className="service-row" key={provider.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{provider.name}</p>
                <p className="text-xs text-muted-foreground">
                  {provider.categories.join(" · ")} ·{" "}
                  {provider.active === false ? "Inactive" : "Active"}
                </p>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => editProvider(provider)}
              >
                Edit
              </button>
              <button
                className="btn btn-ghost"
                disabled={deactivate.isPending}
                onClick={() => setStatusTarget(provider)}
              >
                {provider.active === false
                  ? "Reactivate provider"
                  : "Deactivate provider"}
              </button>
              <button
                className="btn btn-ghost text-destructive"
                disabled={removeProvider.isPending}
                onClick={() => setRemoveTarget(provider)}
              >
                Remove provider
              </button>
            </div>
          ))}
        </div>
      </section>
      {statusTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal animate-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-status-title"
          >
            <h2 id="provider-status-title" className="modal-title">
              {statusTarget.active === false
                ? "Reactivate provider?"
                : "Deactivate provider?"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {statusTarget.name} will be{" "}
              {statusTarget.active === false
                ? "visible and bookable"
                : "hidden from new customer bookings"}
              . Historical bookings and pet records remain unchanged.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => setStatusTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={deactivate.isPending}
                onClick={() =>
                  deactivate.mutate({
                    id: statusTarget.id,
                    active: statusTarget.active === false,
                  })
                }
              >
                {statusTarget.active === false
                  ? "Reactivate provider"
                  : "Deactivate provider"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {removeTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal animate-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-provider-title"
          >
            <h2 id="remove-provider-title" className="modal-title">
              Remove provider?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Remove {removeTarget.name} from the provider directory? Historical
              bookings, pet records, and service history will remain intact.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={removeProvider.isPending}
                onClick={() => removeProvider.mutate(removeTarget.id)}
              >
                Remove provider
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CustomerProfilePage() {
  const { user, setUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [saved, setSaved] = useState(false);
  const save = async () => {
    if (!user) return;
    const result = await adminRequest<{ user: AuthUser }>(
      "/api/customer/profile",
      {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName }),
      },
    );
    setUser(result.user);
    setSaved(true);
  };
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || user?.email || "You";
  return (
    <div className="animate-in">
      <header className="page-head">
        <div>
          <p className="eyebrow">Customer profile</p>
          <h1 className="page-title">Your account.</h1>
          <p className="page-subtitle">
            Keep the basic details connected to your PetNest account up to date.
          </p>
        </div>
      </header>

      {/* Identity on the left, editing on the right. */}
      <div className="account-layout">
        <aside className="identity-card wavy">
          <span className="identity-avatar">{initials(displayName)}</span>
          <h2 className="identity-name">{displayName}</h2>
          <p className="identity-email">{user?.email}</p>
          <span className="tag identity-role">
            {user?.role === "provider"
              ? "Provider"
              : user?.role === "admin"
                ? "Admin"
                : "Pet parent"}
          </span>
        </aside>

        <div className="account-form surface-card">
          <p className="eyebrow eyebrow-indigo">Details</p>
          <div className="form-grid mt-5">
            <div className="form-field">
              <label className="form-label" htmlFor="profile-first-name">
                First name
              </label>
              <input
                className="input"
                id="profile-first-name"
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  setSaved(false);
                }}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="profile-last-name">
                Last name
              </label>
              <input
                className="input"
                id="profile-last-name"
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  setSaved(false);
                }}
              />
            </div>
            <div className="form-field full">
              <label className="form-label">Email</label>
              <input className="input" value={user?.email ?? ""} disabled />
              <p className="field-hint">
                Your email is how providers recognise your bookings, so it
                cannot be changed here.
              </p>
            </div>
          </div>
          <div className="account-actions">
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={!firstName}
            >
              Save profile
            </button>
            {saved ? (
              <span className="save-flag">
                <Check size={14} /> Profile saved
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderManagementPage() {
  const { user } = useAuth();
  const isProvider = user?.role === "provider";
  const query = useQuery({
    queryKey: ["provider", "profile"],
    queryFn: () => adminRequest<ProviderDetail>("/api/provider/profile"),
    enabled: isProvider,
  });
  const [draft, setDraft] = useState<ProviderDetail | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    price: "",
    durationMinutes: "60",
    category: "grooming",
    imageUrl: "",
  });
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "0",
    category: "pet-supplies",
    imageUrl: "",
  });
  const [recordForm, setRecordForm] = useState({
    type: "grooming",
    petId: "",
    title: "",
    date: "",
    nextDue: "",
    notes: "",
  });
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState<
    "grooming" | "vaccination" | null
  >(null);
  const [showBackgroundForm, setShowBackgroundForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [providerTab, setProviderTab] = useState<"workspace" | "records">(
    "workspace",
  );
  const [selectedProviderPet, setSelectedProviderPet] =
    useState<ProviderPet | null>(null);
  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);
  const updateProfile = useMutation({
    mutationFn: (profile: ProviderDetail) =>
      adminRequest<ProviderDetail>("/api/provider/profile", {
        method: "PATCH",
        body: JSON.stringify(profile),
      }),
    onSuccess: (profile) => {
      setDraft(profile);
      queryClient.invalidateQueries({ queryKey: ["provider", "profile"] });
      queryClient.invalidateQueries({ queryKey: getListProvidersQueryKey() });
    },
  });
  const bookingsQuery = useQuery({
    queryKey: ["provider", "bookings"],
    queryFn: () => adminRequest<AdminBooking[]>("/api/provider/bookings"),
    enabled: isProvider,
  });
  const updateBooking = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminRequest<AdminBooking>(`/api/provider/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["provider", "bookings"] }),
  });
  const addService = useMutation({
    mutationFn: () =>
      adminRequest<ProviderService>("/api/provider/services", {
        method: "POST",
        body: JSON.stringify({
          ...serviceForm,
          price: Number(serviceForm.price),
          durationMinutes: Number(serviceForm.durationMinutes),
        }),
      }),
    onSuccess: () => {
      setServiceForm({
        name: "",
        description: "",
        price: "",
        durationMinutes: "60",
        category: "grooming",
        imageUrl: "",
      });
      setShowServiceForm(false);
      query.refetch();
      setNotice("Service added.");
    },
  });
  const deleteService = useMutation({
    mutationFn: (id: number) =>
      adminRequest<void>(`/api/provider/services/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      query.refetch();
      setNotice("Service removed.");
    },
  });
  const updateService = useMutation({
    mutationFn: ({ id, service }: { id: number; service: ProviderService }) =>
      adminRequest<ProviderService>(`/api/provider/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify(service),
      }),
    onSuccess: () => {
      setEditingServiceId(null);
      query.refetch();
      setNotice("Service updated.");
    },
  });
  const addProduct = useMutation({
    mutationFn: async () => {
      const name = productForm.name.trim();
      const description = productForm.description.trim();
      const price = Number(productForm.price);
      const stock = Number(productForm.stock);
      if (!name) throw new Error("Product name is required.");
      if (!description) throw new Error("Product description is required.");
      if (!Number.isFinite(price) || price < 0)
        throw new Error("Enter a valid non-negative price.");
      if (!Number.isInteger(stock) || stock < 0)
        throw new Error("Stock must be a non-negative whole number.");
      if (productForm.imageUrl.length > 9_000_000)
        throw new Error(
          "The product image is too large. Choose an image smaller than 6 MB.",
        );
      return adminRequest<ProviderProduct>("/api/provider/products", {
        method: "POST",
        body: JSON.stringify({
          ...productForm,
          name,
          description,
          price,
          stock,
        }),
      });
    },
    onSuccess: async (product) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              categories: current.categories.includes("pet-supplies")
                ? current.categories
                : [...current.categories, "pet-supplies"],
              products: [...current.products, product],
            }
          : current,
      );
      setProductForm({
        name: "",
        description: "",
        price: "",
        stock: "0",
        category: "pet-supplies",
        imageUrl: "",
      });
      setShowProductForm(false);
      await query.refetch();
      queryClient.invalidateQueries({
        queryKey: getGetProviderQueryKey(product.providerId),
      });
      queryClient.invalidateQueries({ queryKey: getListProvidersQueryKey() });
      setNotice("Product added.");
    },
  });
  const deleteProduct = useMutation({
    mutationFn: (id: number) =>
      adminRequest<void>(`/api/provider/products/${id}`, { method: "DELETE" }),
    onSuccess: () => query.refetch(),
  });
  const updateProduct = useMutation({
    mutationFn: ({ id, product }: { id: number; product: ProviderProduct }) =>
      adminRequest<ProviderProduct>(`/api/provider/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(product),
      }),
    onSuccess: () => {
      setEditingProductId(null);
      query.refetch();
      setNotice("Product updated.");
    },
  });
  const providerOrdersQuery = useQuery({
    queryKey: ["provider", "orders"],
    queryFn: () =>
      adminRequest<import("@workspace/api-client-react").Order[]>(
        "/api/provider/orders",
      ),
    enabled: isProvider,
  });
  const recordsQuery = useQuery({
    queryKey: ["provider", "records"],
    queryFn: () => adminRequest<ProviderRecord[]>("/api/provider/records"),
    enabled: isProvider,
  });
  const providerPetsQuery = useQuery({
    queryKey: ["provider", "pets"],
    queryFn: () => adminRequest<ProviderPet[]>("/api/provider/pets"),
    enabled: isProvider && providerTab === "records",
  });
  const selectedProviderPetQuery = useQuery({
    queryKey: ["provider", "pet-records", selectedProviderPet?.id],
    queryFn: () =>
      adminRequest<{
        pet: Pet;
        owner: { name: string; email: string };
        records: ProviderRecord[];
      }>(`/api/provider/pets/${selectedProviderPet?.id}/records`),
    enabled: Boolean(selectedProviderPet),
  });
  const addRecord = useMutation({
    mutationFn: () =>
      adminRequest<ProviderRecord>("/api/provider/records", {
        method: "POST",
        body: JSON.stringify({
          ...recordForm,
          petId: Number(recordForm.petId),
          nextDue: recordForm.nextDue || null,
        }),
      }),
    onSuccess: () => {
      setRecordForm({
        type: "grooming",
        petId: "",
        title: "",
        date: "",
        nextDue: "",
        notes: "",
      });
      setShowRecordForm(null);
      recordsQuery.refetch();
      setNotice("History record added.");
    },
  });
  const updateRecord = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      adminRequest<ProviderRecord>(`/api/provider/records/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => recordsQuery.refetch(),
  });
  if (!isProvider) return <NotFound />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => query.refetch()}
        message={
          query.error instanceof Error
            ? query.error.message
            : "Provider information could not be loaded."
        }
      />
    );
  if (query.isLoading || !draft)
    return <LoadingState label="Loading provider information" />;
  const change = (
    key: "name" | "location" | "description" | "contact" | "hours",
    value: string,
  ) => setDraft({ ...draft, [key]: value });
  const changeBackground = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setDraft({
        ...draft,
        imageUrl: typeof reader.result === "string" ? reader.result : "",
      });
    reader.readAsDataURL(file);
  };
  const readImage = (
    file: File | undefined,
    onRead: (value: string) => void,
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onRead(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const editingService = draft.services.find(
    (item) => item.id === editingServiceId,
  );
  const editingProduct = draft.products.find(
    (item) => item.id === editingProductId,
  );
  return (
    <div className="animate-in">
      <p className="eyebrow">Provider workspace</p>
      <h1 className="page-title">Manage your services.</h1>
      <p className="page-subtitle">
        Update the provider information, services, and products customers can
        view.
      </p>
      {notice ? (
        <p className="mt-4 text-sm font-semibold text-primary" role="status">
          {notice}
        </p>
      ) : null}
      <div className="mt-6 flex gap-2">
        <button
          className={`filter-chip ${providerTab === "workspace" ? "active" : ""}`}
          onClick={() => setProviderTab("workspace")}
        >
          Workspace
        </button>
        <button
          className={`filter-chip ${providerTab === "records" ? "active" : ""}`}
          onClick={() => setProviderTab("records")}
        >
          Pet Records
        </button>
      </div>
      {providerTab === "records" ? (
        <section className="surface-card mt-6 p-6">
          <p className="eyebrow">Provider records</p>
          <h2 className="section-title mt-1">
            Pets connected to your bookings
          </h2>
          {providerPetsQuery.isLoading ? (
            <LoadingState label="Loading connected pets" />
          ) : providerPetsQuery.isError ? (
            <ErrorState
              onRetry={() => providerPetsQuery.refetch()}
              message={providerPetsQuery.error.message}
            />
          ) : (
            <div className="list-stack mt-5">
              {(providerPetsQuery.data ?? []).map((pet) => (
                <button
                  className="service-row text-left"
                  key={pet.id}
                  onClick={() => setSelectedProviderPet(pet)}
                >
                  <div>
                    <p className="font-semibold">{pet.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pet.species} · {pet.breed} · Owner: {pet.ownerName}
                    </p>
                  </div>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          )}
          {selectedProviderPet && selectedProviderPetQuery.data ? (
            <div className="modal-backdrop" role="presentation">
              <div
                className="modal animate-in"
                role="dialog"
                aria-modal="true"
                aria-labelledby="provider-pet-title"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">Pet Records</p>
                    <h2 id="provider-pet-title" className="modal-title">
                      {selectedProviderPetQuery.data.pet.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Owner: {selectedProviderPetQuery.data.owner.name}
                    </p>
                  </div>
                  <button
                    className="modal-close"
                    onClick={() => setSelectedProviderPet(null)}
                    aria-label="Close pet records"
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="list-stack mt-5">
                  {selectedProviderPetQuery.data.records.length ? (
                    selectedProviderPetQuery.data.records.map((record) => (
                      <div className="record-item" key={record.id}>
                        <p className="eyebrow">
                          {record.serviceCategory ?? record.type}
                        </p>
                        <p className="font-semibold">{record.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.providerName} · {formatDate(record.date)} ·{" "}
                          {statusLabel(record.status)}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {record.notes}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No completed records for this pet yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {providerTab === "records" ? null : (
        <>
          <section className="surface-card mt-6 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Store background</p>
                <h2 className="section-title mt-1">
                  {draft.imageUrl
                    ? "Background uploaded"
                    : "No background uploaded"}
                </h2>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setShowBackgroundForm((open) => !open)}
              >
                {draft.imageUrl
                  ? "Change background"
                  : "+ Add store background"}
              </button>
            </div>
            {draft.imageUrl ? (
              <img
                className="mt-4 h-32 w-full object-cover"
                src={draft.imageUrl}
                alt="Store background preview"
              />
            ) : null}
            {showBackgroundForm ? (
              <div className="modal-backdrop" role="presentation">
                <div
                  className="modal animate-in"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="background-title"
                >
                  <h2 id="background-title" className="modal-title mb-5">
                    Store background
                  </h2>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      changeBackground(event.target.files?.[0])
                    }
                  />
                  <div className="mt-5 flex gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        updateProfile.mutate(draft);
                        setShowBackgroundForm(false);
                      }}
                    >
                      Upload
                    </button>
                    {draft.imageUrl ? (
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          const next = { ...draft, imageUrl: "" };
                          setDraft(next);
                          updateProfile.mutate(next);
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                    <button
                      className="btn btn-ghost"
                      onClick={() => setShowBackgroundForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
          <div className="surface-card mt-8 p-6">
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">Provider name</label>
                <input
                  className="input"
                  value={draft.name}
                  onChange={(event) => change("name", event.target.value)}
                  onBlur={() => updateProfile.mutate(draft)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Location</label>
                <input
                  className="input"
                  value={draft.location}
                  onChange={(event) => change("location", event.target.value)}
                  onBlur={() => updateProfile.mutate(draft)}
                />
              </div>
              <div className="form-field full">
                <label className="form-label">Description</label>
                <textarea
                  className="input h-24 py-3"
                  value={draft.description}
                  onChange={(event) =>
                    change("description", event.target.value)
                  }
                  onBlur={() => updateProfile.mutate(draft)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Contact</label>
                <input
                  className="input"
                  value={draft.contact}
                  onChange={(event) => change("contact", event.target.value)}
                  onBlur={() => updateProfile.mutate(draft)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Hours</label>
                <input
                  className="input"
                  value={draft.hours}
                  onChange={(event) => change("hours", event.target.value)}
                  onBlur={() => updateProfile.mutate(draft)}
                />
              </div>
            </div>
            <div className="mt-8 flex items-center justify-between gap-3">
              <h2 className="section-title">My services</h2>
              <button
                className="btn btn-secondary"
                onClick={() => setShowServiceForm((open) => !open)}
              >
                + Add a service
              </button>
            </div>
            {showServiceForm ? (
              <div
                className="modal-backdrop"
                role="presentation"
                onMouseDown={(event) =>
                  event.target === event.currentTarget &&
                  setShowServiceForm(false)
                }
              >
                <div
                  className="modal animate-in"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="add-service-title"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">Provider services</p>
                      <h2 id="add-service-title" className="modal-title">
                        Add new service
                      </h2>
                    </div>
                    <button
                      className="modal-close"
                      onClick={() => setShowServiceForm(false)}
                      aria-label="Close add service"
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <div className="form-grid mt-5">
                    <input
                      className="input"
                      placeholder="Service name"
                      value={serviceForm.name}
                      onChange={(event) =>
                        setServiceForm({
                          ...serviceForm,
                          name: event.target.value,
                        })
                      }
                    />
                    <input
                      className="input"
                      placeholder="Description"
                      value={serviceForm.description}
                      onChange={(event) =>
                        setServiceForm({
                          ...serviceForm,
                          description: event.target.value,
                        })
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      placeholder="Price"
                      value={serviceForm.price}
                      onChange={(event) =>
                        setServiceForm({
                          ...serviceForm,
                          price: event.target.value,
                        })
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      placeholder="Duration minutes"
                      value={serviceForm.durationMinutes}
                      onChange={(event) =>
                        setServiceForm({
                          ...serviceForm,
                          durationMinutes: event.target.value,
                        })
                      }
                    />
                    <select
                      className="input select"
                      value={serviceForm.category}
                      onChange={(event) =>
                        setServiceForm({
                          ...serviceForm,
                          category: event.target.value,
                        })
                      }
                    >
                      <option value="grooming">Grooming</option>
                      <option value="vaccination">Vaccination</option>
                    </select>
                    <input
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        readImage(event.target.files?.[0], (imageUrl) =>
                          setServiceForm({ ...serviceForm, imageUrl }),
                        )
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() => addService.mutate()}
                        disabled={addService.isPending}
                      >
                        Save service
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setShowServiceForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="list-stack mt-4">
              {draft.services.map((service) => (
                <div key={service.id}>
                  <div className="service-row">
                    <div className="flex-1">
                      <p className="font-semibold">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.category} · {money(service.price)} ·{" "}
                        {service.available === false
                          ? "Unavailable"
                          : "Available"}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        setEditingServiceId(
                          editingServiceId === service.id ? null : service.id,
                        )
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        window.confirm(`Remove ${service.name}?`) &&
                        deleteService.mutate(service.id)
                      }
                      disabled={deleteService.isPending}
                    >
                      Remove
                    </button>
                  </div>
                  {false && editingServiceId === service.id ? <div /> : null}
                </div>
              ))}
            </div>
            <section className="surface-card mt-8 border p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Shop inventory</p>
                  <h2 className="section-title mt-1">Pet Supply Products</h2>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowProductForm((open) => !open)}
                >
                  + Add a product
                </button>
              </div>
              <div className="list-stack mt-4">
                {draft.products.map((product) => (
                  <div className="service-row" key={product.id}>
                    {product.imageUrl ? (
                      <img
                        className="product-thumb"
                        src={product.imageUrl}
                        alt=""
                      />
                    ) : null}
                    <div className="flex-1">
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.category} · {money(product.price)} ·{" "}
                        {product.stock} in stock ·{" "}
                        {product.active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditingProductId(product.id)}
                    >
                      Edit
                    </button>
                    {product.active ? (
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          window.confirm(`Deactivate ${product.name}?`) &&
                          deleteProduct.mutate(product.id)
                        }
                        disabled={deleteProduct.isPending}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          updateProduct.mutate({
                            id: product.id,
                            product: { ...product, active: true },
                          })
                        }
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {showProductForm ? (
                <div
                  className="modal-backdrop"
                  role="presentation"
                  onMouseDown={(event) =>
                    event.target === event.currentTarget &&
                    setShowProductForm(false)
                  }
                >
                  <div
                    className="modal animate-in"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="add-product-title"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow">Pet supplies</p>
                        <h2 id="add-product-title" className="modal-title">
                          Add new product
                        </h2>
                      </div>
                      <button
                        className="modal-close"
                        onClick={() => setShowProductForm(false)}
                        aria-label="Close add product"
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="form-grid mt-5">
                      <input
                        className="input"
                        placeholder="Product name"
                        value={productForm.name}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            name: event.target.value,
                          })
                        }
                      />
                      <input
                        className="input"
                        placeholder="Description"
                        value={productForm.description}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            description: event.target.value,
                          })
                        }
                      />
                      <input
                        className="input"
                        type="number"
                        placeholder="Price"
                        value={productForm.price}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            price: event.target.value,
                          })
                        }
                      />
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Stock quantity"
                        value={productForm.stock}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            stock: event.target.value,
                          })
                        }
                      />
                      <input
                        className="input"
                        placeholder="Product category"
                        value={productForm.category}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            category: event.target.value,
                          })
                        }
                      />
                      <input
                        className="input"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          readImage(event.target.files?.[0], (imageUrl) =>
                            setProductForm({ ...productForm, imageUrl }),
                          )
                        }
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => addProduct.mutate()}
                        disabled={addProduct.isPending}
                        type="button"
                      >
                        {addProduct.isPending
                          ? "Saving product…"
                          : "Save product"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setShowProductForm(false)}
                      >
                        Cancel
                      </button>
                      {addProduct.isError ? (
                        <p
                          className="text-sm font-semibold text-destructive"
                          role="alert"
                        >
                          {addProduct.error.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {editingProduct ? (
                <div className="modal-backdrop" role="presentation">
                  <div
                    className="modal animate-in"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-product-title"
                  >
                    <h2 id="edit-product-title" className="modal-title mb-5">
                      Edit product
                    </h2>
                    <div className="form-grid">
                      <input
                        className="input"
                        value={editingProduct.name}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            products: draft.products.map((item) =>
                              item.id === editingProduct.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <input
                        className="input"
                        value={editingProduct.description}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            products: draft.products.map((item) =>
                              item.id === editingProduct.id
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <input
                        className="input"
                        type="number"
                        value={editingProduct.price}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            products: draft.products.map((item) =>
                              item.id === editingProduct.id
                                ? { ...item, price: Number(event.target.value) }
                                : item,
                            ),
                          })
                        }
                      />
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="1"
                        value={editingProduct.stock}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            products: draft.products.map((item) =>
                              item.id === editingProduct.id
                                ? { ...item, stock: Number(event.target.value) }
                                : item,
                            ),
                          })
                        }
                      />
                      <input
                        className="input"
                        value={editingProduct.category}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            products: draft.products.map((item) =>
                              item.id === editingProduct.id
                                ? { ...item, category: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <input
                        className="input"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          readImage(event.target.files?.[0], (imageUrl) =>
                            setDraft({
                              ...draft,
                              products: draft.products.map((item) =>
                                item.id === editingProduct.id
                                  ? { ...item, imageUrl }
                                  : item,
                              ),
                            }),
                          )
                        }
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editingProduct.active}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              products: draft.products.map((item) =>
                                item.id === editingProduct.id
                                  ? { ...item, active: event.target.checked }
                                  : item,
                              ),
                            })
                          }
                        />{" "}
                        Active
                      </label>
                    </div>
                    <div className="mt-5 flex gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          updateProduct.mutate({
                            id: editingProduct.id,
                            product: editingProduct,
                          })
                        }
                      >
                        Save changes
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          query.refetch();
                          setEditingProductId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
          <section className="surface-card mt-6 p-6">
            <p className="eyebrow">Product orders</p>
            <h2 className="section-title mt-1">Provider Orders</h2>
            {providerOrdersQuery.data?.length ? (
              <div className="table-wrap mt-5">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Products</th>
                      <th>Quantity</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerOrdersQuery.data.map((order) => (
                      <tr key={order.id}>
                        <td>#{order.id}</td>
                        <td>{order.customerName}</td>
                        <td>
                          {order.items
                            .map(
                              (item) =>
                                `${item.productName} (${money(item.price)})`,
                            )
                            .join(", ")}
                        </td>
                        <td>{order.itemCount}</td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td>
                          <span
                            className={`status status-${order.status.toLowerCase()}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td>{money(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                No product orders yet.
              </p>
            )}
          </section>
          <section className="surface-card mt-6 p-6">
            <p className="eyebrow">Booking requests</p>
            <h2 className="section-title mt-1">Your provider bookings</h2>
            {bookingsQuery.isLoading ? (
              <div className="mt-5">
                <LoadingState label="Loading your booking requests" />
              </div>
            ) : bookingsQuery.data?.length ? (
              <div className="table-wrap mt-5">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Pet</th>
                      <th>Schedule</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingsQuery.data.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.serviceName}</td>
                        <td>{booking.petName}</td>
                        <td>
                          {formatDate(booking.date)} at {booking.time}
                        </td>
                        <td>
                          <span className={`status status-${booking.status}`}>
                            {statusLabel(booking.status)}
                          </span>
                          {booking.status === "cancellation_pending" ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                className="btn btn-primary h-9 min-h-0 text-xs"
                                disabled={updateBooking.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Approve this cancellation request?",
                                    )
                                  )
                                    updateBooking.mutate({
                                      id: booking.id,
                                      status: "approve_cancellation",
                                    });
                                }}
                              >
                                Approve cancellation
                              </button>
                              <button
                                className="btn btn-ghost h-9 min-h-0 text-xs"
                                disabled={updateBooking.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Reject this cancellation request?",
                                    )
                                  )
                                    updateBooking.mutate({
                                      id: booking.id,
                                      status: "reject_cancellation",
                                    });
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : null}
                          {booking.status === "pending" ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                className="btn btn-primary h-9 min-h-0 text-xs"
                                disabled={updateBooking.isPending}
                                onClick={() =>
                                  updateBooking.mutate({
                                    id: booking.id,
                                    status: "confirmed",
                                  })
                                }
                              >
                                Confirm
                              </button>
                              <button
                                className="btn btn-ghost h-9 min-h-0 text-xs"
                                disabled={updateBooking.isPending}
                                onClick={() =>
                                  window.confirm("Cancel this booking?") &&
                                  updateBooking.mutate({
                                    id: booking.id,
                                    status: "cancelled",
                                  })
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          ) : null}
                          {booking.status === "confirmed" ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                className="btn btn-secondary h-9 min-h-0 text-xs"
                                disabled={updateBooking.isPending}
                                onClick={() =>
                                  updateBooking.mutate({
                                    id: booking.id,
                                    status: "completed",
                                  })
                                }
                              >
                                Complete service
                              </button>
                              <button
                                className="btn btn-ghost h-9 min-h-0 text-xs"
                                disabled={updateBooking.isPending}
                                onClick={() =>
                                  window.confirm("Cancel this booking?") &&
                                  updateBooking.mutate({
                                    id: booking.id,
                                    status: "cancelled",
                                  })
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                No booking requests yet.
              </p>
            )}
          </section>
        </>
      )}
      <section className="surface-card mt-6 p-6">
        <p className="eyebrow">Provider records</p>
        <h2 className="section-title mt-1">Grooming and vaccination history</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setRecordForm({ ...recordForm, type: "vaccination" });
              setShowRecordForm(
                showRecordForm === "vaccination" ? null : "vaccination",
              );
            }}
          >
            + Add vaccination record
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setRecordForm({ ...recordForm, type: "grooming" });
              setShowRecordForm(
                showRecordForm === "grooming" ? null : "grooming",
              );
            }}
          >
            + Add grooming record
          </button>
        </div>
        {showRecordForm ? (
          <div className="modal-backdrop" role="presentation">
            <div
              className="modal animate-in"
              role="dialog"
              aria-modal="true"
              aria-labelledby="record-title"
            >
              <h2 id="record-title" className="modal-title mb-5">
                Add {showRecordForm} record
              </h2>
              <div className="form-grid">
                <select
                  className="input select"
                  value={recordForm.type}
                  onChange={(event) =>
                    setRecordForm({ ...recordForm, type: event.target.value })
                  }
                >
                  <option value="grooming">Grooming</option>
                  <option value="vaccination">Vaccination</option>
                </select>
                <select
                  className="input select"
                  value={recordForm.petId}
                  onChange={(event) =>
                    setRecordForm({ ...recordForm, petId: event.target.value })
                  }
                >
                  <option value="">Pet from a booking</option>
                  {(bookingsQuery.data ?? []).map((booking) => (
                    <option
                      key={`${booking.id}-${booking.petId}`}
                      value={booking.petId}
                    >
                      {booking.petName}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  placeholder="Title or vaccine/service"
                  value={recordForm.title}
                  onChange={(event) =>
                    setRecordForm({ ...recordForm, title: event.target.value })
                  }
                />
                <input
                  className="input"
                  type="date"
                  value={recordForm.date}
                  onChange={(event) =>
                    setRecordForm({ ...recordForm, date: event.target.value })
                  }
                />
                {recordForm.type === "vaccination" ? (
                  <input
                    className="input"
                    type="date"
                    placeholder="Next due"
                    value={recordForm.nextDue}
                    onChange={(event) =>
                      setRecordForm({
                        ...recordForm,
                        nextDue: event.target.value,
                      })
                    }
                  />
                ) : null}
                <textarea
                  className="input h-20 py-3"
                  placeholder="Notes"
                  value={recordForm.notes}
                  onChange={(event) =>
                    setRecordForm({ ...recordForm, notes: event.target.value })
                  }
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => addRecord.mutate()}
                  disabled={addRecord.isPending}
                >
                  Add history record
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowRecordForm(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="list-stack mt-5">
          {(recordsQuery.data ?? []).map((record) => (
            <div className="service-row" key={record.id}>
              <div className="flex-1">
                <p className="font-semibold">{record.title}</p>
                <p className="text-xs text-muted-foreground">
                  {record.type} · {formatDate(record.date)} · pet {record.petId}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {record.notes}
                </p>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const notes = window.prompt("Update notes", record.notes);
                  if (notes !== null)
                    updateRecord.mutate({ id: record.id, notes });
                }}
              >
                Edit notes
              </button>
            </div>
          ))}
        </div>
        {addRecord.isError ? (
          <p className="mt-3 text-sm text-destructive">
            {addRecord.error.message}
          </p>
        ) : null}
      </section>
      {editingService ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal animate-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-service-title"
          >
            <h2 id="edit-service-title" className="modal-title mb-5">
              Edit service
            </h2>
            <div className="form-grid">
              <input
                className="input"
                value={editingService.name}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    services: draft.services.map((item) =>
                      item.id === editingService.id
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  })
                }
              />
              <input
                className="input"
                value={editingService.description}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    services: draft.services.map((item) =>
                      item.id === editingService.id
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  })
                }
              />
              <input
                className="input"
                type="number"
                value={editingService.price}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    services: draft.services.map((item) =>
                      item.id === editingService.id
                        ? { ...item, price: Number(event.target.value) }
                        : item,
                    ),
                  })
                }
              />
              <select
                className="input select"
                value={editingService.category}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    services: draft.services.map((item) =>
                      item.id === editingService.id
                        ? { ...item, category: event.target.value }
                        : item,
                    ),
                  })
                }
              >
                <option value="grooming">Grooming</option>
                <option value="vaccination">Vaccination</option>
              </select>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  readImage(event.target.files?.[0], (imageUrl) =>
                    setDraft({
                      ...draft,
                      services: draft.services.map((item) =>
                        item.id === editingService.id
                          ? { ...item, imageUrl }
                          : item,
                      ),
                    }),
                  )
                }
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingService.available !== false}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      services: draft.services.map((item) =>
                        item.id === editingService.id
                          ? { ...item, available: event.target.checked }
                          : item,
                      ),
                    })
                  }
                />{" "}
                Available
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                className="btn btn-primary"
                onClick={() =>
                  updateService.mutate({
                    id: editingService.id,
                    service: editingService,
                  })
                }
              >
                Save changes
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  query.refetch();
                  setEditingServiceId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PetForm({
  pet,
  onClose,
  onSaved,
}: {
  pet?: Pet;
  onClose: () => void;
  onSaved: () => void;
}) {
  const createPet = useCreatePet();
  const updatePet = useUpdatePet();
  const deletePet = useMutation({
    mutationFn: (id: number) =>
      adminRequest<void>(`/api/pets/${id}`, { method: "DELETE" }),
  });
  const [form, setForm] = useState({
    name: pet?.name ?? "",
    species: pet?.species ?? "Dog",
    breed: pet?.breed ?? "",
    age: pet?.age ?? "",
    gender: pet?.gender ?? "",
    weight: pet?.weight ?? "",
    notes: pet?.notes ?? "",
  });
  const change = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.name || !form.breed || !form.age) return;
    if (pet)
      updatePet.mutate({ petId: pet.id, data: form }, { onSuccess: onSaved });
    else createPet.mutate({ data: form }, { onSuccess: onSaved });
  };
  const remove = () => {
    if (!pet || !window.confirm(`Remove ${pet.name}'s pet profile?`)) return;
    deletePet.mutate(pet.id, { onSuccess: onSaved });
  };
  const pending =
    createPet.isPending || updatePet.isPending || deletePet.isPending;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal modal-split animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pet-form-title"
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">
              {pet ? "Update their profile" : "Welcome to the nest"}
            </p>
            <h2 id="pet-form-title" className="modal-title">
              {pet ? `Edit ${pet.name}` : "Add a pet"}
            </h2>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close pet form"
            data-testid="button-close-pet-form"
          >
            <X size={17} />
          </button>
        </header>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="pet-name">
                Name
              </label>
              <input
                className="input"
                id="pet-name"
                value={form.name}
                onChange={(event) => change("name", event.target.value)}
                placeholder="Their everyday name"
                data-testid="input-pet-name"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="pet-species">
                Species
              </label>
              <select
                className="input select"
                id="pet-species"
                value={form.species}
                onChange={(event) => change("species", event.target.value)}
                data-testid="select-pet-species"
              >
                <option>Dog</option>
                <option>Cat</option>
                <option>Rabbit</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="pet-breed">
                Breed
              </label>
              <input
                className="input"
                id="pet-breed"
                value={form.breed}
                onChange={(event) => change("breed", event.target.value)}
                placeholder="e.g. Corgi mix"
                data-testid="input-pet-breed"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="pet-age">
                Age
              </label>
              <input
                className="input"
                id="pet-age"
                value={form.age}
                onChange={(event) => change("age", event.target.value)}
                placeholder="e.g. 3 years"
                data-testid="input-pet-age"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="pet-gender">
                Gender
              </label>
              <select
                className="input select"
                id="pet-gender"
                value={form.gender}
                onChange={(event) => change("gender", event.target.value)}
                data-testid="select-pet-gender"
              >
                <option value="">Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Unknown</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="pet-weight">
                Weight
              </label>
              <input
                className="input"
                id="pet-weight"
                value={form.weight}
                onChange={(event) => change("weight", event.target.value)}
                placeholder="e.g. 28 lb"
                data-testid="input-pet-weight"
              />
            </div>
            <div className="form-field full">
              <label className="form-label" htmlFor="pet-notes">
                Notes for providers
              </label>
              <textarea
                className="input h-24 resize-none py-3"
                id="pet-notes"
                value={form.notes}
                onChange={(event) => change("notes", event.target.value)}
                placeholder="Sensitivities, favorite treats, things worth knowing"
                data-testid="textarea-pet-notes"
              />
            </div>
          </div>
          {createPet.isError || updatePet.isError || deletePet.isError ? (
            <p
              className="mt-4 text-sm font-semibold text-destructive"
              data-testid="text-pet-form-error"
            >
              We could not save this profile. Please try again.
            </p>
          ) : null}
        </div>
        <footer className="modal-foot">
          {pet ? (
            <button
              className="btn btn-ghost text-destructive"
              onClick={remove}
              disabled={pending}
              data-testid="button-remove-pet"
            >
              <Trash2 size={15} /> Remove
            </button>
          ) : null}
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={pending || !form.name || !form.breed || !form.age}
            data-testid="button-save-pet"
          >
            {pending
              ? "Saving profile…"
              : pet
                ? "Save changes"
                : "Add to my nest"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PetCard({
  pet,
  onEdit,
  onSelect,
  selected,
}: {
  pet: Pet;
  onEdit: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      className={`pet-card wavy tone-${pet.id % 4} ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      data-testid={`card-pet-${pet.id}`}
    >
      {/* A tinted crown carries the pet's portrait; the body holds the facts. */}
      <span className="pet-crown">
        <span className="pet-avatar">
          {pet.avatarUrl ? (
            <img
              className="h-full w-full rounded-[inherit] object-cover"
              src={pet.avatarUrl}
              alt=""
            />
          ) : (
            initials(pet.name)
          )}
        </span>
        <span className="tag pet-species">{pet.species}</span>
      </span>
      <span className="pet-body">
        <span className="pet-name">{pet.name}</span>
        <span className="pet-sub">
          {pet.breed} · {pet.age}
        </span>
        <span className="pet-facts">
          <span className="pet-fact">
            <span className="pet-fact-label">Weight</span>
            <span className="pet-fact-value">{pet.weight || "Not added"}</span>
          </span>
          <span className="pet-fact">
            <span className="pet-fact-label">Next vaccine</span>
            <span className="pet-fact-value">
              {formatDate(pet.nextVaccine)}
            </span>
          </span>
        </span>
        <span
          className="pet-edit"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          data-testid={`button-edit-pet-${pet.id}`}
        >
          <Pencil size={13} /> Edit profile
        </span>
      </span>
    </button>
  );
}

function RecordsPanel({ pet }: { pet: Pet }) {
  const [tab, setTab] = useState<"grooming" | "vaccinations">("grooming");
  const query = useGetPetRecords(pet.id, {
    query: { enabled: !!pet.id, queryKey: getGetPetRecordsQueryKey(pet.id) },
  });
  const records = query.data?.[tab] ?? [];
  return (
    <div className="record-layout">
      <div className="surface-card p-5">
        <p className="eyebrow">Selected pet</p>
        <h2 className="section-title mt-1">{pet.name}'s Pet Records</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {pet.species} · {pet.breed} · {pet.age}
        </p>
      </div>
      <div className="record-tabs surface-card">
        <p className="eyebrow px-3 pb-2">Care record</p>
        <button
          className={`record-tab ${tab === "grooming" ? "active" : ""}`}
          onClick={() => setTab("grooming")}
          data-testid="button-records-grooming"
        >
          <span className="flex items-center gap-2">
            <Sparkles size={15} /> Grooming
          </span>
          <span>{query.data?.grooming.length ?? 0}</span>
        </button>
        <button
          className={`record-tab ${tab === "vaccinations" ? "active" : ""}`}
          onClick={() => setTab("vaccinations")}
          data-testid="button-records-vaccinations"
        >
          <span className="flex items-center gap-2">
            <Syringe size={15} /> Vaccinations
          </span>
          <span>{query.data?.vaccinations.length ?? 0}</span>
        </button>
      </div>
      <div>
        {query.isLoading ? (
          <LoadingState label="Opening their care records" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : records.length ? (
          <div className="list-stack">
            {records.map((record) => (
              <div
                className="record-item"
                key={record.id}
                data-testid={`record-care-${record.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">{record.type}</p>
                    <h3 className="mt-1 font-display text-2xl">
                      {record.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {record.providerName} · {formatDate(record.date)}
                    </p>
                    {record.bookingId ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Booking #{record.bookingId}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`status status-${record.status.toLowerCase()}`}
                  >
                    {record.status}
                  </span>
                </div>
                {record.notes ? (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {record.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="A clean slate"
            copy={`No ${tab === "grooming" ? "grooming" : "vaccination"} records yet. They will appear after a provider visit.`}
          />
        )}
      </div>
    </div>
  );
}

function PetsPage() {
  const query = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const [modal, setModal] = useState<"create" | Pet | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const pets = query.data ?? [];
  const selectedPet = pets.find((pet) => pet.id === selected) ?? pets[0];
  const saveComplete = () => {
    setModal(null);
    queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
  };
  return (
    <div className="animate-in">
      <header className="page-head">
        <div>
          <p className="eyebrow">The nest</p>
          <h1 className="page-title">
            Your pets,
            <br />
            properly known.
          </h1>
          <p className="page-subtitle">
            Keep the small details in one place so every provider can care for
            them like you do.
          </p>
        </div>
        <div className="page-head-counts">
          <span className="head-count">
            <strong>{pets.length}</strong> in the nest
          </span>
        </div>
      </header>
      <div className="mt-8">
        {query.isLoading ? (
          <LoadingState label="Loading your pet profiles" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : pets.length ? (
          <>
            <div className="pet-grid">
              {pets.map((pet) => (
                <PetCard
                  key={pet.id}
                  pet={pet}
                  selected={selectedPet?.id === pet.id}
                  onSelect={() => setSelected(pet.id)}
                  onEdit={() => setModal(pet)}
                />
              ))}
              {/* The add action lives in the grid, where the pets are. */}
              <button
                className="pet-add"
                onClick={() => setModal("create")}
                data-testid="button-add-pet"
              >
                <span className="pet-add-icon">
                  <Plus size={22} />
                </span>
                <span className="pet-add-label">Add a pet</span>
                <span className="pet-add-copy">
                  Name, breed, and the small things worth knowing.
                </span>
              </button>
            </div>
            {selectedPet ? <RecordsPanel pet={selectedPet} /> : null}
          </>
        ) : (
          <EmptyState
            icon={PawPrint}
            title="A nest starts with a name"
            copy="Add your first pet profile so bookings, providers, and care records all know who they are looking after."
            action={
              <button
                className="btn btn-primary"
                onClick={() => setModal("create")}
                data-testid="button-empty-add-pet"
              >
                <Plus size={15} /> Add first pet
              </button>
            }
          />
        )}
      </div>
      {modal ? (
        <PetForm
          pet={modal === "create" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={saveComplete}
        />
      ) : null}
    </div>
  );
}

function OrdersPage() {
  const { user } = useAuth();
  const query = useListOrders({ query: { queryKey: getListOrdersQueryKey() } });
  const orders = query.data ?? [];
  type CartLine = {
    providerId: number;
    providerName: string;
    product: ProviderProduct;
    quantity: number;
    selected: boolean;
  };
  const loadCart = (): CartLine[] => {
    const prefix = `petnest-cart-${user?.id ?? "guest"}-`;
    const lines: CartLine[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const providerId = Number(key.slice(prefix.length));
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
          product: ProviderProduct;
          quantity: number;
        }>;
        lines.push(
          ...stored.map((item) => ({
            ...item,
            providerId,
            providerName: `Shop #${providerId}`,
            selected: true,
          })),
        );
      } catch {
        /* Ignore only malformed local cart data. */
      }
    }
    return lines;
  };
  const [cart, setCart] = useState<CartLine[]>(loadCart);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartError, setCartError] = useState("");
  useEffect(() => {
    const providerIds = [...new Set(cart.map((item) => item.providerId))];
    void Promise.all(
      providerIds.map(async (providerId) => {
        try {
          const provider = await adminRequest<ProviderDetail>(
            `/api/providers/${providerId}`,
          );
          setCart((current) =>
            current.map((line) =>
              line.providerId !== providerId
                ? line
                : {
                    ...line,
                    providerName: provider.name,
                    product: provider.products.find(
                      (product) => product.id === line.product.id,
                    ) ?? { ...line.product, active: false, stock: 0 },
                  },
            ),
          );
        } catch {
          setCart((current) =>
            current.map((line) =>
              line.providerId === providerId
                ? {
                    ...line,
                    product: { ...line.product, active: false, stock: 0 },
                  }
                : line,
            ),
          );
        }
      }),
    );
  }, []);
  const persistCart = (next: CartLine[]) => {
    const providerIds = new Set([
      ...cart.map((item) => item.providerId),
      ...next.map((item) => item.providerId),
    ]);
    for (const providerId of providerIds) {
      const stored = next
        .filter((item) => item.providerId === providerId)
        .map(({ product, quantity }) => ({ product, quantity }));
      localStorage.setItem(
        `petnest-cart-${user?.id ?? "guest"}-${providerId}`,
        JSON.stringify(stored),
      );
    }
    setCart(next);
  };
  const selected = cart.filter((item) => item.selected);
  const cartTotal = selected.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const checkout = useMutation({
    mutationFn: async () => {
      const succeeded: number[] = [];
      let error = "";
      for (const providerId of [
        ...new Set(selected.map((item) => item.providerId)),
      ]) {
        const lines = selected.filter((item) => item.providerId === providerId);
        try {
          await adminRequest("/api/orders", {
            method: "POST",
            body: JSON.stringify({
              providerId,
              items: lines.map((item) => ({
                productId: item.product.id,
                quantity: item.quantity,
              })),
            }),
          });
          succeeded.push(providerId);
        } catch (reason) {
          error = reason instanceof Error ? reason.message : "Checkout failed.";
          break;
        }
      }
      return { succeeded, error };
    },
    onSuccess: ({ succeeded, error }) => {
      const successfulKeys = new Set(
        selected
          .filter((item) => succeeded.includes(item.providerId))
          .map((item) => `${item.providerId}:${item.product.id}`),
      );
      persistCart(
        cart.filter(
          (item) =>
            !successfulKeys.has(`${item.providerId}:${item.product.id}`),
        ),
      );
      query.refetch();
      setCheckoutOpen(false);
      setCartError(
        error || (succeeded.length ? "Order placed successfully." : ""),
      );
    },
  });
  return (
    <div className="animate-in">
      <p className="eyebrow">Good things, on the way</p>
      <h1 className="page-title">Supply orders.</h1>
      <p className="page-subtitle">
        Track the useful little things that keep your pet comfortable, fed, and
        entertained.
      </p>
      <section className="surface-card mt-8 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Shopping cart</p>
            <h2 className="section-title mt-1">Items ready to order</h2>
          </div>
          <span className="tag tag-accent">
            {cart.length} item{cart.length === 1 ? "" : "s"}
          </span>
        </div>
        {cart.length ? (
          <>
            <div className="list-stack mt-5">
              {cart.map((item) => (
                <div
                  className="product-row"
                  key={`${item.providerId}-${item.product.id}`}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(event) =>
                      persistCart(
                        cart.map((line) =>
                          line === item
                            ? { ...line, selected: event.target.checked }
                            : line,
                        ),
                      )
                    }
                    aria-label={`Select ${item.product.name}`}
                  />
                  {item.product.imageUrl ? (
                    <img
                      className="product-thumb"
                      src={item.product.imageUrl}
                      alt=""
                    />
                  ) : (
                    <div className="product-thumb grid place-items-center bg-muted">
                      <Package size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.providerName} · {money(item.product.price)}
                    </p>
                    <p
                      className={`mt-1 text-xs ${item.product.active && item.product.stock > 0 ? "text-muted-foreground" : "text-destructive"}`}
                    >
                      {item.product.active
                        ? item.product.stock > 0
                          ? `${item.product.stock} available`
                          : "Out of Stock"
                        : "No longer available"}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost h-9 min-h-0 px-3"
                    onClick={() =>
                      persistCart(
                        cart.map((line) =>
                          line === item
                            ? {
                                ...line,
                                quantity: Math.max(1, line.quantity - 1),
                              }
                            : line,
                        ),
                      )
                    }
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    className="btn btn-ghost h-9 min-h-0 px-3"
                    disabled={
                      !item.product.active ||
                      item.quantity >= item.product.stock
                    }
                    onClick={() =>
                      persistCart(
                        cart.map((line) =>
                          line === item
                            ? { ...line, quantity: line.quantity + 1 }
                            : line,
                        ),
                      )
                    }
                  >
                    +
                  </button>
                  <span className="w-24 text-right font-mono text-sm">
                    {money(item.product.price * item.quantity)}
                  </span>
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      persistCart(cart.filter((line) => line !== item))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-5 border-t pt-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  Subtotal / Total
                </p>
                <p className="font-mono text-xl font-semibold">
                  {money(cartTotal)}
                </p>
              </div>
              <button
                className="btn btn-primary"
                disabled={
                  !selected.length ||
                  selected.some(
                    (item) =>
                      !item.product.active ||
                      item.product.stock < item.quantity,
                  )
                }
                onClick={() => {
                  setCartError("");
                  setCheckoutOpen(true);
                }}
              >
                Checkout
              </button>
            </div>
          </>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            Your cart is empty. Add products from a Pet Supplies shop.
          </p>
        )}
        {cartError ? (
          <p
            className={`mt-3 text-sm ${cartError.includes("successfully") ? "text-primary" : "text-destructive"}`}
          >
            {cartError}
          </p>
        ) : null}
      </section>
      <div className="mt-8">
        {query.isLoading ? (
          <LoadingState label="Checking on your deliveries" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : orders.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Provider</th>
                  <th>Placed</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} data-testid={`row-order-${order.id}`}>
                    <td className="font-mono text-xs">
                      #{String(order.id).padStart(5, "0")}
                    </td>
                    <td>
                      <Link
                        href={`/providers/${order.providerId}`}
                        className="font-semibold hover:text-primary"
                        data-testid={`link-order-provider-${order.id}`}
                      >
                        {order.providerName}
                      </Link>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                      {order.items.length ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {order.items
                            .map(
                              (item) =>
                                `${item.productName} × ${item.quantity}`,
                            )
                            .join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`status status-${order.status.toLowerCase()}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {money(order.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title="Your basket is waiting"
            copy="When you find something useful from a local provider, your supply orders will live here."
            action={
              <Link
                href="/providers?category=pet-supplies"
                className="btn btn-primary"
                data-testid="link-orders-shop"
              >
                Shop pet supplies <ArrowRight size={14} />
              </Link>
            }
          />
        )}
      </div>
      {checkoutOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal animate-in" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Checkout</p>
                <h2 className="modal-title">Confirm selected items</h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setCheckoutOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="list-stack mt-5">
              {selected.map((item) => (
                <div
                  className="product-row"
                  key={`${item.providerId}-${item.product.id}`}
                >
                  <div className="flex-1">
                    <p className="font-semibold">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.providerName} · {item.quantity} ×{" "}
                      {money(item.product.price)}
                    </p>
                  </div>
                  <span className="font-mono">
                    {money(item.quantity * item.product.price)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-4 font-semibold">
              <span>Total</span>
              <span className="font-mono">{money(cartTotal)}</span>
            </div>
            <button
              className="btn btn-primary mt-5 w-full"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? "Placing order…" : "Place Order"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountPage() {
  const { user } = useAuth();
  const summary = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const pets = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const health = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey() },
  });
  const recent = summary.data?.recentActivity ?? [];
  return (
    <div className="animate-in">
      <p className="eyebrow">A quick look around</p>
      <h1 className="page-title">Hi, {user?.firstName || "there"}.</h1>
      <p className="page-subtitle">Your pet-care life, in one calm corner.</p>
      {summary.isLoading ? (
        <div className="mt-8">
          <LoadingState label="Preparing your account snapshot" />
        </div>
      ) : summary.isError ? (
        <div className="mt-8">
          <ErrorState onRetry={() => summary.refetch()} />
        </div>
      ) : (
        <>
          <div className="stat-grid mt-8">
            <div className="stat-card surface-card wavy">
              <p className="stat-value">{summary.data?.petCount ?? 0}</p>
              <p className="stat-label">pet profiles</p>
            </div>
            <div className="stat-card surface-card wavy">
              <p className="stat-value">
                {summary.data?.upcomingBookingCount ?? 0}
              </p>
              <p className="stat-label">upcoming bookings</p>
            </div>
            <div className="stat-card surface-card wavy">
              <p className="stat-value">{summary.data?.recordCount ?? 0}</p>
              <p className="stat-label">care records</p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            <section className="surface-card p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="eyebrow">Next on the calendar</p>
                  <h2 className="section-title mt-1">Your next visit</h2>
                </div>
                <Link
                  href="/bookings"
                  className="text-xs font-bold text-primary hover:underline"
                  data-testid="link-account-bookings"
                >
                  All bookings
                </Link>
              </div>
              {summary.data?.nextBooking ? (
                <div className="mt-5 rounded-2xl bg-accent p-5 text-accent-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-3xl">
                        {summary.data.nextBooking.serviceName}
                      </p>
                      <p className="mt-1 text-sm">
                        {summary.data.nextBooking.providerName} ·{" "}
                        {summary.data.nextBooking.petName}
                      </p>
                    </div>
                    <CalendarDays size={20} />
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-accent-foreground/15 pt-4 text-xs font-semibold">
                    <span>{formatDate(summary.data.nextBooking.date)}</span>
                    <span>{summary.data.nextBooking.time}</span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="Nothing booked yet"
                  copy="Find a provider when your pet is ready for their next bit of care."
                  action={
                    <Link
                      href="/providers"
                      className="btn btn-primary"
                      data-testid="link-account-discover"
                    >
                      Discover care
                    </Link>
                  }
                />
              )}
            </section>
            <section className="surface-card p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="eyebrow">Latest notes</p>
                  <h2 className="section-title mt-1">Care trail</h2>
                </div>
                <Link
                  href="/pets"
                  className="text-xs font-bold text-primary hover:underline"
                  data-testid="link-account-records"
                >
                  View records
                </Link>
              </div>
              {recent.length ? (
                <div className="mt-5 list-stack">
                  {recent.slice(0, 3).map((record: CareRecord) => (
                    <div
                      className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                      key={record.id}
                      data-testid={`activity-record-${record.id}`}
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                        {record.type === "vaccination" ? (
                          <Syringe size={14} />
                        ) : (
                          <Sparkles size={14} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{record.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {record.providerName} · {formatDate(record.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">
                  Your care notes will collect here after visits.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      <div className="mt-8 surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{user?.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          data-testid="status-health"
        >
          <span
            className={`h-2 w-2 rounded-full ${health.isError ? "bg-destructive" : "bg-primary"}`}
          />{" "}
          PetNest services {health.isError ? "are reconnecting" : "are healthy"}
        </div>
      </div>
      <Show when="signed-in">
        <LogoutButton />
      </Show>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck size={14} className="text-primary" /> Your pet and care
        details stay private to your account.
      </div>
      {pets.isError ? (
        <p className="mt-3 text-xs text-destructive">
          Pet profiles could not be refreshed right now.
        </p>
      ) : null}
    </div>
  );
}

function Show({
  children,
  when,
}: {
  children: ReactNode;
  when: "signed-in" | "signed-out";
}) {
  const { isSignedIn } = useAuth();
  return (when === "signed-in") === isSignedIn ? children : null;
}

function LogoutButton() {
  const { setUser } = useAuth();
  const [, setLocation] = useLocation();
  const logout = async () => {
    await fetch(`${basePath}/api/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
    queryClient.clear();
    setUser(null);
    setLocation("/sign-in");
  };
  return (
    <button
      className="btn btn-ghost"
      onClick={logout}
      data-testid="button-sign-out"
    >
      Sign out
    </button>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/" component={LandingPage} />
      <Route component={AuthenticatedRouter} />
    </Switch>
  );
}

function LandingPage() {
  const { isSignedIn, user } = useAuth();
  if (user?.role === "admin") return <Redirect to="/admin/providers" />;
  if (user?.role === "provider") return <Redirect to="/provider" />;
  return (
    <AppShell>
      <Home authenticated={Boolean(isSignedIn)} />
    </AppShell>
  );
}

function AuthenticatedRouter() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingState label="Checking your PetNest account" />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <MainRouter />;
}

function SignInPage() {
  const { isLoaded, setUser } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isLoaded) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${basePath}/api/auth/login`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as {
        user?: AuthUser;
        error?: string;
      };
      if (!response.ok || !result.user)
        throw new Error(result.error ?? "Email or password is incorrect.");
      setUser(result.user);
      setLocation("/");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Email or password is incorrect.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card surface-card" onSubmit={submit}>
        <div className="auth-brand text-center">
          <BrandLockup size={48} />
          <h1 className="auth-title mt-1">Welcome back</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Sign in to look after your nest.
          </p>
        </div>
        <div className="mt-7 space-y-4">
          <div className="form-field">
            <label className="form-label" htmlFor="signin-email">
              Email
            </label>
            <input
              className="input"
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="signin-password">
              Password
            </label>
            <input
              className="input"
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </div>
        </div>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="btn btn-primary mt-6 w-full"
          type="submit"
          disabled={!isLoaded || submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <Link href="/sign-up" className="btn btn-ghost mt-3 w-full">
          Create account
        </Link>
        <p className="auth-divider">Or sign in with</p>
        <SocialRow />
      </form>
    </div>
  );
}

function SignUpPage() {
  const { setUser } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${basePath}/api/auth/register`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        user?: AuthUser;
      };
      if (!response.ok || !body.user)
        throw new Error(body.error ?? "Account creation failed.");
      setUser(body.user);
      setLocation("/");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Account creation failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card surface-card" onSubmit={submit}>
        <div className="auth-brand text-center">
          <BrandLockup size={48} />
          <h1 className="auth-title mt-1">Create account</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Start as a pet parent. No verification required.
          </p>
        </div>
        <div className="mt-7 space-y-4">
          <div className="form-field">
            <label className="form-label" htmlFor="signup-name">
              Name
            </label>
            <input
              className="input"
              id="signup-name"
              autoComplete="name"
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="signup-email">
              Email
            </label>
            <input
              className="input"
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="signup-password">
              Password
            </label>
            <input
              className="input"
              id="signup-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters.
            </p>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="signup-confirm-password">
              Confirm password
            </label>
            <input
              className="input"
              id="signup-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.confirmPassword}
              onChange={(event) =>
                setForm({ ...form, confirmPassword: event.target.value })
              }
            />
          </div>
        </div>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="btn btn-primary mt-6 w-full"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
        <p className="auth-divider">Or sign up with</p>
        <SocialRow />
        <p className="mt-6 text-center text-sm font-semibold text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-bold text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

function MainRouter() {
  const { user } = useAuth();
  const role = user?.role;
  if (role === "admin") {
    return (
      <AppShell>
        <Switch>
          <Route path="/admin/providers" component={AdminProvidersPage} />
          <Route path="/admin/bookings" component={AdminBookingsPage} />
          <Route>
            <Redirect to="/admin/providers" />
          </Route>
        </Switch>
      </AppShell>
    );
  }
  if (role === "provider") {
    return (
      <AppShell>
        <Switch>
          <Route path="/provider" component={ProviderManagementPage} />
          <Route>
            <Redirect to="/provider" />
          </Route>
        </Switch>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/">
            <Home />
          </Route>
          <Route path="/providers" component={ProvidersPage} />
          <Route path="/providers/:providerId" component={ProviderDetailPage} />
          <Route path="/bookings" component={BookingsPage} />
          <Route path="/pets" component={PetsPage} />
          <Route path="/profile" component={CustomerProfilePage} />
          {!presentationMode ? (
            <Route path="/orders" component={OrdersPage} />
          ) : null}
          {!presentationMode ? (
            <Route path="/account" component={AccountPage} />
          ) : null}
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppShell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  const content = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );

  return (
    <WouterRouter base={basePath}>
      <AuthProvider>{content}</AuthProvider>
    </WouterRouter>
  );
}

export default App;
