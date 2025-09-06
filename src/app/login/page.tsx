"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/FirebaseClientProvider";
import { toast } from "sonner";

export default function LoginPage() {
  const { signIn, signUp, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), password);
        toast.success("Account created and signed in");
      } else {
        await signIn(email.trim(), password);
        toast.success("Signed in");
      }
      router.push("/today");
    } catch (err: unknown) {
      let msg = "Sign-in failed";
      if (err && typeof err === 'object') {
        const e = err as { code?: string; message?: unknown };
        msg = e.code || (typeof e.message === 'string' ? e.message : msg) || msg;
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-4">
      <h1 className="text-xl font-semibold mb-3">{mode === "signin" ? "Sign In" : "Create Account"}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded-md px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded-md px-2 py-1.5"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting || loading}
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? (mode === "signin" ? "Signing in…" : "Creating…") : (mode === "signin" ? "Sign In" : "Sign Up")}
          </button>
        </div>
      </form>
      <div className="mt-4 text-sm text-black/70 dark:text-white/70">
        {mode === "signin" ? (
          <button
            type="button"
            onClick={() => setMode("signup")}
            className="underline hover:no-underline"
          >
            Don’t have an account? Create one
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="underline hover:no-underline"
          >
            Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
}
