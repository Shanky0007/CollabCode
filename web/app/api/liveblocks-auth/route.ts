import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

// Assign a consistent color per user for cursors
const CURSOR_COLORS = [
  "#7c3aed", "#0891b2", "#059669", "#dc2626",
  "#d97706", "#db2777", "#4f46e5", "#0d9488",
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const { room } = await req.json();

  const session = liveblocks.prepareSession(userId, {
    userInfo: {
      name: user?.fullName ?? user?.firstName ?? "Anonymous",
      avatar: user?.imageUrl ?? "",
      color: getUserColor(userId),
    },
  });

  // Grant full access to the requested room
  session.allow(room, session.FULL_ACCESS);

  const { body, status } = await session.authorize();
  return new NextResponse(body, { status });
}
