import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DmChat from "@/components/DmChat";
export const dynamic = "force-dynamic";

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
    select: { id: true, gamertag: true, nametagColor: true, srLevel: true },
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
            sender: {
              select: { gamertag: true, nametagColor: true, srLevel: true },
            },
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
            sender: {
              select: { gamertag: true, nametagColor: true, srLevel: true },
            },
          },
        },
      },
    }));

  const initialMessages = conversation.messages.map((message) => ({
    id: message.id,
    conversationId: conversation.id,
    senderUserId: message.senderUserId,
    senderGamertag: message.sender.gamertag,
    senderNametagColor: message.sender.nametagColor,
    senderSrLevel: message.sender.srLevel ?? 1,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <DmChat
        targetUserId={target.id}
        conversationId={conversation.id}
        viewerId={user.id}
        viewerGamertag={user.gamertag}
        viewerSrLevel={user.srLevel ?? 1}
        initialMessages={initialMessages}
        targetGamertag={target.gamertag}
        targetNametagColor={target.nametagColor}
        targetSrLevel={target.srLevel ?? 1}
      />
    </div>
  );
}
