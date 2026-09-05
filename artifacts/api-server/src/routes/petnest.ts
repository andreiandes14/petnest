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
  createdAt?: string;
  updatedAt?: string;
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

const seedProviders: Provider[] = [
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
        name: "Salmon & Oat Bites",
        description: "Small-batch training treats for sensitive tummies.",
        price: 320,
        imageUrl: "",
        category: "pet food",
        inStock: true,
      },
      {
        id: 1002,
        name: "Everyday Paw Balm",
        description: "Soothing balm for city walks and dry paw pads.",
        price: 280,
        imageUrl: "",
        category: "pet care",
        inStock: true,
      },
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
        name: "Daily Wellness Kibble",
        description: "Balanced everyday nutrition for adult dogs.",
        price: 1480,
        imageUrl: "",
        category: "pet food",
        inStock: true,
      },
      {
        id: 2002,
        name: "Cozy Cloud Bed",
        description: "Machine-washable comfort for deep afternoon naps.",
        price: 1290,
        imageUrl: "",
        category: "pet supplies",
        inStock: true,
      },
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
        name: "Tuna Toppers",
        description: "A savory boost for picky eaters.",
        price: 190,
        imageUrl: "",
        category: "pet food",
        inStock: true,
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
    total: 600,
    status: "Ready for delivery",
    itemCount: 2,
    createdAt: "2026-08-28",
  },
];

type OwnedPet = Pet & {
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
};
type StoredCareRecord = CareRecord & { petId: number; ownerId: string };
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

const router: IRouter = Router();

async function register(req: Request, res: Response) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const role: Role =
    req.body?.role === "provider" || req.body?.role === "admin"
      ? req.body.role
      : "customer";

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
  let pendingProviderId: number | undefined;
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
    if (role === "provider") {
      const providerId = await nextId("providers");
      pendingProviderId = providerId;
      const createdAt = new Date().toISOString();
      const provider: Provider = {
        id: providerId,
        name,
        location: "Location not added",
        description: "New PetNest provider",
        categories: ["grooming", "vaccination"],
        rating: 0,
        reviewCount: 0,
        startingPrice: 500,
        imageUrl: "",
        verified: false,
        contact: "Contact not added",
        hours: "Hours not added",
        services: [
          {
            id: providerId * 1000 + 1,
            name: "Bath",
            description: "A gentle bath and dry.",
            price: 500,
            durationMinutes: 45,
            category: "grooming",
            available: true,
            createdAt,
            updatedAt: createdAt,
          },
          {
            id: providerId * 1000 + 2,
            name: "Anti-rabies",
            description: "A basic anti-rabies vaccination visit.",
            price: 750,
            durationMinutes: 30,
            category: "vaccination",
            available: true,
            createdAt,
            updatedAt: createdAt,
          },
        ],
        products: [],
        createdAt,
        updatedAt: createdAt,
      };
      await providerCollection.insertOne(provider);
      user.providerId = providerId;
    }
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
      pendingProviderId
        ? providerCollection.deleteOne({ id: pendingProviderId })
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
  if (category) filter.categories = category;
  if (search) {
    filter.$or = ["name", "location", "description"].map((field) => ({
      [field]: {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      },
    }));
  }
  const providers = await providerCollection
    .find(filter, { projection: { _id: 0 } })
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
  await initializePetnestData();
  const provider = await providerCollection.findOne(
    { id: parsed.data.providerId },
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
  const providers = await providerCollection
    .find(providerId === undefined ? {} : { id: providerId }, {
      projection: { _id: 0, id: 1, name: 1, services: 1 },
    })
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
    imageUrl: existing.imageUrl,
    verified: existing.verified,
    services: providerInput.services.map((service) => ({
      ...service,
      available: service.available ?? true,
      updatedAt: new Date().toISOString(),
    })),
    products: providerInput.products.map((product) => ({
      ...product,
      imageUrl:
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
  const [petRecords, vaccinationBookings] = await Promise.all([
    recordCollection
      .find(
        { petId: parsed.data.petId, ownerId: access.userId, type: "grooming" },
        { projection: { _id: 0, petId: 0, ownerId: 0 } },
      )
      .sort({ date: -1 })
      .toArray(),
    bookingCollection
      .find(
        {
          petId: parsed.data.petId,
          ownerId: access.userId,
          serviceCategory: "vaccination",
        },
        { projection: { _id: 0, ownerId: 0 } },
      )
      .sort({ date: -1 })
      .toArray(),
  ]);
  res.json(
    GetPetRecordsResponse.parse({
      grooming: petRecords.filter((record) => record.type === "grooming"),
      vaccinations: vaccinationBookings.map((booking) => ({
        id: booking.id,
        type: "vaccination" as const,
        title: booking.serviceName,
        providerName: booking.providerName,
        date: booking.date,
        status: booking.status,
        notes: `Scheduled at ${booking.time}`,
      })),
    }),
  );
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
  await initializePetnestData();
  const provider = await providerCollection.findOne({
    id: parsed.data.providerId,
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
  if (parsed.data.recordId !== null) {
    const record = await recordCollection.findOne({
      id: parsed.data.recordId,
      petId: pet.id,
      ownerId: access.userId,
      type: service.category,
    });
    if (!record) {
      res
        .status(400)
        .json({
          error: "Choose a record that belongs to this pet and service.",
        });
      return;
    }
  }
  const conflict = await bookingCollection.findOne({
    providerId: provider.id,
    date: parsed.data.date,
    time: parsed.data.time,
    status: { $nin: ["cancelled"] },
  });
  if (conflict) {
    res
      .status(409)
      .json({
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
  const bookingId = Number(req.params.bookingId);
  const booking = await bookingCollection.findOneAndUpdate(
    {
      id: bookingId,
      ownerId: access.userId,
      status: { $nin: ["completed", "cancelled"] },
    },
    { $set: { status: "cancelled", updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0, ownerId: 0 } },
  );
  if (!booking) {
    res.status(404).json({ error: "Active booking not found" });
    return;
  }
  res.json(booking);
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
  const allowedStatuses = ["pending", "confirmed", "cancelled", "completed"];
  if (
    !Number.isInteger(bookingId) ||
    bookingId <= 0 ||
    !allowedStatuses.includes(status)
  ) {
    res.status(400).json({ error: "A valid booking and status are required" });
    return;
  }
  const booking = await bookingCollection.findOneAndUpdate(
    { id: bookingId, providerId: access.providerId },
    { $set: { status, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
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
  const bookingId = Number(req.params.bookingId);
  const allowedStatuses = ["pending", "confirmed", "completed", "cancelled"];
  const status =
    typeof req.body?.status === "string" ? req.body.status.toLowerCase() : "";
  if (
    !Number.isInteger(bookingId) ||
    bookingId <= 0 ||
    !allowedStatuses.includes(status)
  ) {
    res.status(400).json({ error: "A valid booking and status are required" });
    return;
  }
  await initializePetnestData();
  const booking = await bookingCollection.findOneAndUpdate(
    { id: bookingId },
    { $set: { status, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const { ownerId, ...publicBooking } = booking;
  res.json({ ...publicBooking, customerId: ownerId });
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
  });
  if (!provider) {
    res.status(400).json({ error: "Choose a valid provider." });
    return;
  }
  const total = parsed.data.items.reduce((sum, item) => {
    const product = provider.products.find(
      (candidate) => candidate.id === item.productId,
    );
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const order: StoredOrder = {
    id: await nextId("orders"),
    providerId: provider.id,
    providerName: provider.name,
    total,
    status: "Order received",
    itemCount: parsed.data.items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: new Date().toISOString().slice(0, 10),
    ownerId: access.userId,
  };
  await orderCollection.insertOne(order);
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
