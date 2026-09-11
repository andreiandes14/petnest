import { Router, type IRouter, type Request, type Response } from "express";
import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  MongoClient,
  type Collection,
  type OptionalUnlessRequiredId,
} from "mongodb";
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
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ProviderProduct = {
  id: number;
  providerId: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  nextDue?: string | null;
  bookingId?: number;
  serviceCategory?: "grooming" | "vaccination";
};

type Booking = {
  id: number;
  providerId: number;
  providerName: string;
  serviceName: string;
  serviceCategory: "grooming" | "vaccination";
  petId: number;
  petName: string;
  recordId: number | null;
  date: string;
  time: string;
  status: string;
  price: number;
  cancellationReason?: string | null;
  cancellationPreviousStatus?: string | null;
  cancellationDecision?: "pending" | "approved" | "rejected" | null;
  cancellationDecidedAt?: string | null;
};

type Order = {
  id: number;
  providerId: number;
  providerName: string;
  customerName: string;
  customerId: string;
  total: number;
  status: string;
  itemCount: number;
  items: Array<{
    productId: number;
    productName: string;
    price: number;
    quantity: number;
    imageUrl: string;
  }>;
  createdAt: string;
};

const seedProviders: Provider[] = [
  {
    id: 1,
    name: "The Gentle Paws",
    location: "Makati, Metro Manila",
    description:
      "A calm, caring space for everyday grooming and preventative care, built around pets who need a little extra patience.",
    categories: ["grooming", "vaccination", "pet-supplies"],
    rating: 4.9,
    reviewCount: 128,
    startingPrice: 650,
    imageUrl: "",
    verified: true,
    contact: "+63 917 555 0182",
    hours: "Mon–Sun · 9:00 AM–7:00 PM",
    services: [
      {
        id: 101,
        name: "Fresh & Fluffy",
        description: "Bath, blow dry, brush out, and finishing spritz.",
        price: 650,
        durationMinutes: 60,
        category: "grooming",
        available: true,
      },
      {
        id: 102,
        name: "Full Groom",
        description:
          "The complete tidy-up with trim, nail care, and ear cleaning.",
        price: 950,
        durationMinutes: 90,
        category: "grooming",
        available: true,
      },
      {
        id: 103,
        name: "Core Vaccination",
        description: "A gentle vaccination visit with a post-care check-in.",
        price: 850,
        durationMinutes: 30,
        category: "vaccination",
        available: true,
      },
    ],
    products: [
      {
        id: 1001,
        providerId: 1,
        name: "Salmon & Oat Bites",
        description: "Small-batch training treats for sensitive tummies.",
        price: 320,
        imageUrl: "",
        category: "pet-supplies",
        stock: 24,
        active: true,
      },
      {
        id: 1002,
        providerId: 1,
        name: "Everyday Paw Balm",
        description: "Soothing balm for city walks and dry paw pads.",
        price: 280,
        imageUrl: "",
        category: "pet-supplies",
        stock: 18,
        active: true,
      },
    ],
  },
  {
    id: 2,
    name: "Bark & Bloom Clinic",
    location: "Quezon City",
    description:
      "Modern veterinary care with a soft touch, from puppy wellness visits to thoughtful senior pet support.",
    categories: ["vaccination", "pet-supplies"],
    rating: 4.8,
    reviewCount: 96,
    startingPrice: 750,
    imageUrl: "",
    verified: true,
    contact: "+63 917 555 0139",
    hours: "Mon–Sat · 8:00 AM–6:00 PM",
    services: [
      {
        id: 201,
        name: "Wellness Vaccine Visit",
        description:
          "A complete vaccine appointment with a nose-to-tail wellness check.",
        price: 900,
        durationMinutes: 45,
        category: "vaccination",
        available: true,
      },
      {
        id: 202,
        name: "Puppy Protection Pack",
        description:
          "A guided series for young pets starting their vaccine journey.",
        price: 1800,
        durationMinutes: 50,
        category: "vaccination",
        available: true,
      },
    ],
    products: [
      {
        id: 2001,
        providerId: 2,
        name: "Daily Wellness Kibble",
        description: "Balanced everyday nutrition for adult dogs.",
        price: 1480,
        imageUrl: "",
        category: "pet-supplies",
        stock: 30,
        active: true,
      },
      {
        id: 2002,
        providerId: 2,
        name: "Cozy Cloud Bed",
        description: "Machine-washable comfort for deep afternoon naps.",
        price: 1290,
        imageUrl: "",
        category: "pet-supplies",
        stock: 8,
        active: true,
      },
    ],
  },
  {
    id: 3,
    name: "Whisker & Wag",
    location: "Pasig City",
    description:
      "A neighborhood grooming studio and pet pantry where every visit feels easy, friendly, and unhurried.",
    categories: ["grooming", "pet-supplies"],
    rating: 4.7,
    reviewCount: 74,
    startingPrice: 500,
    imageUrl: "",
    verified: false,
    contact: "+63 917 555 0104",
    hours: "Tue–Sun · 10:00 AM–8:00 PM",
    services: [
      {
        id: 301,
        name: "Quick Clean",
        description: "Bath, dry, and brush for a fresh reset.",
        price: 500,
        durationMinutes: 45,
        category: "grooming",
        available: true,
      },
      {
        id: 302,
        name: "Signature Groom",
        description: "Breed-aware styling, nail trim, and finishing touches.",
        price: 820,
        durationMinutes: 80,
        category: "grooming",
        available: true,
      },
    ],
    products: [
      {
        id: 3001,
        providerId: 3,
        name: "Tuna Toppers",
        description: "A savory boost for picky eaters.",
        price: 190,
        imageUrl: "",
        category: "pet-supplies",
        stock: 20,
        active: true,
      },
    ],
  },
];

const seedPets: Pet[] = [
  {
    id: 1,
    name: "Milo",
    species: "Dog",
    breed: "Golden Retriever",
    age: "3 years",
    gender: "Male",
    weight: "24 kg",
    notes: "Loves belly rubs and gets nervous around dryers.",
    avatarUrl: "",
    nextVaccine: "2026-10-14",
  },
  {
    id: 2,
    name: "Luna",
    species: "Cat",
    breed: "Persian",
    age: "2 years",
    gender: "Female",
    weight: "4.2 kg",
    notes: "Prefers quiet rooms and gentle brushing.",
    avatarUrl: "",
    nextVaccine: null,
  },
];

const seedRecords: Record<number, CareRecord[]> = {
  1: [
    {
      id: 1,
      type: "grooming",
      title: "Full Groom",
      providerName: "The Gentle Paws",
      date: "2026-08-18",
      status: "Completed",
      notes: "Milo was comfortable throughout. Coat in great shape.",
    },
    {
      id: 2,
      type: "vaccination",
      title: "Anti-rabies booster",
      providerName: "Bark & Bloom Clinic",
      date: "2026-05-14",
      status: "Completed",
      notes: "Next booster due October 14, 2026.",
    },
  ],
  2: [
    {
      id: 3,
      type: "grooming",
      title: "Quick Clean",
      providerName: "Whisker & Wag",
      date: "2026-07-22",
      status: "Completed",
      notes: "Luna enjoyed the quiet grooming room.",
    },
  ],
};

const seedBookings: Booking[] = [
  {
    id: 1,
    providerId: 1,
    providerName: "The Gentle Paws",
    serviceName: "Fresh & Fluffy",
    serviceCategory: "grooming",
    petId: 1,
    petName: "Milo",
    recordId: 1,
    date: "2026-09-12",
    time: "10:30 AM",
    status: "confirmed",
    price: 650,
  },
];
const seedOrders: Order[] = [
  {
    id: 1,
    providerId: 1,
    providerName: "The Gentle Paws",
    customerName: "PetNest customer",
    customerId: "legacy-seed-data",
    total: 600,
    status: "Ready for delivery",
    itemCount: 2,
    items: [
      {
        productId: 1001,
        productName: "Salmon & Oat Bites",
        price: 300,
        quantity: 2,
        imageUrl: "",
      },
    ],
    createdAt: "2026-08-28T10:00:00.000Z",
  },
];

type OwnedPet = Pet & {
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
};
type StoredCareRecord = CareRecord & {
  petId: number;
  ownerId: string;
  providerId?: number;
  providerName?: string;
  serviceId?: number;
  createdAt?: string;
  updatedAt?: string;
};
type StoredBooking = Booking & {
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
};
type StoredOrder = Order & { ownerId: string };
type Counter = { _id: string; value: number };
type Role = "customer" | "provider" | "admin";
type Access = { userId: string; role: Role; providerId?: number };
type UserProfile = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  providerId?: number;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
};
type StoredSession = { _id: string; userId: string; expiresAt: Date };

const legacyOwnerId = "legacy-seed-data";

function isValidBookingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return false;
  }
  return value >= new Date().toISOString().slice(0, 10);
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error("MONGODB_URI must be set to persist PetNest data.");
}

const client = new MongoClient(mongoUri);
const database = client.db();
const providerCollection: Collection<Provider> =
  database.collection("providers");
const petCollection: Collection<OwnedPet> = database.collection("pets");
const recordCollection: Collection<StoredCareRecord> =
  database.collection("careRecords");
const bookingCollection: Collection<StoredBooking> =
  database.collection("bookings");
const orderCollection: Collection<StoredOrder> = database.collection("orders");
const userCollection: Collection<UserProfile> = database.collection("users");
const sessionCollection: Collection<StoredSession> =
  database.collection("sessions");
const counterCollection: Collection<Counter> = database.collection("counters");

let initialization: Promise<void> | undefined;
const configuredSessionSecret = process.env.SESSION_SECRET;
if (!configuredSessionSecret)
  throw new Error("SESSION_SECRET must be set for PetNest sessions.");
const sessionSecret: string = configuredSessionSecret;
const sessionCookie = "petnest_session";
const sessionLifetimeMs = 1000 * 60 * 60 * 12;
const scrypt = promisify(scryptCallback);

function publicUser(user: UserProfile) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, salt, encoded] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sessionId(token: string): string {
  return createHmac("sha256", sessionSecret).update(token).digest("hex");
}

async function startSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await sessionCollection.insertOne({
    _id: sessionId(token),
    userId,
    expiresAt,
  });
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionLifetimeMs,
    path: "/",
  });
}

async function getAccess(req: Request, res: Response): Promise<Access | null> {
  const token =
    typeof req.cookies?.[sessionCookie] === "string"
      ? req.cookies[sessionCookie]
      : "";
  const session = token
    ? await sessionCollection.findOne({
        _id: sessionId(token),
        expiresAt: { $gt: new Date() },
      })
    : null;
  if (!session) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const user = await userCollection.findOne({ id: session.userId });
  if (!user) {
    res.clearCookie(sessionCookie, { path: "/" });
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return { userId: user.id, role: user.role, providerId: user.providerId };
}

async function requireAdmin(
  req: Request,
  res: Response,
): Promise<Access | null> {
  const access = await getAccess(req, res);
  if (access && access.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return access;
}

async function requireCustomer(
  req: Request,
  res: Response,
): Promise<Access | null> {
  const access = await getAccess(req, res);
  if (access && access.role !== "customer") {
    res.status(403).json({ error: "Customer access required" });
    return null;
  }
  return access;
}

async function requireProvider(
  req: Request,
  res: Response,
): Promise<Access | null> {
  const access = await getAccess(req, res);
  if (access && (access.role !== "provider" || !access.providerId)) {
    res
      .status(403)
      .json({ error: "Provider access and providerId metadata are required" });
    return null;
  }
  return access;
}

async function seedCollection<T extends { id: number }>(
  collection: Collection<T>,
  seed: T[],
) {
  if ((await collection.countDocuments()) === 0 && seed.length > 0) {
    await collection.insertMany(seed as OptionalUnlessRequiredId<T>[]);
  }
  await collection.createIndex({ id: 1 }, { unique: true });
}

async function setInitialCounter<T extends { id: number }>(
  name: string,
  collection: Collection<T>,
) {
  const latest = await collection.findOne(
    {},
    { sort: { id: -1 }, projection: { id: 1 } },
  );
  await counterCollection.updateOne(
    { _id: name },
    { $setOnInsert: { value: latest?.id ?? 0 } },
    { upsert: true },
  );
}

export function initializePetnestData(): Promise<void> {
  initialization ??= (async () => {
    await client.connect();
    // Remove the obsolete Clerk identity constraint. A non-sparse unique index
    // treats every local account (which has no clerkUserId) as a duplicate.
    if (await userCollection.indexExists("clerkUserId_1")) {
      await userCollection.dropIndex("clerkUserId_1");
    }
    await seedCollection(providerCollection, seedProviders);
    await seedCollection(
      petCollection,
      seedPets.map((pet) => ({ ...pet, ownerId: legacyOwnerId })),
    );
    await seedCollection(
      recordCollection,
      Object.entries(seedRecords).flatMap(([petId, entries]) =>
        entries.map((entry) => ({
          ...entry,
          petId: Number(petId),
          ownerId: legacyOwnerId,
        })),
      ),
    );
    await seedCollection(
      bookingCollection,
      seedBookings.map((booking) => ({ ...booking, ownerId: legacyOwnerId })),
    );
    await seedCollection(
      orderCollection,
      seedOrders.map((order) => ({ ...order, ownerId: legacyOwnerId })),
    );
    await Promise.all([
      petCollection.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId: legacyOwnerId } },
      ),
      recordCollection.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId: legacyOwnerId } },
      ),
      bookingCollection.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId: legacyOwnerId } },
      ),
      orderCollection.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId: legacyOwnerId } },
      ),
    ]);
    await bookingCollection.updateMany(
      { serviceCategory: { $exists: false } },
      { $set: { serviceCategory: "grooming", recordId: null } },
    );
    await providerCollection.updateMany({ categories: "supplies" }, [
      {
        $set: {
          categories: {
            $setUnion: [
              { $setDifference: ["$categories", ["supplies"]] },
              ["pet-supplies"],
            ],
          },
        },
      },
    ] as never);
    await providerCollection.updateMany({ products: { $exists: true } }, [
      {
        $set: {
          products: {
            $map: {
              input: "$products",
              as: "product",
              in: {
                $mergeObjects: [
                  "$$product",
                  {
                    providerId: "$id",
                    category: "pet-supplies",
                    stock: {
                      $cond: [
                        { $ne: [{ $type: "$$product.stock" }, "missing"] },
                        "$$product.stock",
                        { $cond: ["$$product.inStock", 1, 0] },
                      ],
                    },
                    active: {
                      $cond: [
                        { $ne: [{ $type: "$$product.active" }, "missing"] },
                        "$$product.active",
                        true,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ] as never);
    await orderCollection.updateMany(
      { items: { $exists: false } },
      { $set: { items: [] } },
    );
    await orderCollection.updateMany(
      { customerName: { $exists: false } },
      { $set: { customerName: "Customer" } },
    );
    await orderCollection.updateMany({ customerId: { $exists: false } }, [
      { $set: { customerId: "$ownerId" } },
    ] as never);
    await Promise.all([
      providerCollection.updateMany(
        { imageUrl: { $regex: "images\\.unsplash\\.com", $options: "i" } },
        { $set: { imageUrl: "" } },
      ),
      providerCollection.updateMany(
        {
          "products.imageUrl": {
            $regex: "images\\.unsplash\\.com",
            $options: "i",
          },
        },
        { $set: { "products.$[product].imageUrl": "" } },
        {
          arrayFilters: [
            {
              "product.imageUrl": {
                $regex: "images\\.unsplash\\.com",
                $options: "i",
              },
            },
          ],
        },
      ),
      petCollection.updateMany(
        { avatarUrl: { $regex: "images\\.unsplash\\.com", $options: "i" } },
        { $set: { avatarUrl: "" } },
      ),
      providerCollection.updateMany(
        {
          location: {
            $regex: new RegExp(
              ["Port", "land", "|", "Ore", "gon"].join(""),
              "i",
            ),
          },
        },
        { $set: { location: "Location not added" } },
      ),
      bookingCollection.updateMany({ status: { $type: "string" } }, [
        { $set: { status: { $toLower: "$status" } } },
      ]),
    ]);
    await Promise.all([
      userCollection.createIndex({ email: 1 }, { unique: true }),
      userCollection.createIndex({ id: 1 }, { unique: true }),
      sessionCollection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      ),
      recordCollection.createIndex(
        { bookingId: 1 },
        { unique: true, sparse: true },
      ),
      setInitialCounter("pets", petCollection),
      setInitialCounter("providers", providerCollection),
      setInitialCounter("bookings", bookingCollection),
      setInitialCounter("orders", orderCollection),
    ]);
  })();
  return initialization;
}

async function nextId(name: string): Promise<number> {
  await initializePetnestData();
  const counter = await counterCollection.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  if (!counter) throw new Error(`Unable to allocate ${name} id.`);
  return counter.value;
}

async function ensureCompletedBookingRecord(
  booking: StoredBooking,
): Promise<void> {
  if (booking.status !== "completed") return;
  const existing = await recordCollection.findOne({ bookingId: booking.id });
  if (existing) return;
  await recordCollection.insertOne({
    id: await nextId("records"),
    bookingId: booking.id,
    petId: booking.petId,
    ownerId: booking.ownerId,
    providerId: booking.providerId,
    providerName: booking.providerName,
    title: booking.serviceName,
    serviceCategory: booking.serviceCategory,
    type: booking.serviceCategory,
    date: booking.date,
    status: "completed",
    notes: "Completed service",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

const providerCategories = ["grooming", "vaccination", "pet-supplies"] as const;
type ProviderCategory = (typeof providerCategories)[number];

function validCategories(value: unknown): value is ProviderCategory[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => providerCategories.includes(item as ProviderCategory))
  );
}

function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function providerInput(body: Record<string, unknown>, existing?: Provider) {
  const categories = body.categories ?? existing?.categories;
  if (
    !validText(body.name ?? existing?.name) ||
    !validText(body.location ?? existing?.location) ||
    !validText(body.description ?? existing?.description) ||
    !validText(body.contact ?? existing?.contact) ||
    !validText(body.hours ?? existing?.hours) ||
    !validCategories(categories)
  ) {
    return null;
  }
  return {
    name: String(body.name ?? existing?.name).trim(),
    location: String(body.location ?? existing?.location).trim(),
    description: String(body.description ?? existing?.description).trim(),
    contact: String(body.contact ?? existing?.contact).trim(),
    hours: String(body.hours ?? existing?.hours).trim(),
    categories,
    imageUrl:
      typeof body.imageUrl === "string"
        ? body.imageUrl.trim()
        : (existing?.imageUrl ?? ""),
  };
}

const router: IRouter = Router();

async function register(req: Request, res: Response) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const role: Role = "customer";

  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid name and email address." });
    return;
  }
  if (password.length < 8) {
    res
      .status(400)
      .json({ error: "Password must contain at least 8 characters." });
    return;
  }

  let pendingUserId: string | undefined;
  try {
    await initializePetnestData();
    if (await userCollection.findOne({ email })) {
      res.status(409).json({ error: "That email address is taken." });
      return;
    }
    const [firstName, ...lastNameParts] = name.split(/\s+/);
    const lastName = lastNameParts.join(" ");
    const now = new Date().toISOString();
    const user: UserProfile = {
      id: randomUUID(),
      name,
      firstName,
      lastName,
      email,
      role,
      passwordHash: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    };
    pendingUserId = user.id;
    await userCollection.insertOne(user);
    await startSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    await Promise.all([
      pendingUserId
        ? userCollection.deleteOne({ id: pendingUserId })
        : Promise.resolve(),
      pendingUserId
        ? sessionCollection.deleteMany({ userId: pendingUserId })
        : Promise.resolve(),
    ]);
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ error: "That email address is taken." });
      return;
    }
    res.status(500).json({ error: "Account creation failed." });
  }
}

router.post("/auth/register", register);
router.post("/auth/sign-up", register);

router.post("/auth/login", async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  await initializePetnestData();
  const user = await userCollection.findOne({ email });
  if (
    !user?.passwordHash ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  await startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post("/auth/logout", async (req, res) => {
  const token =
    typeof req.cookies?.[sessionCookie] === "string"
      ? req.cookies[sessionCookie]
      : "";
  if (token) await sessionCollection.deleteOne({ _id: sessionId(token) });
  res.clearCookie(sessionCookie, { path: "/" });
  res.status(204).end();
});

router.get("/auth/me", async (req, res) => {
  const access = await getAccess(req, res);
  if (!access) return;
  const user = await userCollection.findOne({ id: access.userId });
  if (!user) return;
  res.json({ user: publicUser(user) });
});

router.patch("/customer/profile", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const firstName =
    typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
  const lastName =
    typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
  if (!firstName) {
    res.status(400).json({ error: "First name is required" });
    return;
  }
  const now = new Date().toISOString();
  await initializePetnestData();
  const user = await userCollection.findOneAndUpdate(
    { id: access.userId },
    {
      $set: {
        name: [firstName, lastName].filter(Boolean).join(" "),
        firstName,
        lastName,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json({ user: publicUser(user) });
});

router.get("/providers", async (req, res) => {
  const parsed = ListProvidersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await initializePetnestData();
  const { category, search } = parsed.data;
  const filter: Record<string, unknown> = {};
  filter.active = { $ne: false };
  if (category) {
    filter[category === "pet-supplies" ? "products" : "services"] = {
      $elemMatch:
        category === "pet-supplies"
          ? { category, active: true }
          : { category, available: true },
    };
  }
  if (search) {
    filter.$or = ["name", "location", "description"].map((field) => ({
      [field]: {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      },
    }));
  }
  const providers = await providerCollection
    .find(filter, { projection: { _id: 0, services: 0, products: 0 } })
    .sort({ id: 1 })
    .toArray();
  res.json(ListProvidersResponse.parse(providers));
});

router.get("/providers/:providerId", async (req, res) => {
  const parsed = GetProviderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const requestedCategory =
    typeof req.query.category === "string" ? req.query.category : undefined;
  if (
    req.query.category !== undefined &&
    (!requestedCategory ||
      !providerCategories.includes(requestedCategory as ProviderCategory))
  ) {
    res.status(400).json({ error: "Choose a valid provider category." });
    return;
  }
  await initializePetnestData();
  const provider = requestedCategory
    ? await providerCollection
        .aggregate<Provider>([
          {
            $match: {
              id: parsed.data.providerId,
              active: { $ne: false },
              [requestedCategory === "pet-supplies" ? "products" : "services"]:
                {
                  $elemMatch:
                    requestedCategory === "pet-supplies"
                      ? {
                          category: requestedCategory,
                          active: true,
                        }
                      : {
                          category: requestedCategory,
                          available: true,
                        },
                },
            },
          },
          {
            $set: {
              services:
                requestedCategory === "pet-supplies"
                  ? []
                  : {
                      $filter: {
                        input: "$services",
                        as: "service",
                        cond: {
                          $and: [
                            { $eq: ["$$service.category", requestedCategory] },
                            { $eq: ["$$service.available", true] },
                          ],
                        },
                      },
                    },
              products:
                requestedCategory === "pet-supplies"
                  ? {
                      $filter: {
                        input: "$products",
                        as: "product",
                        cond: {
                          $and: [
                            { $eq: ["$$product.category", requestedCategory] },
                            { $eq: ["$$product.active", true] },
                          ],
                        },
                      },
                    }
                  : [],
            },
          },
          { $unset: "_id" },
        ])
        .next()
    : await providerCollection.findOne(
        { id: parsed.data.providerId, active: true },
        { projection: { _id: 0 } },
      );
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  res.json(GetProviderResponse.parse(provider));
});

router.get("/services", async (req, res) => {
  await initializePetnestData();
  const providerId =
    req.query.providerId === undefined
      ? undefined
      : Number(req.query.providerId);
  const category =
    typeof req.query.category === "string" ? req.query.category : undefined;
  if (category === "pet-supplies") {
    res.json([]);
    return;
  }
  if (category && category !== "grooming" && category !== "vaccination") {
    res.status(400).json({ error: "Choose a valid service category." });
    return;
  }
  const providers = await providerCollection
    .aggregate<Pick<Provider, "id" | "name" | "services">>([
      {
        $match: {
          active: { $ne: false },
          ...(providerId === undefined ? {} : { id: providerId }),
          ...(category
            ? {
                services: {
                  $elemMatch: { category, available: { $ne: false } },
                },
              }
            : {}),
        },
      },
      {
        $project: {
          _id: 0,
          id: 1,
          name: 1,
          services: category
            ? {
                $filter: {
                  input: "$services",
                  as: "service",
                  cond: {
                    $and: [
                      { $eq: ["$$service.category", category] },
                      { $ne: ["$$service.available", false] },
                    ],
                  },
                },
              }
            : "$services",
        },
      },
    ])
    .toArray();
  const services = providers.flatMap((provider) =>
    provider.services
      .filter((service) => !category || service.category === category)
      .map((service) => ({
        ...service,
        providerId: provider.id,
        providerName: provider.name,
      })),
  );
  res.json(services);
});

router.get("/services/:serviceId", async (req, res) => {
  await initializePetnestData();
  const serviceId = Number(req.params.serviceId);
  const provider = await providerCollection.findOne({
    "services.id": serviceId,
    active: { $ne: false },
  });
  const service = provider?.services.find((item) => item.id === serviceId);
  if (!provider || !service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.json({
    ...service,
    providerId: provider.id,
    providerName: provider.name,
  });
});

router.get("/provider/profile", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  await initializePetnestData();
  const provider = await providerCollection.findOne(
    { id: access.providerId },
    { projection: { _id: 0 } },
  );
  if (!provider) {
    res.status(404).json({ error: "Assigned provider not found" });
    return;
  }
  res.json(GetProviderResponse.parse(provider));
});

router.patch("/provider/profile", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const parsed = GetProviderResponse.safeParse(req.body);
  if (!parsed.success || parsed.data.id !== access.providerId) {
    res
      .status(400)
      .json({ error: "A valid assigned provider profile is required" });
    return;
  }
  await initializePetnestData();
  const existing = await providerCollection.findOne({ id: access.providerId });
  if (!existing) {
    res.status(404).json({ error: "Assigned provider not found" });
    return;
  }
  const { id: _id, ...providerInput } = parsed.data;
  const changes: Omit<Provider, "id"> = {
    ...providerInput,
    imageUrl: providerInput.imageUrl ?? existing.imageUrl,
    verified: existing.verified,
    services: providerInput.services.map((service) => ({
      ...service,
      available: service.available ?? true,
      updatedAt: new Date().toISOString(),
    })),
    products: providerInput.products.map((product) => ({
      ...product,
      imageUrl:
        product.imageUrl ??
        existing.products.find((item) => item.id === product.id)?.imageUrl ??
        "",
    })),
    updatedAt: new Date().toISOString(),
  };
  const provider = await providerCollection.findOneAndUpdate(
    { id: access.providerId },
    { $set: changes },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!provider) {
    res.status(404).json({ error: "Assigned provider not found" });
    return;
  }
  res.json(GetProviderResponse.parse(provider));
});

router.get("/admin/providers", async (req, res) => {
  const access = await requireAdmin(req, res);
  if (!access) return;
  await initializePetnestData();
  res.json(
    await providerCollection
      .find({}, { projection: { _id: 0 } })
      .sort({ id: 1 })
      .toArray(),
  );
});

router.post("/admin/providers", async (req, res) => {
  const access = await requireAdmin(req, res);
  if (!access) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const input = providerInput(body);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!input || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    res.status(400).json({
      error:
        "Provider details, a valid email, and an 8-character password are required.",
    });
    return;
  }
  await initializePetnestData();
  if (await userCollection.findOne({ email })) {
    res.status(409).json({ error: "That email address is taken." });
    return;
  }
  const providerId = await nextId("providers");
  const now = new Date().toISOString();
  const provider: Provider = {
    id: providerId,
    ...input,
    rating: 0,
    reviewCount: 0,
    startingPrice: 0,
    verified: false,
    services: [],
    products: [],
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  const [firstName, ...lastNameParts] = String(body.name).trim().split(/\s+/);
  const user: UserProfile = {
    id: randomUUID(),
    name: String(body.name).trim(),
    firstName,
    lastName: lastNameParts.join(" "),
    email,
    role: "provider",
    providerId,
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await providerCollection.insertOne(provider);
    await userCollection.insertOne(user);
  } catch (error) {
    await providerCollection.deleteOne({ id: providerId });
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ error: "That provider account already exists." });
      return;
    }
    throw error;
  }
  res.status(201).json(GetProviderResponse.parse(provider));
});

router.patch("/admin/providers/:providerId", async (req, res) => {
  const access = await requireAdmin(req, res);
  if (!access) return;
  const providerId = Number(req.params.providerId);
  await initializePetnestData();
  const existing = await providerCollection.findOne({ id: providerId });
  if (!existing) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  const input = providerInput(
    (req.body ?? {}) as Record<string, unknown>,
    existing,
  );
  if (!input) {
    res
      .status(400)
      .json({ error: "Valid provider details and categories are required." });
    return;
  }
  const provider = await providerCollection.findOneAndUpdate(
    { id: providerId },
    {
      $set: {
        ...input,
        active: req.body.active !== false,
        updatedAt: new Date().toISOString(),
      },
    },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  res.json(provider);
});

router.delete("/admin/providers/:providerId", async (req, res) => {
  const access = await requireAdmin(req, res);
  if (!access) return;
  const providerId = Number(req.params.providerId);
  await initializePetnestData();
  const existing = await providerCollection.findOne({ id: providerId });
  if (!existing) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  const provider = await providerCollection.findOneAndUpdate(
    { id: providerId },
    { $set: { active: false, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  res.json(provider);
});

router.post("/provider/services", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const category = body.category;
  if (
    !validText(body.name) ||
    !validText(body.description) ||
    !providerCategories.slice(0, 2).includes(category as ProviderCategory) ||
    typeof body.price !== "number" ||
    body.price < 0 ||
    typeof body.durationMinutes !== "number" ||
    body.durationMinutes <= 0
  ) {
    res.status(400).json({
      error:
        "Name, description, grooming/vaccination category, price, and duration are required.",
    });
    return;
  }
  await initializePetnestData();
  const provider = await providerCollection.findOne({ id: access.providerId });
  if (!provider || !provider.categories.includes(category as string)) {
    res
      .status(400)
      .json({ error: "The provider is not assigned to that category." });
    return;
  }
  const service: ProviderService = {
    id: await nextId("services"),
    name: body.name.trim(),
    description: body.description.trim(),
    price: body.price,
    durationMinutes: body.durationMinutes,
    category: category as string,
    available: body.available !== false,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() : "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await providerCollection.updateOne(
    { id: provider.id },
    {
      $push: { services: service },
      $set: { updatedAt: new Date().toISOString() },
    },
  );
  res.status(201).json(service);
});

router.patch("/provider/services/:serviceId", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  await initializePetnestData();
  const serviceId = Number(req.params.serviceId);
  const provider = await providerCollection.findOne({
    id: access.providerId,
    "services.id": serviceId,
  });
  if (!provider) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  const existing = provider.services.find((item) => item.id === serviceId)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const category = body.category ?? existing.category;
  if (
    !validText(body.name ?? existing.name) ||
    !validText(body.description ?? existing.description) ||
    !provider.categories.includes(category as string) ||
    typeof (body.price ?? existing.price) !== "number" ||
    typeof (body.durationMinutes ?? existing.durationMinutes) !== "number"
  ) {
    res.status(400).json({ error: "Valid service details are required." });
    return;
  }
  const updated = {
    ...existing,
    name: String(body.name ?? existing.name).trim(),
    description: String(body.description ?? existing.description).trim(),
    price: Number(body.price ?? existing.price),
    durationMinutes: Number(body.durationMinutes ?? existing.durationMinutes),
    category: String(category),
    available: body.available !== false,
    imageUrl:
      typeof body.imageUrl === "string"
        ? body.imageUrl.trim()
        : (existing.imageUrl ?? ""),
    updatedAt: new Date().toISOString(),
  };
  await providerCollection.updateOne(
    { id: provider.id, "services.id": serviceId },
    { $set: { "services.$": updated, updatedAt: new Date().toISOString() } },
  );
  res.json(updated);
});

router.delete("/provider/services/:serviceId", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const serviceId = Number(req.params.serviceId);
  await initializePetnestData();
  const result = await providerCollection.updateOne(
    { id: access.providerId, "services.id": serviceId },
    {
      $set: {
        "services.$.available": false,
        "services.$.updatedAt": new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  );
  if (!result.modifiedCount) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.status(204).end();
});

router.post("/provider/products", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (
    !validText(body.name) ||
    !validText(body.description) ||
    !validText(body.category) ||
    typeof body.price !== "number" ||
    body.price < 0
  ) {
    res
      .status(400)
      .json({ error: "Name, description, category, and price are required." });
    return;
  }
  await initializePetnestData();
  const provider = await providerCollection.findOne({ id: access.providerId });
  if (!provider) {
    res
      .status(404)
      .json({ error: "The authenticated provider shop was not found." });
    return;
  }
  if (!Number.isInteger(body.stock) || Number(body.stock) < 0) {
    res
      .status(400)
      .json({ error: "Stock must be a non-negative whole number." });
    return;
  }
  const product: ProviderProduct = {
    id: await nextId("products"),
    providerId: provider.id,
    name: body.name.trim(),
    description: body.description.trim(),
    price: body.price,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() : "",
    category: "pet-supplies",
    stock: Number(body.stock),
    active: body.active !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const savedProvider = await providerCollection.findOneAndUpdate(
    { id: provider.id },
    {
      $push: { products: product },
      $addToSet: { categories: "pet-supplies" },
      $set: { updatedAt: new Date().toISOString() },
    },
    { returnDocument: "after", projection: { _id: 0, products: 1 } },
  );
  if (!savedProvider?.products.some((item) => item.id === product.id)) {
    res
      .status(500)
      .json({ error: "MongoDB did not confirm the saved product." });
    return;
  }
  res.status(201).json(product);
});

router.patch("/provider/products/:productId", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  await initializePetnestData();
  const productId = Number(req.params.productId);
  const provider = await providerCollection.findOne({
    id: access.providerId,
    "products.id": productId,
  });
  if (!provider) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const existing = provider.products.find((item) => item.id === productId)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (
    body.stock !== undefined &&
    (!Number.isInteger(body.stock) || Number(body.stock) < 0)
  ) {
    res
      .status(400)
      .json({ error: "Stock must be a non-negative whole number." });
    return;
  }
  const updated = {
    ...existing,
    name: validText(body.name) ? body.name.trim() : existing.name,
    description: validText(body.description)
      ? body.description.trim()
      : existing.description,
    price:
      typeof body.price === "number" && body.price >= 0
        ? body.price
        : existing.price,
    category: "pet-supplies",
    stock: body.stock === undefined ? existing.stock : Number(body.stock),
    active: typeof body.active === "boolean" ? body.active : existing.active,
    imageUrl:
      typeof body.imageUrl === "string"
        ? body.imageUrl.trim()
        : existing.imageUrl,
    updatedAt: new Date().toISOString(),
  };
  await providerCollection.updateOne(
    { id: provider.id, "products.id": productId },
    { $set: { "products.$": updated, updatedAt: new Date().toISOString() } },
  );
  res.json(updated);
});

router.delete("/provider/products/:productId", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const productId = Number(req.params.productId);
  await initializePetnestData();
  const result = await providerCollection.updateOne(
    { id: access.providerId, "products.id": productId },
    {
      $set: { "products.$.active": false, updatedAt: new Date().toISOString() },
    },
  );
  if (!result.modifiedCount) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.status(204).end();
});

router.get("/pets", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  await initializePetnestData();
  const pets = await petCollection
    .find({ ownerId: access.userId }, { projection: { _id: 0, ownerId: 0 } })
    .sort({ id: 1 })
    .toArray();
  res.json(ListPetsResponse.parse(pets));
});

router.post("/pets", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const parsed = CreatePetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const pet: OwnedPet = {
    id: await nextId("pets"),
    ...parsed.data,
    notes: parsed.data.notes ?? "",
    avatarUrl: "",
    nextVaccine: null,
    ownerId: access.userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await petCollection.insertOne(pet);
  res.status(201).json(CreatePetResponse.parse(pet));
});

router.get("/pets/:petId", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const petId = Number(req.params.petId);
  if (!Number.isInteger(petId) || petId <= 0) {
    res.status(400).json({ error: "A valid pet is required" });
    return;
  }
  const pet = await petCollection.findOne(
    { id: petId, ownerId: access.userId },
    { projection: { _id: 0, ownerId: 0 } },
  );
  if (!pet) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  res.json(pet);
});

router.patch("/pets/:petId", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
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
  await initializePetnestData();
  const pet = await petCollection.findOneAndUpdate(
    { id: params.data.petId, ownerId: access.userId },
    { $set: { ...body.data, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!pet) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  res.json(UpdatePetResponse.parse(pet));
});

router.put("/pets/:petId", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const petId = Number(req.params.petId);
  const body = UpdatePetBody.safeParse(req.body);
  if (!Number.isInteger(petId) || petId <= 0 || !body.success) {
    res.status(400).json({ error: "Valid pet details are required" });
    return;
  }
  const pet = await petCollection.findOneAndUpdate(
    { id: petId, ownerId: access.userId },
    { $set: { ...body.data, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0, ownerId: 0 } },
  );
  if (!pet) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  res.json(UpdatePetResponse.parse(pet));
});

router.delete("/pets/:petId", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const petId = Number(req.params.petId);
  if (!Number.isInteger(petId) || petId <= 0) {
    res.status(400).json({ error: "A valid pet is required" });
    return;
  }
  if (
    await bookingCollection.findOne({
      petId,
      ownerId: access.userId,
      status: { $nin: ["completed", "cancelled"] },
    })
  ) {
    res
      .status(409)
      .json({ error: "Cancel active bookings before deleting this pet." });
    return;
  }
  const deleted = await petCollection.deleteOne({
    id: petId,
    ownerId: access.userId,
  });
  if (!deleted.deletedCount) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  await recordCollection.deleteMany({ petId, ownerId: access.userId });
  res.status(204).end();
});

router.get("/pets/:petId/records", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const parsed = GetPetRecordsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await initializePetnestData();
  if (
    !(await petCollection.findOne({
      id: parsed.data.petId,
      ownerId: access.userId,
    }))
  ) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  const completedBookings = await bookingCollection
    .find({
      petId: parsed.data.petId,
      ownerId: access.userId,
      status: "completed",
    })
    .toArray();
  await Promise.all(completedBookings.map(ensureCompletedBookingRecord));
  const petRecords = await recordCollection
    .find(
      { petId: parsed.data.petId, ownerId: access.userId },
      { projection: { _id: 0, petId: 0, ownerId: 0, providerId: 0 } },
    )
    .sort({ date: -1 })
    .toArray();
  res.json(
    GetPetRecordsResponse.parse({
      grooming: petRecords.filter((record) => record.type === "grooming"),
      vaccinations: petRecords.filter(
        (record) => record.type === "vaccination",
      ),
    }),
  );
});

router.get("/provider/records", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const type =
    req.query.type === "vaccination" || req.query.type === "grooming"
      ? req.query.type
      : undefined;
  await initializePetnestData();
  const completedBookings = await bookingCollection
    .find({ providerId: access.providerId, status: "completed" })
    .toArray();
  await Promise.all(completedBookings.map(ensureCompletedBookingRecord));
  const records = await recordCollection
    .find(
      { providerId: access.providerId, ...(type ? { type } : {}) },
      { projection: { _id: 0 } },
    )
    .sort({ date: -1 })
    .toArray();
  res.json(records);
});

router.get("/provider/pets", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  await initializePetnestData();
  const bookings = await bookingCollection
    .find(
      { providerId: access.providerId },
      { projection: { petId: 1, ownerId: 1 } },
    )
    .toArray();
  const petIds = [...new Set(bookings.map((booking) => booking.petId))];
  const pets = await petCollection
    .find({ id: { $in: petIds } }, { projection: { _id: 0, ownerId: 0 } })
    .toArray();
  const owners = await userCollection
    .find(
      { id: { $in: bookings.map((booking) => booking.ownerId) } },
      { projection: { _id: 0, id: 1, name: 1, email: 1 } },
    )
    .toArray();
  res.json(
    pets.map((pet) => {
      const ownerId = bookings.find(
        (booking) => booking.petId === pet.id,
      )?.ownerId;
      const owner = owners.find((candidate) => candidate.id === ownerId);
      return {
        ...pet,
        ownerName: owner?.name ?? "Customer",
        ownerEmail: owner?.email ?? "",
      };
    }),
  );
});

router.get("/provider/pets/:petId/records", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const petId = Number(req.params.petId);
  await initializePetnestData();
  const relationship = await bookingCollection.findOne({
    providerId: access.providerId,
    petId,
  });
  if (!relationship) {
    res
      .status(404)
      .json({ error: "Pet is not associated with this provider." });
    return;
  }
  const completedBookings = await bookingCollection
    .find({ providerId: access.providerId, petId, status: "completed" })
    .toArray();
  await Promise.all(completedBookings.map(ensureCompletedBookingRecord));
  const [pet, records] = await Promise.all([
    petCollection.findOne(
      { id: petId },
      { projection: { _id: 0, ownerId: 0 } },
    ),
    recordCollection
      .find(
        { petId, providerId: access.providerId },
        { projection: { _id: 0 } },
      )
      .sort({ date: -1 })
      .toArray(),
  ]);
  if (!pet) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  const owner = await userCollection.findOne(
    { id: relationship.ownerId },
    { projection: { _id: 0, name: 1, email: 1 } },
  );
  res.json({
    pet,
    owner: { name: owner?.name ?? "Customer", email: owner?.email ?? "" },
    records,
  });
});

router.post("/provider/records", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const type =
    body.type === "vaccination" || body.type === "grooming" ? body.type : null;
  const petId = Number(body.petId);
  const serviceId =
    body.serviceId === undefined ? undefined : Number(body.serviceId);
  if (
    !type ||
    !Number.isInteger(petId) ||
    petId <= 0 ||
    !validText(body.date) ||
    !validText(body.notes)
  ) {
    res
      .status(400)
      .json({ error: "Record type, pet, date, and notes are required." });
    return;
  }
  await initializePetnestData();
  const provider = await providerCollection.findOne({ id: access.providerId });
  const booking = await bookingCollection.findOne({
    providerId: access.providerId,
    petId,
    serviceCategory: type,
    status: { $nin: ["cancelled"] },
  });
  if (!provider || !booking) {
    res.status(400).json({
      error:
        "The pet must have a booking with this provider before a history record can be added.",
    });
    return;
  }
  const service = serviceId
    ? provider.services.find(
        (item) => item.id === serviceId && item.category === type,
      )
    : provider.services.find(
        (item) => item.name === booking.serviceName && item.category === type,
      );
  if (serviceId && !service) {
    res.status(400).json({ error: "Choose a service owned by this provider." });
    return;
  }
  const record: StoredCareRecord = {
    id: await nextId("records"),
    type,
    title: validText(body.title)
      ? body.title.trim()
      : (service?.name ?? booking.serviceName),
    providerName: provider.name,
    providerId: provider.id,
    serviceId: service?.id,
    petId,
    ownerId: booking.ownerId,
    date: body.date.trim(),
    status: "completed",
    notes: body.notes.trim(),
    nextDue:
      type === "vaccination" && typeof body.nextDue === "string"
        ? body.nextDue
        : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await recordCollection.insertOne(record);
  res.status(201).json(record);
});

router.patch("/provider/records/:recordId", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const recordId = Number(req.params.recordId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const changes: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (validText(body.title)) changes.title = body.title.trim();
  if (validText(body.date)) changes.date = body.date.trim();
  if (validText(body.notes)) changes.notes = body.notes.trim();
  if (body.nextDue === null || typeof body.nextDue === "string")
    changes.nextDue = body.nextDue;
  await initializePetnestData();
  const record = await recordCollection.findOneAndUpdate(
    { id: recordId, providerId: access.providerId },
    { $set: changes },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!record) {
    res.status(404).json({ error: "History record not found" });
    return;
  }
  res.json(record);
});

router.get("/bookings", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  await initializePetnestData();
  const bookings = await bookingCollection
    .find({ ownerId: access.userId }, { projection: { _id: 0, ownerId: 0 } })
    .sort({ id: -1 })
    .toArray();
  res.json(ListBookingsResponse.parse(bookings));
});

router.get("/bookings/:bookingId", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const bookingId = Number(req.params.bookingId);
  const booking = await bookingCollection.findOne(
    { id: bookingId, ownerId: access.userId },
    { projection: { _id: 0, ownerId: 0 } },
  );
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.json(booking);
});

router.post("/bookings", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (
    !Number.isInteger(parsed.data.providerId) ||
    parsed.data.providerId <= 0 ||
    !Number.isInteger(parsed.data.serviceId) ||
    parsed.data.serviceId <= 0 ||
    !Number.isInteger(parsed.data.petId) ||
    parsed.data.petId <= 0
  ) {
    res
      .status(400)
      .json({ error: "Choose a valid provider, service, and pet." });
    return;
  }
  if (!isValidBookingDate(parsed.data.date)) {
    res
      .status(400)
      .json({ error: "Choose a valid booking date that is today or later." });
    return;
  }
  const requestedStart = timeToMinutes(parsed.data.time);
  if (requestedStart === null) {
    res.status(400).json({ error: "Choose a valid booking time." });
    return;
  }
  await initializePetnestData();
  const provider = await providerCollection.findOne({
    id: parsed.data.providerId,
    active: { $ne: false },
  });
  const service = provider?.services.find(
    (item) => item.id === parsed.data.serviceId,
  );
  const pet = await petCollection.findOne({
    id: parsed.data.petId,
    ownerId: access.userId,
  });
  if (!provider || !service || !pet) {
    res
      .status(400)
      .json({ error: "Choose a valid provider, service, and pet." });
    return;
  }
  if (!service.available) {
    res.status(400).json({ error: "This service is not currently available." });
    return;
  }
  if (service.category !== "grooming" && service.category !== "vaccination") {
    res
      .status(400)
      .json({ error: "Choose a grooming or vaccination service." });
    return;
  }
  if (!provider.categories.includes(service.category)) {
    res
      .status(400)
      .json({ error: "This service is not offered by the provider." });
    return;
  }
  if (parsed.data.recordId !== null) {
    const record = await recordCollection.findOne({
      id: parsed.data.recordId,
      petId: pet.id,
      ownerId: access.userId,
      type: service.category,
    });
    if (!record) {
      res.status(400).json({
        error: "Choose a record that belongs to this pet and service.",
      });
      return;
    }
  }
  const providerBookings = await bookingCollection
    .find({
      providerId: provider.id,
      date: parsed.data.date,
      status: { $nin: ["cancelled"] },
    })
    .project({ time: 1, serviceName: 1, serviceCategory: 1 })
    .toArray();
  const conflict = providerBookings.find((existing) => {
    const existingService = provider.services.find(
      (item) =>
        item.name === existing.serviceName &&
        item.category === existing.serviceCategory,
    );
    const existingStart = timeToMinutes(existing.time);
    if (existingStart === null) return false;
    const existingEnd =
      existingStart + (existingService?.durationMinutes ?? 30);
    const requestedEnd = requestedStart + service.durationMinutes;
    return requestedStart < existingEnd && existingStart < requestedEnd;
  });
  if (conflict) {
    res.status(409).json({
      error:
        "This time slot is no longer available. Please choose another time.",
    });
    return;
  }
  const booking: StoredBooking = {
    id: await nextId("bookings"),
    providerId: provider.id,
    providerName: provider.name,
    serviceName: service.name,
    serviceCategory: service.category,
    petId: pet.id,
    petName: pet.name,
    recordId: parsed.data.recordId,
    date: parsed.data.date,
    time: parsed.data.time,
    status: "pending",
    price: service.price,
    ownerId: access.userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await bookingCollection.insertOne(booking);
  res.status(201).json(CreateBookingResponse.parse(booking));
});

router.delete("/bookings/:bookingId", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  res.status(405).json({ error: "Use a cancellation request with a reason." });
});

router.post("/bookings/:bookingId/cancellation-request", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const bookingId = Number(req.params.bookingId);
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    res.status(400).json({ error: "Cancellation reason is required." });
    return;
  }
  await initializePetnestData();
  const booking = await bookingCollection.findOne({
    id: bookingId,
    ownerId: access.userId,
  });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (
    ["completed", "cancelled", "cancellation_pending"].includes(booking.status)
  ) {
    res.status(409).json({
      error: "This booking cannot accept another cancellation request.",
    });
    return;
  }
  const updated = await bookingCollection.findOneAndUpdate(
    { id: bookingId, ownerId: access.userId, status: booking.status },
    {
      $set: {
        status: "cancellation_pending",
        cancellationReason: reason,
        cancellationPreviousStatus: booking.status,
        cancellationDecision: "pending",
        cancellationDecidedAt: null,
        updatedAt: new Date().toISOString(),
      },
    },
    { returnDocument: "after", projection: { _id: 0, ownerId: 0 } },
  );
  res.status(200).json(updated);
});

router.get("/provider/bookings", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const bookings = await bookingCollection
    .find({ providerId: access.providerId }, { projection: { _id: 0 } })
    .sort({ date: 1, time: 1 })
    .toArray();
  res.json(
    bookings.map(({ ownerId, ...booking }) => ({
      ...booking,
      customerId: ownerId,
    })),
  );
});

router.patch("/provider/bookings/:bookingId/status", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  const bookingId = Number(req.params.bookingId);
  const status =
    typeof req.body?.status === "string" ? req.body.status.toLowerCase() : "";
  const allowedStatuses = [
    "confirmed",
    "cancelled",
    "completed",
    "approve_cancellation",
    "reject_cancellation",
  ];
  if (
    !Number.isInteger(bookingId) ||
    bookingId <= 0 ||
    !allowedStatuses.includes(status)
  ) {
    res.status(400).json({ error: "A valid booking and status are required" });
    return;
  }
  await initializePetnestData();
  const current = await bookingCollection.findOne({
    id: bookingId,
    providerId: access.providerId,
  });
  if (!current) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  let update: Record<string, unknown>;
  if (status === "approve_cancellation" || status === "reject_cancellation") {
    if (current.status !== "cancellation_pending") {
      res
        .status(409)
        .json({ error: "This booking has no pending cancellation request." });
      return;
    }
    const approved = status === "approve_cancellation";
    update = {
      status: approved
        ? "cancelled"
        : (current.cancellationPreviousStatus ?? "confirmed"),
      cancellationDecision: approved ? "approved" : "rejected",
      cancellationDecidedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    if (current.status === "cancellation_pending") {
      res.status(409).json({
        error: "Use cancellation approval or rejection for this request.",
      });
      return;
    }
    if (["completed", "cancelled"].includes(current.status)) {
      res
        .status(409)
        .json({ error: "Completed or cancelled bookings cannot be changed." });
      return;
    }
    if (status === "confirmed" && current.status !== "pending") {
      res
        .status(409)
        .json({ error: "Only pending bookings can be confirmed." });
      return;
    }
    if (status === "completed" && current.status !== "confirmed") {
      res
        .status(409)
        .json({ error: "Only confirmed bookings can be completed." });
      return;
    }
    update = { status, updatedAt: new Date().toISOString() };
  }
  const booking = await bookingCollection.findOneAndUpdate(
    { id: bookingId, providerId: access.providerId },
    { $set: update },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (status === "completed") {
    const existingRecord = await recordCollection.findOne({
      bookingId: booking.id,
    });
    if (!existingRecord) {
      await recordCollection.insertOne({
        id: await nextId("records"),
        bookingId: booking.id,
        petId: booking.petId,
        ownerId: booking.ownerId,
        providerId: booking.providerId,
        providerName: booking.providerName,
        title: booking.serviceName,
        serviceCategory: booking.serviceCategory,
        type: booking.serviceCategory,
        date: booking.date,
        status: "completed",
        notes: "Completed service",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  const { ownerId, ...publicBooking } = booking;
  res.json({ ...publicBooking, customerId: ownerId });
});

router.get("/admin/bookings", async (req, res) => {
  const access = await requireAdmin(req, res);
  if (!access) return;
  await initializePetnestData();
  const bookings = await bookingCollection
    .find({}, { projection: { _id: 0 } })
    .sort({ date: 1, id: -1 })
    .toArray();
  res.json(
    bookings.map(({ ownerId, ...booking }) => ({
      ...booking,
      customerId: ownerId,
    })),
  );
});

router.patch("/admin/bookings/:bookingId/status", async (req, res) => {
  const access = await requireAdmin(req, res);
  if (!access) return;
  res
    .status(403)
    .json({ error: "Booking status is managed by the assigned provider." });
});

router.get("/orders", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  await initializePetnestData();
  const orders = await orderCollection
    .find({ ownerId: access.userId }, { projection: { _id: 0, ownerId: 0 } })
    .sort({ id: -1 })
    .toArray();
  res.json(ListOrdersResponse.parse(orders));
});

router.get("/provider/orders", async (req, res) => {
  const access = await requireProvider(req, res);
  if (!access?.providerId) return;
  await initializePetnestData();
  const orders = await orderCollection
    .find(
      { providerId: access.providerId },
      { projection: { _id: 0, ownerId: 0 } },
    )
    .sort({ id: -1 })
    .toArray();
  res.json(ListOrdersResponse.parse(orders));
});

router.post("/orders", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await initializePetnestData();
  const provider = await providerCollection.findOne({
    id: parsed.data.providerId,
    active: { $ne: false },
  });
  if (!provider) {
    res.status(400).json({ error: "Choose a valid provider." });
    return;
  }
  const requested = parsed.data.items;
  if (
    !requested.length ||
    requested.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity < 1,
    )
  ) {
    res
      .status(400)
      .json({ error: "Choose at least one product and a valid quantity." });
    return;
  }
  const customer = await userCollection.findOne({ id: access.userId });
  const ids = requested.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) {
    res.status(400).json({ error: "Duplicate products are not allowed." });
    return;
  }
  const items = requested.map((item) => {
    const product = provider.products.find(
      (candidate) => candidate.id === item.productId,
    );
    return product ? { product, quantity: item.quantity } : null;
  });
  if (
    items.some(
      (item) =>
        !item ||
        item.product.active === false ||
        item.product.stock < item.quantity,
    )
  ) {
    res.status(409).json({
      error:
        "A product is inactive or no longer has enough stock. Refresh your cart and try again.",
    });
    return;
  }
  const orderItems = items.map((item) => ({
    productId: item!.product.id,
    productName: item!.product.name,
    price: item!.product.price,
    quantity: item!.quantity,
    imageUrl: item!.product.imageUrl,
  }));
  const total = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const decremented: Array<{ productId: number; quantity: number }> = [];
  for (const item of orderItems) {
    const result = await providerCollection.updateOne(
      {
        id: provider.id,
        products: {
          $elemMatch: {
            id: item.productId,
            active: { $ne: false },
            stock: { $gte: item.quantity },
          },
        },
      },
      {
        $inc: { "products.$.stock": -item.quantity },
        $set: { updatedAt: new Date().toISOString() },
      },
    );
    if (!result.modifiedCount) {
      for (const rollback of decremented)
        await providerCollection.updateOne(
          { id: provider.id, "products.id": rollback.productId },
          { $inc: { "products.$.stock": rollback.quantity } },
        );
      res.status(409).json({
        error: "Stock changed while checking out. Please review your cart.",
      });
      return;
    }
    decremented.push({ productId: item.productId, quantity: item.quantity });
  }
  const order: StoredOrder = {
    id: await nextId("orders"),
    providerId: provider.id,
    providerName: provider.name,
    customerName: customer?.name ?? "Customer",
    customerId: access.userId,
    total,
    status: "PENDING",
    itemCount: parsed.data.items.reduce((sum, item) => sum + item.quantity, 0),
    items: orderItems,
    createdAt: new Date().toISOString(),
    ownerId: access.userId,
  };
  try {
    await orderCollection.insertOne(order);
  } catch (error) {
    for (const rollback of decremented)
      await providerCollection.updateOne(
        { id: provider.id, "products.id": rollback.productId },
        { $inc: { "products.$.stock": rollback.quantity } },
      );
    throw error;
  }
  res.status(201).json(CreateOrderResponse.parse(order));
});

router.get("/dashboard/summary", async (req, res) => {
  const access = await requireCustomer(req, res);
  if (!access) return;
  await initializePetnestData();
  const [
    petCount,
    upcomingBookingCount,
    recordCount,
    nextBooking,
    recentActivity,
  ] = await Promise.all([
    petCollection.countDocuments({ ownerId: access.userId }),
    bookingCollection.countDocuments({
      ownerId: access.userId,
      status: { $nin: ["completed", "cancelled"] },
    }),
    recordCollection.countDocuments({ ownerId: access.userId }),
    bookingCollection.findOne(
      { ownerId: access.userId, status: { $nin: ["completed", "cancelled"] } },
      { sort: { date: 1 }, projection: { _id: 0, ownerId: 0 } },
    ),
    recordCollection
      .find(
        { ownerId: access.userId },
        { projection: { _id: 0, petId: 0, ownerId: 0 } },
      )
      .sort({ date: -1 })
      .limit(3)
      .toArray(),
  ]);
  res.json(
    GetDashboardSummaryResponse.parse({
      petCount,
      upcomingBookingCount,
      recordCount,
      nextBooking,
      recentActivity,
    }),
  );
});

export default router;
