import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import type { User } from "@prisma/client";

export type SessionUser = Pick<
  User,
  | "id"
  | "email"
  | "gamertag"
  | "needsGamertag"
  | "nametagColor"
  | "reputationScore"
  | "srLevel"
  | "xpTotal"
  | "xpThisLevel"
  | "isBanned"
>;

const SESSION_COOKIE = "mcc_session";
const SESSION_DAYS = 14;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev-auth-secret";
  }
  return "";
}

function signToken(payload: string) {
  const secret = getAuthSecret();
  if (!secret) {
    return "";
  }
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function createSessionToken(userId: string) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${expiresAt}`;
  const signature = signToken(payload);
  if (!signature) {
    return null;
  }
  return { token: `${payload}.${signature}`, expiresAt };
}

export function parseSessionToken(token: string | null) {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [userId, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!userId || !Number.isFinite(expiresAt)) {
    return null;
  }
  if (Date.now() > expiresAt) {
    return null;
  }
  const payload = `${userId}.${expiresAt}`;
  const expected = signToken(payload);
  if (!expected || !safeEqual(signature, expected)) {
    return null;
  }
  return { userId, expiresAt };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const devUserId = process.env.DEV_USER_ID;
  if (devUserId) {
    return prisma.user.findUnique({
      where: { id: devUserId },
      select: {
        id: true,
        email: true,
        gamertag: true,
        needsGamertag: true,
        nametagColor: true,
        reputationScore: true,
        srLevel: true,
        xpTotal: true,
        xpThisLevel: true,
        isBanned: true,
      },
    });
  }

  const cookieValue = cookies().get(SESSION_COOKIE)?.value ?? null;
  const parsed = parseSessionToken(cookieValue);
  if (!parsed) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: parsed.userId },
    select: {
      id: true,
      email: true,
      gamertag: true,
      needsGamertag: true,
      nametagColor: true,
      reputationScore: true,
      srLevel: true,
      xpTotal: true,
      xpThisLevel: true,
      isBanned: true,
    },
  });
}

export async function requireAuth(options?: { requireGamertag?: boolean }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const requireGamertag = options?.requireGamertag ?? true;
  if (requireGamertag && (!user.gamertag || user.needsGamertag)) {
    redirect("/settings/profile?needsGamertag=1");
  }
  return user;
}

export function isAdminUser(user: SessionUser | null) {
  if (!user || !user.email) {
    return false;
  }
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(user.email.toLowerCase());
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!isAdminUser(user)) {
    redirect("/browse");
  }
  return user;
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
