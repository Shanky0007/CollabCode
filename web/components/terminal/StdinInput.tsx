"use client";

import { useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export default function StdinInput({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>stdin</span>
        {value.trim() && (
          <span className="ml-auto text-violet-400">
            {value.trim().split("\n").length} line{value.trim().split("\n").length !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {open && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Optional input for your program (stdin)…"
          spellCheck={false}
          rows={4}
          className="w-full resize-none bg-zinc-950 border-t border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-600 disabled:opacity-50"
        />
      )}
    </div>
  );
}
