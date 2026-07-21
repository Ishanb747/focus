"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { firstValidationError, loginSchema, registerSchema } from "@/lib/validation";

interface AuthFormProps { mode: "login" | "register" }

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isLogin = mode === "login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const values = {
      ...(isLogin ? {} : { name: String(form.get("name") ?? "") }),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const result = (isLogin ? loginSchema : registerSchema).safeParse(values);
    if (!result.success) { setError(firstValidationError(result.error)); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Something went wrong");
      const nextPath = searchParams.get("next");
      router.push(nextPath?.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {!isLogin && <label><span>Your name</span><input name="name" autoComplete="name" placeholder="Alex Morgan" disabled={loading} /></label>}
      <label><span>Email address</span><input name="email" type="email" autoComplete="email" placeholder="you@company.com" disabled={loading} /></label>
      <label><span>Password</span><div className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} placeholder={isLogin ? "Your password" : "8+ characters, with a number"} disabled={loading} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>
      {error && <div className="form-error" role="alert"><span>!</span>{error}</div>}
      <button className="button button-primary auth-submit" disabled={loading}>{loading ? <><span className="spinner" />{isLogin ? "Signing in…" : "Creating account…"}</> : <>{isLogin ? "Sign in" : "Create account"}<span>→</span></>}</button>
      <p className="auth-switch">{isLogin ? "New to Stockroom?" : "Already have an account?"} <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "Create an account" : "Sign in"}</Link></p>
    </form>
  );
}
