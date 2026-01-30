import { prisma } from "./db";
import { Prisma, XpEventType } from "@prisma/client";

export function xpRequired(level: number) {
  return Math.floor(150 + 25 * level + 10 * level * level);
}

export function computeLevelFromXp(xpTotal: number) {
  let level = 1;
  let remaining = Math.max(0, xpTotal);

  while (level < 100) {
    const requirement = xpRequired(level);
    if (remaining < requirement) {
      break;
    }
    remaining -= requirement;
    level += 1;
  }

  return { srLevel: level, xpThisLevel: remaining };
}

export async function addXp(
  userId: string,
  amount: number,
  type: XpEventType,
  meta?: Prisma.InputJsonValue
) {
  if (!amount) return null;
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { xpTotal: true },
    });
    if (!user) return null;
    const nextXpTotal = Math.max(0, user.xpTotal + amount);
    const { srLevel, xpThisLevel } = computeLevelFromXp(nextXpTotal);

    await tx.user.update({
      where: { id: userId },
      data: {
        xpTotal: nextXpTotal,
        srLevel,
        xpThisLevel,
        lastXpAt: new Date(),
      },
    });

    await tx.xpEvent.create({
      data: {
        userId,
        type,
        amount,
        meta: meta ?? undefined,
      },
    });

    return { xpTotal: nextXpTotal, srLevel, xpThisLevel };
  });
}

export async function hasXpEvent(
  userId: string,
  type: XpEventType,
  meta?: Prisma.InputJsonValue
) {
  const event = await prisma.xpEvent.findFirst({
    where: {
      userId,
      type,
      ...(meta !== undefined ? { meta: { equals: meta } } : {}),
    },
    select: { id: true },
  });
  return Boolean(event);
}

export async function countXpEvents(
  userId: string,
  type: XpEventType,
  since: Date
) {
  return prisma.xpEvent.count({
    where: {
      userId,
      type,
      createdAt: { gte: since },
    },
  });
}
