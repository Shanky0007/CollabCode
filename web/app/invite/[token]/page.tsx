"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"joining" | "error">("joining");
  const [message, setMessage] = useState("Joining room…");

  useEffect(() => {
    params.then(async ({ token }) => {
      try {
        const res = await fetch(`/api/invite/${token}`, { method: "POST" });
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setMessage(data.error ?? "Invalid invite link.");
          return;
        }

        // Success — redirect straight into the room
        router.replace(`/room/${data.roomId}`);
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        {status === "joining" ? (
          <>
            <div className="h-10 w-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-zinc-400 text-sm">{message}</p>
          </>
        ) : (
          <>
            <p className="text-red-400 mb-4">{message}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-violet-400 hover:underline"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
