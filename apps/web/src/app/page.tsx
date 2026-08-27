import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 0',
        }}
        className="container"
      >
        <div style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1.2rem' }}>
          Worksyzo
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link className="btn btn-ghost" href="/login">
            Sign in
          </Link>
          <Link className="btn btn-primary" href="/register">
            Start free trial
          </Link>
        </div>
      </header>

      <section className="container" style={{ padding: '4rem 0 3rem' }}>
        <div className="badge">Private AI · Multi-tenant · Built for Indian SMEs</div>
        <h1
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            maxWidth: '14ch',
            margin: '1rem 0 1.2rem',
          }}
        >
          Your organization&apos;s private AI employee.
        </h1>
        <p className="muted" style={{ maxWidth: '52ch', fontSize: '1.1rem', lineHeight: 1.55 }}>
          Not another PDF chatbot. Worksyzo learns your documents, decisions, meetings and tasks —
          then answers and acts within your permissions. Built for companies that cannot afford
          enterprise search platforms.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.6rem', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/register">
            Create your organization
          </Link>
          <Link className="btn btn-ghost" href="/login">
            Use demo accounts
          </Link>
        </div>
      </section>

      <section className="container" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', paddingBottom: '4rem' }}>
        {[
          ['Knowledge', 'Upload policies, SOPs, handbooks. Ask with citations.'],
          ['Memory', 'Decisions and meetings become searchable org memory.'],
          ['Work', 'Tasks and projects the AI can read — and create when allowed.'],
          ['Trust', 'Hard multi-tenant isolation. Roles the AI must respect.'],
        ].map(([title, body]) => (
          <div key={title} className="card" style={{ padding: '1.2rem 1.25rem' }}>
            <h3 style={{ margin: '0 0 0.45rem', fontSize: '1.05rem' }}>{title}</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5, fontSize: '0.95rem' }}>
              {body}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
