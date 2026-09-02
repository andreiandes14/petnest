import { useMemo, useState, type ReactNode } from 'react';
import { ClerkProvider, Show as ClerkShow, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
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
} from '@workspace/api-client-react';
import type {
  CareRecord,
  Pet,
  Provider,
  ProviderDetail,
  ProviderProduct,
  ProviderService,
} from '@workspace/api-client-react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
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
  UserRound,
  X,
} from 'lucide-react';
import {
  Link,
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const configuredClerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkPubKey = configuredClerkPubKey
  ? publishableKeyFromHost(window.location.hostname, configuredClerkPubKey)
  : null;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c95a39',
    colorForeground: '#183944',
    colorMutedForeground: '#6d7d7e',
    colorDanger: '#b64141',
    colorBackground: '#fffaf3',
    colorInput: '#fffdf9',
    colorInputForeground: '#183944',
    colorNeutral: '#d8ded9',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '1rem',
  },
};

const categoryMeta = {
  grooming: { label: 'Grooming', icon: Sparkles, copy: 'Fresh cuts, calm baths, happy tails.' },
  vaccination: { label: 'Vaccination', icon: Syringe, copy: 'Keep their care plan on track.' },
  supplies: { label: 'Pet supplies', icon: ShoppingBag, copy: 'Good essentials from people who know pets.' },
} as const;

function formatDate(value?: string | null) {
  if (!value) return 'Not scheduled';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function money(value?: number) {
  return typeof value === 'number' ? `₱${value.toFixed(2)}` : '—';
}

function initials(value: string) {
  return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function LoadingState({ label = 'Gathering your pet-care options' }: { label?: string }) {
  return (
    <div className="surface-card p-6" data-testid="state-loading">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton mt-4 h-4 w-72 max-w-full" />
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((item) => <div className="skeleton h-28" key={item} />)}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ErrorState({ onRetry, message = 'We could not load this just now.' }: { onRetry: () => void; message?: string }) {
  return (
    <div className="error-state" data-testid="state-error">
      <div className="flex items-start gap-3">
        <CircleHelp size={19} className="mt-0.5 text-destructive" />
        <div>
          <p className="font-semibold">{message}</p>
          <p className="mt-1 text-sm text-muted-foreground">A quick retry usually gets things moving again.</p>
          <button className="btn btn-ghost mt-4" onClick={onRetry} data-testid="button-retry">Try again</button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = PawPrint, title, copy, action }: { icon?: typeof PawPrint; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="empty-state" data-testid="state-empty">
      <div className="empty-icon"><Icon size={23} /></div>
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{copy}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const navItems = [
  { href: '/', label: 'Discover', icon: House },
  { href: '/providers', label: 'Providers', icon: MapPin },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/pets', label: 'My pets', icon: PawPrint },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/account', label: 'Account', icon: UserRound },
];

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const pathname = location.split('?')[0];
  const activePath = pathname === '/' ? '/' : `/${pathname.split('/')[1]}`;
  return (
    <div className="petnest-app">
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/" className="brand-mark" data-testid="link-brand">
            <span className="brand-mark-badge"><PawPrint size={20} /></span>
            <span className="font-display text-2xl tracking-tight">PetNest</span>
          </Link>
          <p className="mt-3 px-1 text-xs leading-5 text-sidebar-foreground/50">The softer place to care for them.</p>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`sidebar-link ${activePath === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-footer">
            <Show when="signed-in">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-primary font-mono text-xs font-bold text-sidebar-primary-foreground">AR</div>
                <div><p className="text-sm font-semibold">Alex Rivera</p><p className="text-xs text-sidebar-foreground/50">Pet parent</p></div>
              </div>
              <Link href="/account" className="text-xs font-semibold text-sidebar-primary hover:underline" data-testid="link-sidebar-account">Manage account <ArrowRight size={12} className="ml-1 inline" /></Link>
            </Show>
            <Show when="signed-out">
              <div className="rounded-2xl border border-sidebar-foreground/10 p-4">
                <p className="text-sm font-semibold">Keep your care history close.</p>
                <p className="mt-1 text-xs leading-5 text-sidebar-foreground/60">Sign in to save pets, visits, and orders.</p>
                <Link href="/sign-in" className="mt-3 inline-flex text-xs font-bold text-sidebar-primary hover:underline" data-testid="link-sidebar-sign-in">Sign in <ArrowRight size={12} className="ml-1" /></Link>
              </div>
            </Show>
          </div>
        </aside>
        <main className="main-shell">
          <header className="topbar">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><MapPin size={14} className="text-primary" /> Portland, Oregon</div>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/pets" className="btn btn-ghost hidden sm:inline-flex" data-testid="link-top-pets"><PawPrint size={15} /> My pets</Link>
              <Link href="/account" className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-secondary-foreground" data-testid="link-top-account">AR</Link>
            </div>
          </header>
          <div className="main-content">{children}</div>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={activePath === href ? 'active' : ''} data-testid={`link-mobile-${label.toLowerCase().replace(' ', '-')}`}>
            <Icon /><span>{label === 'Discover' ? 'Home' : label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function HeroSearch() {
  const [, setLocation] = useLocation();
  const [value, setValue] = useState('');
  return (
    <form className="search-pill mt-8 max-w-xl" onSubmit={(event) => { event.preventDefault(); setLocation(`/providers${value ? `?search=${encodeURIComponent(value)}` : ''}`); }}>
      <Search size={18} className="ml-3 shrink-0 text-muted-foreground" />
      <input className="input" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search care, supplies, or a provider" aria-label="Search providers" data-testid="input-home-search" />
      <button className="btn btn-primary" type="submit" data-testid="button-home-search">Find care <ArrowRight size={15} /></button>
    </form>
  );
}

function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <Link href={`/providers/${provider.id}`} className="provider-card surface-card block" data-testid={`card-provider-${provider.id}`}>
      <img className="provider-image" src={provider.imageUrl} alt={`${provider.name} storefront`} />
      <div className="provider-card-body">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display text-2xl leading-none">{provider.name}</h3><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {provider.location}</p></div>
          {provider.verified ? <span className="tag tag-accent shrink-0"><ShieldCheck size={12} className="mr-1" /> Verified</span> : null}
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{provider.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="rating"><Star size={12} fill="currentColor" /> {provider.rating.toFixed(1)} <span className="font-sans font-normal text-muted-foreground">({provider.reviewCount})</span></span>
          <span className="font-mono text-xs text-muted-foreground">from {money(provider.startingPrice)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">{provider.categories.map((category) => <span className="tag" key={category}>{category}</span>)}</div>
      </div>
    </Link>
  );
}

function Home() {
  const providersQuery = useListProviders(undefined, { query: { queryKey: getListProvidersQueryKey() } });
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const providers = providersQuery.data ?? [];
  const nextBooking = summaryQuery.data?.nextBooking;
  return (
    <div className="animate-in">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow text-secondary">Care, from people who get it</p>
          <h1 className="hero-title mt-4">Good care starts<br />with a <em>soft place.</em></h1>
          <p className="hero-blurb">Find thoughtful groomers, trusted vaccination providers, and pet essentials — all in one nest, ready when you are.</p>
          <HeroSearch />
        </div>
        <div className="absolute bottom-7 right-8 hidden max-w-[210px] text-right text-xs leading-5 text-sidebar-foreground/50 md:block">A calmer way to do the practical stuff. Because they deserve the good stuff, too.</div>
      </section>

      <div className="stat-grid">
        <div className="stat-card surface-card"><p className="stat-value">{summaryQuery.data?.petCount ?? '—'}</p><p className="stat-label">pets in your nest</p></div>
        <div className="stat-card surface-card"><p className="stat-value">{summaryQuery.data?.upcomingBookingCount ?? '—'}</p><p className="stat-label">upcoming visits</p></div>
        <div className="stat-card surface-card"><p className="stat-value">{summaryQuery.data?.recordCount ?? '—'}</p><p className="stat-label">care records kept</p></div>
      </div>

      <section>
        <div className="section-head"><div><p className="eyebrow">Start here</p><h2 className="section-title mt-2">What does your pet need?</h2></div><Link href="/providers" className="btn btn-ghost" data-testid="link-all-providers">Browse all providers <ArrowRight size={14} /></Link></div>
        <div className="category-grid">
          {Object.entries(categoryMeta).map(([key, meta]) => { const Icon = meta.icon; return <Link href={`/providers?category=${key}`} className="category-card" key={key} data-testid={`link-category-${key}`}><span className="category-icon"><Icon size={20} /></span><div><h3 className="category-name">{meta.label}</h3><p className="mt-1 max-w-[190px] text-xs leading-5 text-foreground/65">{meta.copy}</p></div><ChevronRight className="absolute bottom-5 right-5" size={18} /></Link>; })}
        </div>
      </section>

      <section>
        <div className="section-head"><div><p className="eyebrow">Around Portland</p><h2 className="section-title mt-2">A few good places</h2></div></div>
        {providersQuery.isLoading ? <LoadingState label="Finding kind people for your pets" /> : providersQuery.isError ? <ErrorState onRetry={() => providersQuery.refetch()} /> : providers.length === 0 ? <EmptyState icon={MapPin} title="Your neighborhood is quiet" copy="We are adding more local pet-care people every week. Try another search or check back soon." /> : <div className="provider-grid">{providers.slice(0, 3).map((provider) => <ProviderCard provider={provider} key={provider.id} />)}</div>}
      </section>

      {nextBooking ? <section className="surface-card mt-8 flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><CalendarDays size={20} /></div><div><p className="eyebrow">Next up</p><h3 className="mt-1 font-display text-2xl">{nextBooking.serviceName} with {nextBooking.providerName}</h3><p className="mt-1 text-sm text-muted-foreground">{formatDate(nextBooking.date)} at {nextBooking.time} · {nextBooking.petName}</p></div></div><Link href="/bookings" className="btn btn-secondary shrink-0" data-testid="link-next-booking">View booking <ArrowRight size={14} /></Link></section> : null}
    </div>
  );
}

function ProvidersPage() {
  const params = new URLSearchParams(window.location.search);
  const initialCategory = params.get('category') ?? '';
  const initialSearch = params.get('search') ?? '';
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch);
  const queryParams = useMemo(() => ({ ...(category ? { category: category as 'grooming' | 'vaccination' | 'supplies' } : {}), ...(submittedSearch ? { search: submittedSearch } : {}) }), [category, submittedSearch]);
  const query = useListProviders(queryParams, { query: { queryKey: getListProvidersQueryKey(queryParams) } });
  return (
    <div className="animate-in">
      <p className="eyebrow">The PetNest directory</p>
      <h1 className="page-title">Find your kind<br className="sm:hidden" /> of people.</h1>
      <p className="page-subtitle">Browse providers who make the practical parts of pet care feel a little more personal.</p>
      <div className="surface-card filter-bar">
        <form className="flex min-w-[230px] flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); setSubmittedSearch(search); }}>
          <Search size={16} className="ml-1 text-muted-foreground" /><input className="input h-10 border-0 bg-transparent p-0 shadow-none focus:shadow-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search providers or neighborhoods" aria-label="Search providers" data-testid="input-provider-search" /><button className="btn btn-primary h-10" type="submit" data-testid="button-provider-search">Search</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button className={`filter-chip ${!category ? 'active' : ''}`} onClick={() => setCategory('')} data-testid="button-filter-all">All providers</button>
          {Object.entries(categoryMeta).map(([key, meta]) => <button className={`filter-chip ${category === key ? 'active' : ''}`} key={key} onClick={() => setCategory(key)} data-testid={`button-filter-${key}`}>{meta.label}</button>)}
        </div>
      </div>
      <div className="mb-5 flex items-center justify-between"><p className="text-sm text-muted-foreground">{query.isLoading ? 'Looking around…' : `${query.data?.length ?? 0} providers near you`}</p>{category ? <button className="text-xs font-bold text-primary hover:underline" onClick={() => setCategory('')} data-testid="button-clear-filter">Clear filter</button> : null}</div>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : query.data?.length ? <div className="provider-grid">{query.data.map((provider) => <ProviderCard provider={provider} key={provider.id} />)}</div> : <EmptyState icon={MapPin} title="No perfect match yet" copy="Try a broader search or another care category. Your pet's next favorite place may be a click away." action={<Link href="/" className="btn btn-primary" data-testid="link-empty-home">Back to discovery <ArrowRight size={14} /></Link>} />}
    </div>
  );
}

function BookingModal({ provider, service, onClose }: { provider: ProviderDetail; service: ProviderService; onClose: () => void }) {
  const petsQuery = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const createBooking = useCreateBooking();
  const [petId, setPetId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [complete, setComplete] = useState(false);
  const submit = () => {
    if (!petId || !date) return;
    createBooking.mutate({ data: { providerId: provider.id, serviceId: service.id, petId: Number(petId), date, time, notes } }, { onSuccess: () => setComplete(true) });
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal animate-in" role="dialog" aria-modal="true" aria-labelledby="booking-title">
    <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Make it official</p><h2 id="booking-title" className="mt-2 font-display text-3xl">Book {service.name}</h2><p className="mt-1 text-sm text-muted-foreground">{provider.name} · {money(service.price)} · {service.durationMinutes} minutes</p></div><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close booking" data-testid="button-close-booking"><X size={17} /></button></div>
    {complete ? <div className="py-10 text-center"><div className="empty-icon"><Check size={24} /></div><h3 className="font-display text-3xl">You are all set.</h3><p className="mt-2 text-sm text-muted-foreground">Your request is on its way to {provider.name}. We will keep it in your bookings.</p><button className="btn btn-primary mt-6" onClick={onClose} data-testid="button-done-booking">Done</button></div> : petsQuery.isLoading ? <LoadingState label="Loading your pet profiles" /> : petsQuery.isError ? <ErrorState onRetry={() => petsQuery.refetch()} /> : petsQuery.data?.length ? <div className="mt-7 space-y-4"><div className="form-field"><label className="form-label" htmlFor="booking-pet">Who is coming?</label><select className="input select" id="booking-pet" value={petId} onChange={(event) => setPetId(event.target.value)} data-testid="select-booking-pet"><option value="">Choose a pet</option>{petsQuery.data.map((pet) => <option value={pet.id} key={pet.id}>{pet.name} · {pet.breed}</option>)}</select></div><div className="form-grid"><div className="form-field"><label className="form-label" htmlFor="booking-date">Preferred date</label><input className="input" id="booking-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} data-testid="input-booking-date" /></div><div className="form-field"><label className="form-label" htmlFor="booking-time">Preferred time</label><select className="input select" id="booking-time" value={time} onChange={(event) => setTime(event.target.value)} data-testid="select-booking-time"><option>09:00</option><option>10:00</option><option>11:30</option><option>13:00</option><option>15:30</option></select></div></div><div className="form-field"><label className="form-label" htmlFor="booking-notes">Anything they should know? <span className="font-normal">(optional)</span></label><textarea className="input h-24 resize-none py-3" id="booking-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Temperament, sensitivities, or a little context" data-testid="textarea-booking-notes" /></div>{createBooking.isError ? <p className="text-sm text-destructive" data-testid="text-booking-error">We could not send that booking. Please try again.</p> : null}<button className="btn btn-primary w-full" onClick={submit} disabled={createBooking.isPending || !petId || !date} data-testid="button-submit-booking">{createBooking.isPending ? 'Sending request…' : 'Request this time'}</button></div> : <EmptyState icon={PawPrint} title="Add a pet first" copy="A pet profile helps providers prepare for a visit." action={<Link href="/pets" className="btn btn-primary" onClick={onClose} data-testid="link-booking-add-pet">Add pet profile <ArrowRight size={14} /></Link>} />}
  </div></div>;
}

function ProviderDetailPage() {
  const params = useParams<{ providerId?: string }>();
  const providerId = Number(params.providerId);
  const query = useGetProvider(providerId, { query: { enabled: !!providerId, queryKey: getGetProviderQueryKey(providerId) } });
  const [bookingService, setBookingService] = useState<ProviderService | null>(null);
  const [cart, setCart] = useState<{ product: ProviderProduct; quantity: number }[]>([]);
  const createOrder = useCreateOrder();
  const [notice, setNotice] = useState('');
  if (query.isLoading) return <LoadingState label="Opening this provider's nest" />;
  if (query.isError || !query.data) return <ErrorState onRetry={() => query.refetch()} message="This provider is taking a little longer to appear." />;
  const provider = query.data;
  const addProduct = (product: ProviderProduct) => {
    setCart((current) => { const existing = current.find((item) => item.product.id === product.id); return existing ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { product, quantity: 1 }]; });
    setNotice(`${product.name} added to your basket`);
    window.setTimeout(() => setNotice(''), 2500);
  };
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const placeOrder = () => {
    if (!cart.length) return;
    createOrder.mutate({ data: { providerId: provider.id, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) } }, { onSuccess: () => { setCart([]); setNotice('Order placed — we will keep an eye on it.'); window.setTimeout(() => setNotice(''), 3500); } });
  };
  return <div className="animate-in">
    <Link href="/providers" className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary" data-testid="link-back-providers">← All providers</Link>
    <div className="detail-hero"><img className="detail-image" src={provider.imageUrl} alt={`${provider.name} care space`} /><div className="detail-info"><div className="flex items-center gap-2">{provider.verified ? <span className="tag tag-accent"><ShieldCheck size={12} className="mr-1" /> Verified provider</span> : null}<span className="rating"><Star size={12} fill="currentColor" /> {provider.rating.toFixed(1)}</span></div><h1 className="mt-4">{provider.name}</h1><div className="detail-meta"><span><MapPin size={14} className="mr-1 inline text-primary" />{provider.location}</span><span><Clock3 size={14} className="mr-1 inline text-primary" />{provider.hours}</span><span>{provider.contact}</span></div><p className="mt-6 max-w-xl text-[15px] leading-7 text-muted-foreground">{provider.description}</p><div className="mt-7 flex flex-wrap gap-2">{provider.categories.map((category) => <span className="tag" key={category}>{category}</span>)}</div></div></div>
    {notice ? <div className="surface-card mt-5 flex items-center gap-2 border-primary/30 bg-accent p-4 text-sm font-semibold text-accent-foreground" role="status" data-testid="status-provider-notice"><Check size={16} /> {notice}</div> : null}
    <div className="detail-panels"><section className="surface-card p-5"><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Care menu</p><h2 className="section-title mt-1">Services</h2></div><span className="tag">{provider.services.length} options</span></div><div className="list-stack">{provider.services.map((service) => <div className="service-row" key={service.id} data-testid={`row-service-${service.id}`}><div className="min-w-0"><h3 className="font-semibold">{service.name}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{service.description}</p><p className="mt-2 font-mono text-xs text-muted-foreground">{service.durationMinutes} min · {money(service.price)}</p></div><button className="btn btn-primary shrink-0" onClick={() => setBookingService(service)} disabled={service.available === false} data-testid={`button-book-service-${service.id}`}>{service.available === false ? 'Unavailable' : 'Book'}</button></div>)}</div></section>
      <section className="surface-card p-5"><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">From their shelves</p><h2 className="section-title mt-1">Pet supplies</h2></div>{cart.length ? <span className="tag tag-accent">{cart.reduce((sum, item) => sum + item.quantity, 0)} in basket</span> : null}</div><div className="list-stack">{provider.products.map((product) => <div className="product-row" key={product.id} data-testid={`row-product-${product.id}`}><img className="product-thumb" src={product.imageUrl} alt="" /><div className="min-w-0 flex-1"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.description}</p><p className="mt-2 font-mono text-xs">{money(product.price)}</p></div><button className="btn btn-ghost shrink-0" onClick={() => addProduct(product)} disabled={!product.inStock} data-testid={`button-add-product-${product.id}`}>{product.inStock ? <><Plus size={14} /> Add</> : 'Out'}</button></div>)}</div>{cart.length ? <div className="mt-5 rounded-2xl bg-muted p-4"><div className="flex items-center justify-between text-sm font-semibold"><span>Basket total</span><span className="font-mono">{money(total)}</span></div><button className="btn btn-secondary mt-3 w-full" onClick={placeOrder} disabled={createOrder.isPending} data-testid="button-place-order">{createOrder.isPending ? 'Placing order…' : 'Place supply order'} <ArrowRight size={14} /></button>{createOrder.isError ? <p className="mt-2 text-xs text-destructive">We could not place that order. Please try again.</p> : null}</div> : null}</section></div>
    {bookingService ? <BookingModal provider={provider} service={bookingService} onClose={() => setBookingService(null)} /> : null}
  </div>;
}

function BookingsPage() {
  const query = useListBookings({ query: { queryKey: getListBookingsQueryKey() } });
  const bookings = query.data ?? [];
  return <div className="animate-in"><p className="eyebrow">Your plans</p><h1 className="page-title">Bookings,<br />kept simple.</h1><p className="page-subtitle">Everything you have coming up, plus a clear little trail of where you have been.</p><div className="mt-8">{query.isLoading ? <LoadingState label="Finding your upcoming care" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : !bookings.length ? <EmptyState icon={CalendarDays} title="Nothing on the calendar" copy="When your pet is ready for a little care, it will show up here." action={<Link href="/providers" className="btn btn-primary" data-testid="link-bookings-discover">Find a provider <ArrowRight size={14} /></Link>} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Visit</th><th>Pet</th><th>When</th><th>Status</th><th className="text-right">Price</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id} data-testid={`row-booking-${booking.id}`}><td><p className="font-semibold">{booking.serviceName}</p><Link href={`/providers/${booking.providerId}`} className="mt-1 inline-block text-xs text-muted-foreground hover:text-primary" data-testid={`link-booking-provider-${booking.id}`}>{booking.providerName}</Link></td><td>{booking.petName}</td><td><p>{formatDate(booking.date)}</p><p className="mt-1 text-xs text-muted-foreground">{booking.time}</p></td><td><span className={`status status-${booking.status.toLowerCase()}`}>{booking.status}</span></td><td className="text-right font-mono">{money(booking.price)}</td></tr>)}</tbody></table></div>}</div></div>;
}

function PetForm({ pet, onClose, onSaved }: { pet?: Pet; onClose: () => void; onSaved: () => void }) {
  const createPet = useCreatePet();
  const updatePet = useUpdatePet();
  const [form, setForm] = useState({ name: pet?.name ?? '', species: pet?.species ?? 'Dog', breed: pet?.breed ?? '', age: pet?.age ?? '', gender: pet?.gender ?? '', weight: pet?.weight ?? '', notes: pet?.notes ?? '' });
  const change = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.name || !form.breed || !form.age) return;
    if (pet) updatePet.mutate({ petId: pet.id, data: form }, { onSuccess: onSaved });
    else createPet.mutate({ data: form }, { onSuccess: onSaved });
  };
  const pending = createPet.isPending || updatePet.isPending;
  return <div className="modal-backdrop"><div className="modal animate-in" role="dialog" aria-modal="true"><div className="flex items-start justify-between"><div><p className="eyebrow">{pet ? 'Update their profile' : 'Welcome to the nest'}</p><h2 className="mt-2 font-display text-3xl">{pet ? `Edit ${pet.name}` : 'Add a pet'}</h2></div><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close pet form" data-testid="button-close-pet-form"><X size={17} /></button></div><div className="form-grid mt-7"><div className="form-field"><label className="form-label" htmlFor="pet-name">Name</label><input className="input" id="pet-name" value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="Their everyday name" data-testid="input-pet-name" /></div><div className="form-field"><label className="form-label" htmlFor="pet-species">Species</label><select className="input select" id="pet-species" value={form.species} onChange={(event) => change('species', event.target.value)} data-testid="select-pet-species"><option>Dog</option><option>Cat</option><option>Rabbit</option><option>Other</option></select></div><div className="form-field"><label className="form-label" htmlFor="pet-breed">Breed</label><input className="input" id="pet-breed" value={form.breed} onChange={(event) => change('breed', event.target.value)} placeholder="e.g. Corgi mix" data-testid="input-pet-breed" /></div><div className="form-field"><label className="form-label" htmlFor="pet-age">Age</label><input className="input" id="pet-age" value={form.age} onChange={(event) => change('age', event.target.value)} placeholder="e.g. 3 years" data-testid="input-pet-age" /></div><div className="form-field"><label className="form-label" htmlFor="pet-gender">Gender</label><select className="input select" id="pet-gender" value={form.gender} onChange={(event) => change('gender', event.target.value)} data-testid="select-pet-gender"><option value="">Select</option><option>Female</option><option>Male</option><option>Unknown</option></select></div><div className="form-field"><label className="form-label" htmlFor="pet-weight">Weight</label><input className="input" id="pet-weight" value={form.weight} onChange={(event) => change('weight', event.target.value)} placeholder="e.g. 28 lb" data-testid="input-pet-weight" /></div><div className="form-field full"><label className="form-label" htmlFor="pet-notes">Notes for providers</label><textarea className="input h-24 resize-none py-3" id="pet-notes" value={form.notes} onChange={(event) => change('notes', event.target.value)} placeholder="Sensitivities, favorite treats, things worth knowing" data-testid="textarea-pet-notes" /></div></div>{(createPet.isError || updatePet.isError) ? <p className="mt-4 text-sm text-destructive" data-testid="text-pet-form-error">We could not save this profile. Please try again.</p> : null}<button className="btn btn-primary mt-6 w-full" onClick={submit} disabled={pending || !form.name || !form.breed || !form.age} data-testid="button-save-pet">{pending ? 'Saving profile…' : pet ? 'Save changes' : 'Add to my nest'}</button></div></div>;
}

function PetCard({ pet, onEdit, onSelect, selected }: { pet: Pet; onEdit: () => void; onSelect: () => void; selected: boolean }) {
  return <button className={`pet-card surface-card block w-full text-left ${selected ? 'border-primary ring-2 ring-primary/15' : ''}`} onClick={onSelect} data-testid={`card-pet-${pet.id}`}><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="pet-avatar">{pet.avatarUrl ? <img className="h-full w-full rounded-[inherit] object-cover" src={pet.avatarUrl} alt="" /> : initials(pet.name)}</div><div><h3 className="font-display text-2xl">{pet.name}</h3><p className="mt-1 text-xs text-muted-foreground">{pet.breed} · {pet.age}</p></div></div><span className="tag">{pet.species}</span></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs"><div><p className="text-muted-foreground">Weight</p><p className="mt-1 font-semibold">{pet.weight || 'Not added'}</p></div><div><p className="text-muted-foreground">Next vaccine</p><p className="mt-1 font-semibold">{formatDate(pet.nextVaccine)}</p></div></div><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary" onClick={(event) => { event.stopPropagation(); onEdit(); }} data-testid={`button-edit-pet-${pet.id}`}><Pencil size={13} /> Edit profile</span></button>;
}

function RecordsPanel({ pet }: { pet: Pet }) {
  const [tab, setTab] = useState<'grooming' | 'vaccinations'>('grooming');
  const query = useGetPetRecords(pet.id, { query: { enabled: !!pet.id, queryKey: getGetPetRecordsQueryKey(pet.id) } });
  const records = query.data?.[tab] ?? [];
  return <div className="record-layout"><div className="record-tabs surface-card"><p className="eyebrow px-3 pb-2">Care record</p><button className={`record-tab ${tab === 'grooming' ? 'active' : ''}`} onClick={() => setTab('grooming')} data-testid="button-records-grooming"><span className="flex items-center gap-2"><Sparkles size={15} /> Grooming</span><span>{query.data?.grooming.length ?? 0}</span></button><button className={`record-tab ${tab === 'vaccinations' ? 'active' : ''}`} onClick={() => setTab('vaccinations')} data-testid="button-records-vaccinations"><span className="flex items-center gap-2"><Syringe size={15} /> Vaccinations</span><span>{query.data?.vaccinations.length ?? 0}</span></button></div><div>{query.isLoading ? <LoadingState label="Opening their care records" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : records.length ? <div className="list-stack">{records.map((record) => <div className="record-item" key={record.id} data-testid={`record-care-${record.id}`}><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{record.type}</p><h3 className="mt-1 font-display text-2xl">{record.title}</h3><p className="mt-1 text-xs text-muted-foreground">{record.providerName} · {formatDate(record.date)}</p></div><span className={`status status-${record.status.toLowerCase()}`}>{record.status}</span></div>{record.notes ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{record.notes}</p> : null}</div>)}</div> : <EmptyState icon={FileText} title="A clean slate" copy={`No ${tab === 'grooming' ? 'grooming' : 'vaccination'} records yet. They will appear after a provider visit.`} />}</div></div>;
}

function PetsPage() {
  const query = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const [modal, setModal] = useState<'create' | Pet | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const pets = query.data ?? [];
  const selectedPet = pets.find((pet) => pet.id === selected) ?? pets[0];
  const saveComplete = () => { setModal(null); queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() }); };
  return <div className="animate-in"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">The nest</p><h1 className="page-title">Your pets,<br />properly known.</h1><p className="page-subtitle">Keep the small details in one place so every provider can care for them like you do.</p></div><button className="btn btn-primary" onClick={() => setModal('create')} data-testid="button-add-pet"><Plus size={16} /> Add a pet</button></div><div className="mt-8">{query.isLoading ? <LoadingState label="Loading your pet profiles" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : pets.length ? <><div className="pet-grid">{pets.map((pet) => <PetCard key={pet.id} pet={pet} selected={selectedPet?.id === pet.id} onSelect={() => setSelected(pet.id)} onEdit={() => setModal(pet)} />)}</div>{selectedPet ? <RecordsPanel pet={selectedPet} /> : null}</> : <EmptyState icon={PawPrint} title="A nest starts with a name" copy="Add your first pet profile so bookings, providers, and care records all know who they are looking after." action={<button className="btn btn-primary" onClick={() => setModal('create')} data-testid="button-empty-add-pet"><Plus size={15} /> Add first pet</button>} />}</div>{modal ? <PetForm pet={modal === 'create' ? undefined : modal} onClose={() => setModal(null)} onSaved={saveComplete} /> : null}</div>;
}

function OrdersPage() {
  const query = useListOrders({ query: { queryKey: getListOrdersQueryKey() } });
  const orders = query.data ?? [];
  return <div className="animate-in"><p className="eyebrow">Good things, on the way</p><h1 className="page-title">Supply orders.</h1><p className="page-subtitle">Track the useful little things that keep your pet comfortable, fed, and entertained.</p><div className="mt-8">{query.isLoading ? <LoadingState label="Checking on your deliveries" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : orders.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Provider</th><th>Placed</th><th>Items</th><th>Status</th><th className="text-right">Total</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} data-testid={`row-order-${order.id}`}><td className="font-mono text-xs">#{String(order.id).padStart(5, '0')}</td><td><Link href={`/providers/${order.providerId}`} className="font-semibold hover:text-primary" data-testid={`link-order-provider-${order.id}`}>{order.providerName}</Link></td><td>{formatDate(order.createdAt)}</td><td>{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</td><td><span className={`status status-${order.status.toLowerCase()}`}>{order.status}</span></td><td className="text-right font-mono">{money(order.total)}</td></tr>)}</tbody></table></div> : <EmptyState icon={ShoppingBag} title="Your basket is waiting" copy="When you find something useful from a local provider, your supply orders will live here." action={<Link href="/providers?category=supplies" className="btn btn-primary" data-testid="link-orders-shop">Shop pet supplies <ArrowRight size={14} /></Link>} />}</div></div>;
}

function AccountPage() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const pets = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const recent = summary.data?.recentActivity ?? [];
  return <div className="animate-in"><p className="eyebrow">A quick look around</p><h1 className="page-title">Hi, Alex.</h1><p className="page-subtitle">Your pet-care life, in one calm corner.</p>{summary.isLoading ? <div className="mt-8"><LoadingState label="Preparing your account snapshot" /></div> : summary.isError ? <div className="mt-8"><ErrorState onRetry={() => summary.refetch()} /></div> : <><div className="stat-grid mt-8"><div className="stat-card surface-card"><p className="stat-value">{summary.data?.petCount ?? 0}</p><p className="stat-label">pet profiles</p></div><div className="stat-card surface-card"><p className="stat-value">{summary.data?.upcomingBookingCount ?? 0}</p><p className="stat-label">upcoming bookings</p></div><div className="stat-card surface-card"><p className="stat-value">{summary.data?.recordCount ?? 0}</p><p className="stat-label">care records</p></div></div><div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="surface-card p-5"><div className="flex items-end justify-between"><div><p className="eyebrow">Next on the calendar</p><h2 className="section-title mt-1">Your next visit</h2></div><Link href="/bookings" className="text-xs font-bold text-primary hover:underline" data-testid="link-account-bookings">All bookings</Link></div>{summary.data?.nextBooking ? <div className="mt-5 rounded-2xl bg-accent p-5 text-accent-foreground"><div className="flex items-start justify-between gap-3"><div><p className="font-display text-3xl">{summary.data.nextBooking.serviceName}</p><p className="mt-1 text-sm">{summary.data.nextBooking.providerName} · {summary.data.nextBooking.petName}</p></div><CalendarDays size={20} /></div><div className="mt-6 flex items-center justify-between border-t border-accent-foreground/15 pt-4 text-xs font-semibold"><span>{formatDate(summary.data.nextBooking.date)}</span><span>{summary.data.nextBooking.time}</span></div></div> : <EmptyState icon={CalendarDays} title="Nothing booked yet" copy="Find a provider when your pet is ready for their next bit of care." action={<Link href="/providers" className="btn btn-primary" data-testid="link-account-discover">Discover care</Link>} />}</section><section className="surface-card p-5"><div className="flex items-end justify-between"><div><p className="eyebrow">Latest notes</p><h2 className="section-title mt-1">Care trail</h2></div><Link href="/pets" className="text-xs font-bold text-primary hover:underline" data-testid="link-account-records">View records</Link></div>{recent.length ? <div className="mt-5 list-stack">{recent.slice(0, 3).map((record: CareRecord) => <div className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0" key={record.id} data-testid={`activity-record-${record.id}`}><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">{record.type === 'vaccination' ? <Syringe size={14} /> : <Sparkles size={14} />}</div><div><p className="text-sm font-semibold">{record.title}</p><p className="mt-1 text-xs text-muted-foreground">{record.providerName} · {formatDate(record.date)}</p></div></div>)}</div> : <p className="mt-5 text-sm text-muted-foreground">Your care notes will collect here after visits.</p>}</section></div></>}<div className="mt-8 surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Alex Rivera</p><p className="mt-1 text-sm text-muted-foreground">alex.rivera@example.com · Portland, Oregon</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="status-health"><span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-destructive' : 'bg-primary'}`} /> PetNest services {health.isError ? 'are reconnecting' : 'are healthy'}</div></div><Show when="signed-in"><LogoutButton /></Show><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} className="text-primary" /> Your pet and care details stay private to your account.</div>{pets.isError ? <p className="mt-3 text-xs text-destructive">Pet profiles could not be refreshed right now.</p> : null}</div>;
}

function Show({ children, when }: { children: ReactNode; when: 'signed-in' | 'signed-out' }) {
  return clerkPubKey ? <ClerkShow when={when}>{children}</ClerkShow> : null;
}

function LogoutButton() {
  const { signOut } = useClerk();
  return <button className="btn btn-ghost mt-4" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out">Sign out</button>;
}

function Router() {
  return <Switch>
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route component={MainRouter} />
  </Switch>;
}

function SignInPage() {
  return clerkPubKey
    ? <div className="auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>
    : <div className="auth-page"><p>Set VITE_CLERK_PUBLISHABLE_KEY to enable sign in locally.</p></div>;
}

function SignUpPage() {
  return clerkPubKey
    ? <div className="auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>
    : <div className="auth-page"><p>Set VITE_CLERK_PUBLISHABLE_KEY to enable account creation locally.</p></div>;
}

function MainRouter() {
  return <AppShell>
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/providers" component={ProvidersPage} />
        <Route path="/providers/:providerId" component={ProviderDetailPage} />
        <Route path="/bookings" component={BookingsPage} />
        <Route path="/pets" component={PetsPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/account" component={AccountPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  </AppShell>;
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
      {clerkPubKey ? <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        appearance={clerkAppearance}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        localization={{
          signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to keep their care close' } },
          signUp: { start: { title: 'Create your PetNest account', subtitle: 'A softer place to care for them' } },
        }}
      >{content}</ClerkProvider> : content}
    </WouterRouter>
  );
}

export default App;
