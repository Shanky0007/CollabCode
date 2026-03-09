"use client";

import { useOthers, useSelf } from "@/lib/liveblocks";

export default function AvatarStack() {
  const others = useOthers();
  // useSelf is imported directly from @liveblocks/react because we use
  // the global createRoomContext — hooks are available from the context lib.
  const self = useSelf();

  // Show at most 4 avatars + overflow count
  const allUsers = [
    ...(self ? [{ id: self.id, info: self.info }] : []),
    ...others.map((o) => ({ id: o.connectionId.toString(), info: o.info })),
  ];

  const visible = allUsers.slice(0, 4);
  const overflow = allUsers.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((u, i) => (
        <div
          key={u.id}
          title={u.info?.name ?? "Anonymous"}
          style={{ zIndex: visible.length - i }}
          className="relative h-8 w-8 rounded-full border-2 border-zinc-950 overflow-hidden"
        >
          {u.info?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.info.avatar}
              alt={u.info.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: u.info?.color ?? "#7c3aed" }}
            >
              {(u.info?.name ?? "?")[0].toUpperCase()}
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="relative h-8 w-8 rounded-full border-2 border-zinc-950 bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 z-0">
          +{overflow}
        </div>
      )}
      {allUsers.length === 0 && (
        <span className="text-xs text-zinc-600">Only you</span>
      )}
    </div>
  );
}
