import { createHmac, randomBytes } from "node:crypto";
import type { Db } from "mongodb";
import type { Request, Response, Router } from "express";

export const normalizeSecurityAnswer = (answer: string) => answer.trim().normalize("NFKC").toLocaleLowerCase("en-US");
export const validSecurityAnswer = (answer: unknown): answer is string => typeof answer === "string" && normalizeSecurityAnswer(answer).length > 0 && answer.length <= 200;
const hour = 3600000;
type RecoveryUser = { id: string; email: string; role: string; passwordHash?: string; securityAnswerHash?: string; passwordChangedAt?: string; isActive?: boolean; removedAt?: string };
type Gate = { _id: string; failures: number; windowUntil: Date; lockedUntil: Date; busyUntil: Date; lease?: string };
type Helpers = { hashPassword: (value: string) => Promise<string>; verifyPassword: (value: string, hash: string) => Promise<boolean>; secret: string };

export function registerPasswordRecovery(router: Router, db: Db,
  access: (req: Request, res: Response) => Promise<{ userId: string; role: string } | null>, helpers: Helpers) {
  const users = db.collection<RecoveryUser>("users"), sessions = db.collection("sessions");
  const gates = db.collection<Gate>("passwordRecoveryLimits");
  const digest = (value: string) => createHmac("sha256", helpers.secret).update(value).digest("hex");
  const dummyHash = helpers.hashPassword(randomBytes(32).toString("hex"));
  const active = { isActive: { $ne: false }, removedAt: { $exists: false }, role: { $in: ["customer", "provider"] } };
  async function ipAllowed(req: Request) {
    const limits = db.collection<{ _id: string; count: number }>("passwordRecoveryIpLimits");
    const key = digest(`ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}:${Math.floor(Date.now() / hour)}`);
    const row = await limits.findOneAndUpdate({ _id: key }, { $inc: { count: 1 } }, { upsert: true, returnDocument: "after" });
    return Boolean(row && row.count <= 30);
  }
  async function claim(email: string) {
    const now = new Date(), key = digest(`recovery:${email}`);
    try { await gates.updateOne({ _id: key }, { $setOnInsert: { failures: 0, windowUntil: new Date(Date.now() + hour), lockedUntil: new Date(0), busyUntil: new Date(0) } }, { upsert: true }); } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) return null;
      throw error;
    }
    await gates.updateOne({ _id: key, windowUntil: { $lte: now }, lockedUntil: { $lte: now }, busyUntil: { $lte: now } }, { $set: { failures: 0, windowUntil: new Date(Date.now() + hour) } });
    return gates.findOneAndUpdate({ _id: key, lockedUntil: { $lte: now }, busyUntil: { $lte: now } }, { $set: { busyUntil: new Date(Date.now() + 60000), lease: randomBytes(16).toString("hex") } }, { returnDocument: "after" });
  }
  async function failed(gate: Gate) {
    const failures = gate.failures + 1;
    await gates.updateOne({ _id: gate._id, lease: gate.lease }, { $set: { failures, ...(failures >= 5 ? { lockedUntil: new Date(Date.now() + hour), windowUntil: new Date(Date.now() + hour) } : {}) } });
  }
  const failure = (res: Response) => res.status(400).json({ error: "Recovery could not be verified. Check your details or try again after the recovery lock expires." });

  router.post("/auth/password-recovery/reset", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.newPassword;
    if (!(await ipAllowed(req)) || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== "string" || password.length < 8 || password.length > 1024) { failure(res); return; }
    const gate = await claim(email);
    if (!gate) { failure(res); return; }
    try {
      const user = await users.findOne({ email, ...active });
      const answer = validSecurityAnswer(req.body?.answer) ? normalizeSecurityAnswer(req.body.answer) : "";
      const correct = await helpers.verifyPassword(answer, user?.securityAnswerHash ?? await dummyHash);
      // Unenrolled accounts cannot use this recovery method. Never invent a default answer.
      if (!user?.passwordHash || !user.securityAnswerHash || !correct) {
        await failed(gate); failure(res); return;
      }
      const passwordHash = await helpers.hashPassword(password);
      const saved = await users.updateOne({ id: user.id, passwordHash: user.passwordHash, securityAnswerHash: user.securityAnswerHash, ...active },
        { $set: { passwordHash, passwordChangedAt: new Date().toISOString() } });
      if (!saved.modifiedCount) { failure(res); return; }
      await sessions.deleteMany({ userId: user.id });
      await gates.updateOne({ _id: gate._id, lease: gate.lease }, { $set: { failures: 0, windowUntil: new Date(Date.now() + hour) } });
      res.json({ message: "Password reset successfully. You can now log in." });
    } finally { await gates.updateOne({ _id: gate._id, lease: gate.lease }, { $set: { busyUntil: new Date(0) } }); }
  });

  router.post("/auth/security-question", async (req, res) => {
    const session = await access(req, res);
    if (!session) return;
    if (!["customer", "provider"].includes(session.role) || !validSecurityAnswer(req.body?.answer) || typeof req.body?.currentPassword !== "string" || req.body.currentPassword.length > 1024 || !(await ipAllowed(req))) { failure(res); return; }
    const user = await users.findOne({ id: session.userId, ...active });
    if (!user?.passwordHash || !(await helpers.verifyPassword(req.body.currentPassword, user.passwordHash))) { failure(res); return; }
    const result = await users.updateOne({ id: user.id, passwordHash: user.passwordHash }, { $set: { securityAnswerHash: await helpers.hashPassword(normalizeSecurityAnswer(req.body.answer)) } });
    if (!result.matchedCount) { failure(res); return; }
    res.json({ saved: true });
  });
}
