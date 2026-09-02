import { Router, type IRouter } from "express";
import {
  CreateBookingBody,
  CreateBookingResponse,
  CreateOrderBody,
  CreateOrderResponse,
  CreatePetBody,
  CreatePetResponse,
  GetDashboardSummaryResponse,
  GetPetRecordsResponse,
  GetProviderParams,
  GetProviderResponse,
  GetPetRecordsParams,
  ListBookingsResponse,
  ListOrdersResponse,
  ListPetsResponse,
  ListProvidersQueryParams,
  ListProvidersResponse,
  UpdatePetBody,
  UpdatePetParams,
  UpdatePetResponse,
} from "@workspace/api-zod";

type ProviderService = {
  id: number;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  category: string;
  available: boolean;
};

type ProviderProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  inStock: boolean;
};

type Provider = {
  id: number;
  name: string;
  location: string;
  description: string;
  categories: string[];
  rating: number;
  reviewCount: number;
  startingPrice: number;
  imageUrl: string;
  verified: boolean;
  contact: string;
  hours: string;
  services: ProviderService[];
  products: ProviderProduct[];
};

type Pet = {
  id: number;
  name: string;
  species: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  notes: string;
  avatarUrl: string;
  nextVaccine: string | null;
};

type CareRecord = {
  id: number;
  type: "grooming" | "vaccination";
  title: string;
  providerName: string;
  date: string;
  status: string;
  notes: string;
};

type Booking = {
  id: number;
  providerId: number;
  providerName: string;
  serviceName: string;
  petId: number;
  petName: string;
  date: string;
  time: string;
  status: string;
  price: number;
};

type Order = {
  id: number;
  providerId: number;
  providerName: string;
  total: number;
  status: string;
  itemCount: number;
  createdAt: string;
};

const providers: Provider[] = [
  {
    id: 1,
    name: "The Gentle Paws",
    location: "Makati, Metro Manila",
    description:
      "A calm, caring space for everyday grooming and preventative care, built around pets who need a little extra patience.",
    categories: ["grooming", "vaccination", "supplies"],
    rating: 4.9,
    reviewCount: 128,
    startingPrice: 650,
    imageUrl:
      "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80",
    verified: true,
    contact: "+63 917 555 0182",
    hours: "Mon–Sun · 9:00 AM–7:00 PM",
    services: [
      { id: 101, name: "Fresh & Fluffy", description: "Bath, blow dry, brush out, and finishing spritz.", price: 650, durationMinutes: 60, category: "grooming", available: true },
      { id: 102, name: "Full Groom", description: "The complete tidy-up with trim, nail care, and ear cleaning.", price: 950, durationMinutes: 90, category: "grooming", available: true },
      { id: 103, name: "Core Vaccination", description: "A gentle vaccination visit with a post-care check-in.", price: 850, durationMinutes: 30, category: "vaccination", available: true },
    ],
    products: [
      { id: 1001, name: "Salmon & Oat Bites", description: "Small-batch training treats for sensitive tummies.", price: 320, imageUrl: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80", category: "pet food", inStock: true },
      { id: 1002, name: "Everyday Paw Balm", description: "Soothing balm for city walks and dry paw pads.", price: 280, imageUrl: "https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?auto=format&fit=crop&w=600&q=80", category: "pet care", inStock: true },
    ],
  },
  {
    id: 2,
    name: "Bark & Bloom Clinic",
    location: "Quezon City",
    description:
      "Modern veterinary care with a soft touch, from puppy wellness visits to thoughtful senior pet support.",
    categories: ["vaccination", "supplies"],
    rating: 4.8,
    reviewCount: 96,
    startingPrice: 750,
    imageUrl:
      "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=900&q=80",
    verified: true,
    contact: "+63 917 555 0139",
    hours: "Mon–Sat · 8:00 AM–6:00 PM",
    services: [
      { id: 201, name: "Wellness Vaccine Visit", description: "A complete vaccine appointment with a nose-to-tail wellness check.", price: 900, durationMinutes: 45, category: "vaccination", available: true },
      { id: 202, name: "Puppy Protection Pack", description: "A guided series for young pets starting their vaccine journey.", price: 1800, durationMinutes: 50, category: "vaccination", available: true },
    ],
    products: [
      { id: 2001, name: "Daily Wellness Kibble", description: "Balanced everyday nutrition for adult dogs.", price: 1480, imageUrl: "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=600&q=80", category: "pet food", inStock: true },
      { id: 2002, name: "Cozy Cloud Bed", description: "Machine-washable comfort for deep afternoon naps.", price: 1290, imageUrl: "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?auto=format&fit=crop&w=600&q=80", category: "pet supplies", inStock: true },
    ],
  },
  {
    id: 3,
    name: "Whisker & Wag",
    location: "Pasig City",
    description:
      "A neighborhood grooming studio and pet pantry where every visit feels easy, friendly, and unhurried.",
    categories: ["grooming", "supplies"],
    rating: 4.7,
    reviewCount: 74,
    startingPrice: 500,
    imageUrl:
      "https://images.unsplash.com/photo-1591946614720-90a587da4a36?auto=format&fit=crop&w=900&q=80",
    verified: false,
    contact: "+63 917 555 0104",
    hours: "Tue–Sun · 10:00 AM–8:00 PM",
    services: [
      { id: 301, name: "Quick Clean", description: "Bath, dry, and brush for a fresh reset.", price: 500, durationMinutes: 45, category: "grooming", available: true },
      { id: 302, name: "Signature Groom", description: "Breed-aware styling, nail trim, and finishing touches.", price: 820, durationMinutes: 80, category: "grooming", available: true },
    ],
    products: [
      { id: 3001, name: "Tuna Toppers", description: "A savory boost for picky eaters.", price: 190, imageUrl: "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=600&q=80", category: "pet food", inStock: true },
    ],
  },
];

let pets: Pet[] = [
  { id: 1, name: "Milo", species: "Dog", breed: "Golden Retriever", age: "3 years", gender: "Male", weight: "24 kg", notes: "Loves belly rubs and gets nervous around dryers.", avatarUrl: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=300&q=80", nextVaccine: "2026-10-14" },
  { id: 2, name: "Luna", species: "Cat", breed: "Persian", age: "2 years", gender: "Female", weight: "4.2 kg", notes: "Prefers quiet rooms and gentle brushing.", avatarUrl: "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=300&q=80", nextVaccine: null },
];

const records: Record<number, CareRecord[]> = {
  1: [
    { id: 1, type: "grooming", title: "Full Groom", providerName: "The Gentle Paws", date: "2026-08-18", status: "Completed", notes: "Milo was comfortable throughout. Coat in great shape." },
    { id: 2, type: "vaccination", title: "Anti-rabies booster", providerName: "Bark & Bloom Clinic", date: "2026-05-14", status: "Completed", notes: "Next booster due October 14, 2026." },
  ],
  2: [
    { id: 3, type: "grooming", title: "Quick Clean", providerName: "Whisker & Wag", date: "2026-07-22", status: "Completed", notes: "Luna enjoyed the quiet grooming room." },
  ],
};

let bookings: Booking[] = [
  { id: 1, providerId: 1, providerName: "The Gentle Paws", serviceName: "Fresh & Fluffy", petId: 1, petName: "Milo", date: "2026-09-12", time: "10:30 AM", status: "Confirmed", price: 650 },
];
let orders: Order[] = [
  { id: 1, providerId: 1, providerName: "The Gentle Paws", total: 600, status: "Ready for delivery", itemCount: 2, createdAt: "2026-08-28" },
];

const router: IRouter = Router();

router.get("/providers", (req, res): void => {
  const parsed = ListProvidersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, search } = parsed.data;
  const query = search?.toLowerCase();
  const filtered = providers.filter((provider) => {
    const categoryMatch = !category || provider.categories.includes(category);
    const searchMatch = !query || `${provider.name} ${provider.location} ${provider.description}`.toLowerCase().includes(query);
    return categoryMatch && searchMatch;
  });
  res.json(ListProvidersResponse.parse(filtered));
});

router.get("/providers/:providerId", (req, res): void => {
  const parsed = GetProviderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const provider = providers.find((item) => item.id === parsed.data.providerId);
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  res.json(GetProviderResponse.parse(provider));
});

router.get("/pets", (_req, res): void => {
  res.json(ListPetsResponse.parse(pets));
});

router.post("/pets", (req, res): void => {
  const parsed = CreatePetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const pet: Pet = { id: Math.max(...pets.map((item) => item.id), 0) + 1, ...parsed.data, notes: parsed.data.notes ?? "", avatarUrl: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=300&q=80", nextVaccine: null };
  pets = [...pets, pet];
  records[pet.id] = [];
  res.status(201).json(CreatePetResponse.parse(pet));
});

router.patch("/pets/:petId", (req, res): void => {
  const params = UpdatePetParams.safeParse(req.params);
  const body = UpdatePetBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const index = pets.findIndex((item) => item.id === params.data.petId);
  if (index === -1) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  pets[index] = { ...pets[index], ...body.data };
  res.json(UpdatePetResponse.parse(pets[index]));
});

router.get("/pets/:petId/records", (req, res): void => {
  const parsed = GetPetRecordsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!pets.some((pet) => pet.id === parsed.data.petId)) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  const petRecords = records[parsed.data.petId] ?? [];
  res.json(GetPetRecordsResponse.parse({ grooming: petRecords.filter((record) => record.type === "grooming"), vaccinations: petRecords.filter((record) => record.type === "vaccination") }));
});

router.get("/bookings", (_req, res): void => {
  res.json(ListBookingsResponse.parse(bookings));
});

router.post("/bookings", (req, res): void => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const provider = providers.find((item) => item.id === parsed.data.providerId);
  const service = provider?.services.find((item) => item.id === parsed.data.serviceId);
  const pet = pets.find((item) => item.id === parsed.data.petId);
  if (!provider || !service || !pet) {
    res.status(400).json({ error: "Choose a valid provider, service, and pet." });
    return;
  }
  const booking: Booking = { id: Math.max(...bookings.map((item) => item.id), 0) + 1, providerId: provider.id, providerName: provider.name, serviceName: service.name, petId: pet.id, petName: pet.name, date: parsed.data.date, time: parsed.data.time, status: "Confirmed", price: service.price };
  bookings = [booking, ...bookings];
  res.status(201).json(CreateBookingResponse.parse(booking));
});

router.get("/orders", (_req, res): void => {
  res.json(ListOrdersResponse.parse(orders));
});

router.post("/orders", (req, res): void => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const provider = providers.find((item) => item.id === parsed.data.providerId);
  if (!provider) {
    res.status(400).json({ error: "Choose a valid provider." });
    return;
  }
  const total = parsed.data.items.reduce((sum, item) => {
    const product = provider.products.find((candidate) => candidate.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const order: Order = { id: Math.max(...orders.map((item) => item.id), 0) + 1, providerId: provider.id, providerName: provider.name, total, status: "Order received", itemCount: parsed.data.items.reduce((sum, item) => sum + item.quantity, 0), createdAt: new Date().toISOString().slice(0, 10) };
  orders = [order, ...orders];
  res.status(201).json(CreateOrderResponse.parse(order));
});

router.get("/dashboard/summary", (_req, res): void => {
  const nextBooking = bookings.find((booking) => booking.status !== "Completed") ?? null;
  const recentActivity = Object.values(records).flat().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  res.json(GetDashboardSummaryResponse.parse({ petCount: pets.length, upcomingBookingCount: bookings.filter((booking) => booking.status !== "Completed").length, recordCount: Object.values(records).flat().length, nextBooking, recentActivity }));
});

export default router;