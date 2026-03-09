import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Real-time collaboration
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-zinc-100 mb-4">
          Code together,{" "}
          <span className="text-violet-400">ship faster.</span>
        </h1>

        <p className="text-zinc-400 text-lg mb-10">
          A collaborative code editor with live execution. Write, run, and debug
          code in real time with your team — no setup required.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-lg bg-violet-600 hover:bg-violet-500 px-6 py-3 font-semibold text-white transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-zinc-700 hover:border-zinc-500 px-6 py-3 font-semibold text-zinc-300 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}