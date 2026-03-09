"use client";

import { useState } from "react";

interface Props {
  roomId: string;
}

export default function InviteButton({ roomId }: Props) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleInvite() {
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/invite`, { method: "POST" });
      const data = await res.json();
      if (!data.token) return;

      const inviteUrl = `${window.location.origin}/invite/${data.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleInvite}
      disabled={loading}
      className="rounded-md border border-zinc-700 hover:border-zinc-500 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
    >
      {copied ? (
        <>
          <span className="text-green-400">✓</span> Copied!
        </>
      ) : (
        <>
          <span>🔗</span> Invite
        </>
      )}
    </button>
  );
}
