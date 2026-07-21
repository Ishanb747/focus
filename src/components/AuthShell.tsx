import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "./AuthForm";

export function AuthShell({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Link href="/" className="brand brand-light"><span className="brand-mark"><i/><i/><i/></span><span>stockroom</span></Link>
        <div className="auth-art-copy"><p className="eyebrow light"><span /> STOCK CONTROL THAT CLICKS</p><blockquote>“Inventory should tell you what needs attention—not demand all of yours.”</blockquote><div className="mini-stock-card"><div><span className="preview-icon danger">!</span><div><small>LOW STOCK</small><b>Canvas utility tote</b></div></div><strong>4 <small>/ 12</small></strong><i><span style={{width:"33%"}} /></i></div></div>
        <p className="auth-footer">Simple. Secure. Ready for work.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-box"><p className="auth-kicker">{isLogin ? "WELCOME BACK" : "GET STARTED"}</p><h1>{isLogin ? "Sign in to your stockroom" : "Create your stockroom"}</h1><p>{isLogin ? "Pick up where you left off and keep your shelves in check." : "Set up a secure workspace and bring your inventory into focus."}</p><Suspense fallback={<div className="auth-form-placeholder" aria-label="Loading form" />}><AuthForm mode={mode} /></Suspense><div className="secure-note"><span>⌾</span>Your password is encrypted and never returned.</div></div>
      </section>
    </main>
  );
}
