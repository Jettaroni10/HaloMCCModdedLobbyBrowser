import { prisma } from "./db";

export async function isRateLimited(userId: string, key: string, max: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitEvent.count({
    where: {
      userId,
      key,
      createdAt: { gt: since },
    },
  });
  return count >= max;
}

export async function recordRateLimitEvent(userId: string, key: string) {
  await prisma.rateLimitEvent.create({
    data: { userId, key },
  });
}
