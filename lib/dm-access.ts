import { prisma } from "@/lib/prisma";

export async function ensureDmChatAccess(
  conversationId: string,
  userId: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, type: true },
  });
  if (!conversation || conversation.type !== "DM") {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  return { ok: true as const, conversation };
}
