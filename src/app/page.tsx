import Link from "next/link";
import { getSession } from "@/lib/auth";

function Mark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

export default async function Home() {
  const session = await getSession();
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Link href="/" className="brand"><Mark /><span>stockroom</span></Link>
        <div className="nav-actions">
          {session ? (
            <Link className="button button-primary" href="/dashboard">Open dashboard <span>→</span></Link>
          ) : (
            <><Link className="text-link" href="/login">Sign in</Link><Link className="button button-primary" href="/register">Start managing <span>→</span></Link></>
          )}
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Warehouse control, simplified</p>
          <h1>Know what you have.<br /><em>Before you need it.</em></h1>
          <p className="hero-lede">A calm, reliable inventory workspace for teams that need the right stock in the right place—without wrestling with spreadsheets.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href={session ? "/dashboard" : "/register"}>{session ? "Open dashboard" : "Create your stockroom"} <span>→</span></Link>
            {!session && <Link className="button button-ghost button-large" href="/login">I already have an account</Link>}
          </div>
          <div className="hero-proof"><span className="proof-dots"><i /><i /><i /></span><span>Built for small, focused teams</span><b>•</b><span>Secure by default</span></div>
        </div>

        <div className="hero-visual" aria-label="Preview of the inventory dashboard">
          <div className="warehouse-grid" />
          <div className="preview-card">
            <div className="preview-head"><div><small>TOTAL UNITS</small><strong>8,492</strong></div><span className="trend">↗ 12.4%</span></div>
            <div className="bar-chart" aria-hidden="true"><i style={{height:"35%"}}/><i style={{height:"51%"}}/><i style={{height:"44%"}}/><i style={{height:"68%"}}/><i style={{height:"60%"}}/><i style={{height:"84%"}}/><i style={{height:"74%"}}/><i style={{height:"96%"}}/></div>
            <div className="preview-row"><span className="preview-icon danger">!</span><div><b>Low stock alert</b><small>3 products need attention</small></div><span>Review →</span></div>
            <div className="preview-row"><span className="preview-icon">✓</span><div><b>Operations healthy</b><small>92% of products in range</small></div><span className="status-dot" /></div>
          </div>
          <div className="floating-tag"><span>✓</span><div><small>JUST UPDATED</small><b>Inventory synced</b></div></div>
        </div>
      </section>

      <section className="feature-strip">
        <article><span>01</span><div><h2>See clearly</h2><p>One view for every SKU, count, and category.</p></div></article>
        <article><span>02</span><div><h2>Act early</h2><p>Low-stock signals surface before shelves run empty.</p></div></article>
        <article><span>03</span><div><h2>Stay focused</h2><p>Fast updates with no unnecessary complexity.</p></div></article>
      </section>
    </main>
  );
}
