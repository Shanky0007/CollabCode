import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

interface ClerkUser {
  id: string;
  email_addresses: { email_address: string; id: string }[];
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: { type: string; data: ClerkUser };
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const user = event.data;
    const primaryEmail = user.email_addresses[0]?.email_address ?? "";

    const supabase = createAdminClient();
    await supabase.from("users").upsert({
      id: user.id,
      email: primaryEmail,
      username: user.username ?? (`${user.first_name ?? ""}${user.last_name ?? ""}`.trim() || null),
      avatar_url: user.image_url,
    }, { onConflict: "id" });
  }

  return NextResponse.json({ received: true });
}
