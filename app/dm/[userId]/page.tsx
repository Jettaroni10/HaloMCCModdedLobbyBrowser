import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DmChat from "@/components/DmChat";

function normalizePair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

export default async function DmPage({
  params,
}: {
  params: { userId: string };
}) {
  const user = await requireAuth();
  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, displayName: true, nametagColor: true },
  });
  if (!target) {
    notFound();
  }

  const [userAId, userBId] = normalizePair(user.id, target.id);
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });
  if (!friendship) {
    redirect("/friends");
  }

  const conversation =
    (await prisma.conversation.findFirst({
      where: {
        type: "DM",
        participants: { some: { userId: user.id } },
        AND: { participants: { some: { userId: target.id } } },
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 50,
          include: {
            sender: { select: { displayName: true, nametagColor: true } },
          },
        },
      },
    })) ??
    (await prisma.conversation.create({
      data: {
        type: "DM",
        participants: {
          create: [{ userId: user.id }, { userId: target.id }],
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 50,
          include: {
            sender: { select: { displayName: true, nametagColor: true } },
          },
        },
      },
    }));

  const initialMessages = conversation.messages.map((message) => ({
    id: message.id,
    senderUserId: message.senderUserId,
    senderDisplayName: message.sender.displayName,
    senderNametagColor: message.sender.nametagColor,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <DmChat
        targetUserId={target.id}
        viewerId={user.id}
        initialMessages={initialMessages}
        targetDisplayName={target.displayName}
        targetNametagColor={target.nametagColor}
      />
    </div>
  );
}
