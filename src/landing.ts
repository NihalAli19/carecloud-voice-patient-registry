export function landingHtml(nonce: string): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Evaluate the CareCloud voice patient registration assessment from call to persisted record.">
  <title>CareCloud | Voice Patient Registration</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light;
      --navy: #102f3d;
      --navy-soft: #173f50;
      --teal: #087f72;
      --teal-dark: #066b61;
      --teal-soft: #e8f5f2;
      --ink: #17242d;
      --muted: #617078;
      --line: #dbe2e5;
      --surface: #ffffff;
      --background: #f4f7f7;
      --warning: #fff7e7;
      --warning-line: #d9952d;
      --shadow: 0 18px 55px rgba(16, 47, 61, 0.10);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--background);
      color: var(--ink);
      font: 15px/1.6 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: inherit; }
    a:focus-visible, button:focus-visible { outline: 3px solid rgba(8, 127, 114, 0.28); outline-offset: 3px; }
    .wrap { width: min(1160px, calc(100% - 40px)); margin: 0 auto; }
    .topbar { background: var(--navy); color: #fff; }
    .nav { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; font-weight: 760; }
    .brand-mark { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.3); border-radius: 9px; font-size: 12px; letter-spacing: .04em; }
    .brand-copy small { display: block; color: #bcd0d8; font-size: 10px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; }
    .nav-links { display: flex; align-items: center; gap: 22px; }
    .nav-links a { color: #dce8ec; font-size: 13px; font-weight: 650; text-decoration: none; }
    .nav-links a:hover { color: #fff; }
    .hero { padding: clamp(58px, 8vw, 100px) 0 58px; background: linear-gradient(155deg, #fff 0%, #f4f7f7 55%, #e9f4f1 100%); border-bottom: 1px solid var(--line); }
    .hero-grid { display: block; }
    .eyebrow { display: inline-flex; align-items: center; gap: 9px; color: var(--teal-dark); font-size: 11px; font-weight: 820; letter-spacing: .11em; text-transform: uppercase; }
    .eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 0 5px rgba(8,127,114,.11); }
    h1 { max-width: 760px; margin: 15px 0 19px; font-size: clamp(42px, 6.3vw, 72px); line-height: 1.01; letter-spacing: -.045em; }
    .lead { max-width: 675px; margin: 0; color: var(--muted); font-size: clamp(17px, 2vw, 20px); line-height: 1.65; }
    .actions { display: flex; flex-wrap: wrap; gap: 11px; margin: 30px 0 19px; }
    .button { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; padding: 0 18px; border: 1px solid var(--teal); border-radius: 8px; font-size: 14px; font-weight: 760; text-decoration: none; }
    .button-primary { background: var(--teal); color: #fff; box-shadow: 0 8px 24px rgba(8,127,114,.18); }
    .button-primary:hover { background: var(--teal-dark); }
    .button-secondary { background: #fff; color: var(--teal-dark); }
    .button-secondary:hover { background: var(--teal-soft); }
    .privacy-note { max-width: 690px; margin: 0; color: #6f5425; font-size: 12px; }

    section.content { padding: 72px 0; }
    .section-head { max-width: 690px; margin-bottom: 31px; }
    .section-head h2 { margin: 8px 0 9px; font-size: clamp(28px, 4vw, 42px); line-height: 1.15; letter-spacing: -.025em; }
    .section-head p { margin: 0; color: var(--muted); }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .step { min-height: 235px; padding: 25px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
    .step-number { width: 32px; height: 32px; display: grid; place-items: center; margin-bottom: 43px; border-radius: 50%; background: var(--teal-soft); color: var(--teal-dark); font-size: 12px; font-weight: 830; }
    .step h3 { margin: 0 0 7px; font-size: 18px; }
    .step p { margin: 0; color: var(--muted); font-size: 13px; }
    .proof { padding: 0 0 80px; }
    .proof-grid { display: grid; grid-template-columns: .82fr 1.18fr; gap: 18px; }
    .profile, .criteria { padding: 28px; background: var(--surface); border: 1px solid var(--line); border-radius: 15px; }
    .card-label { margin-bottom: 5px; color: var(--teal); font-size: 10px; font-weight: 820; letter-spacing: .11em; text-transform: uppercase; }
    .profile h2, .criteria h2 { margin: 0 0 8px; font-size: 23px; }
    .profile > p, .criteria > p { margin: 0 0 21px; color: var(--muted); font-size: 13px; }
    .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
    .datum { padding: 12px 0; border-top: 1px solid var(--line); }
    .datum small { display: block; color: var(--muted); font-size: 9px; font-weight: 720; letter-spacing: .08em; text-transform: uppercase; }
    .datum strong { display: block; margin-top: 2px; font-size: 13px; }
    .criteria-list { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
    .criterion { padding: 15px; background: #f8fafb; border: 1px solid #e4e9eb; border-radius: 10px; }
    .criterion strong { display: block; margin-bottom: 3px; font-size: 13px; }
    .criterion span { color: var(--muted); font-size: 12px; }
    .warning { margin-top: 18px; padding: 14px 16px; border: 1px solid #efd6a6; border-left: 4px solid var(--warning-line); border-radius: 9px; background: var(--warning); color: #634c26; font-size: 12px; }
    footer { padding: 25px 0; background: var(--navy); color: #bfd0d7; font-size: 12px; }
    .footer-row { display: flex; justify-content: space-between; gap: 20px; }
    footer a { color: #fff; font-weight: 650; text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    @media (max-width: 820px) {
      .hero-grid, .proof-grid { grid-template-columns: 1fr; }
      .steps { grid-template-columns: 1fr; }
      .step { min-height: 0; }
      .step-number { margin-bottom: 23px; }
    }
    @media (max-width: 560px) {
      .wrap { width: min(100% - 28px, 1160px); }

      .hero { padding-top: 49px; }
      h1 { font-size: 43px; }
      .actions { flex-direction: column; }
      .button { width: 100%; }
      .profile-grid, .criteria-list { grid-template-columns: 1fr; }
      .footer-row { flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  </style>
</head>
<body>
  <header class="topbar">
    <nav class="nav wrap" aria-label="Primary navigation">
      <a class="brand" href="/" aria-label="CareCloud voice intake overview">
        <span class="brand-mark" aria-hidden="true">CC</span>
        <span class="brand-copy">Voice Intake<small>Technical assessment</small></span>
      </a>
      <div class="nav-links"><a href="/dashboard">Sign in</a></div>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-grid wrap">
        <div>
          <span class="eyebrow">Live assessment environment</span>
          <h1>Test the complete voice registration journey.</h1>
          <p class="lead">Call the AI intake agent, complete a synthetic patient registration, then verify the persisted record and call outcome in the secured reviewer dashboard.</p>
          <div class="actions">
            <a class="button button-primary" href="tel:+18646255246">Call +1 (864) 625-5246</a>
            <a class="button button-secondary" href="/dashboard?mode=signup">Create account</a>
          </div>
          <p class="privacy-note"><strong>Synthetic data only.</strong> This assessment is not HIPAA compliant. Do not provide real patient or health information. Carrier charges may apply.</p>
        </div>

      </div>
    </section>

    <section class="content wrap" aria-labelledby="journeyHeading">
      <div class="section-head">
        <span class="eyebrow">Reviewer journey</span>
        <h2 id="journeyHeading">From conversation to verified record in three steps.</h2>
        <p>The journey is intentionally short enough to evaluate in one sitting, while exposing the full telephony, LLM, API, and database integration.</p>
      </div>
      <div class="steps">
        <article class="step"><div class="step-number">01</div><h3>Call the intake agent</h3><p>Use the U.S. number above. Speak naturally, answer out of order, make a correction, or switch between English and Spanish.</p></article>
        <article class="step"><div class="step-number">02</div><h3>Review and confirm</h3><p>The agent validates each field, reads the complete profile back, and must receive explicit confirmation before saving anything.</p></article>
        <article class="step"><div class="step-number">03</div><h3>Verify the result</h3><p>Sign in or create an account, then confirm the patient record and completed call outcome in the secured dashboard.</p></article>
      </div>
    </section>

    <section class="proof wrap">
      <div class="proof-grid">
        <article class="profile">
          <div class="card-label">Suggested test profile</div>
          <h2>Use predictable synthetic data</h2>
          <p>This profile exercises all required fields without using real personal information.</p>
          <div class="profile-grid">
            <div class="datum"><small>Name</small><strong>Alex Morgan</strong></div>
            <div class="datum"><small>Date of birth</small><strong>04/15/1988</strong></div>
            <div class="datum"><small>Phone</small><strong>202-555-0147</strong></div>
            <div class="datum"><small>Sex</small><strong>Decline to answer</strong></div>
            <div class="datum"><small>Address</small><strong>100 Test Avenue</strong></div>
            <div class="datum"><small>Location</small><strong>Washington, DC 20001</strong></div>
          </div>
          <div class="warning">For a duplicate test, call again with the same phone number and date of birth. The agent should offer an update rather than create another active patient.</div>
        </article>

        <article class="criteria">
          <div class="card-label">What to evaluate</div>
          <h2>Observable behavior, not a scripted demo</h2>
          <p>The key behaviors are visible during the call and verifiable afterward.</p>
          <div class="criteria-list">
            <div class="criterion"><strong>Natural recovery</strong><span>Interruptions, corrections, and bundled answers are handled without restarting.</span></div>
            <div class="criterion"><strong>Server validation</strong><span>Invalid dates, phone numbers, ZIP codes, and unknown fields are rejected.</span></div>
            <div class="criterion"><strong>Confirmed writes</strong><span>No patient is created or updated until the complete readback is approved.</span></div>
            <div class="criterion"><strong>Duplicate safety</strong><span>Phone lookup plus DOB verification protects the update path.</span></div>
            <div class="criterion"><strong>Persistent evidence</strong><span>Patient and call-session records are available in the reviewer dashboard.</span></div>
            <div class="criterion"><strong>Secure boundaries</strong><span>Application and webhook access use separate secrets with a synthetic-data policy.</span></div>
          </div>
        </article>
      </div>
    </section>
  </main>

  <footer><div class="footer-row wrap"><span>CareCloud AI Engineer technical assessment</span><span><a href="/dashboard">Sign in to dashboard</a></span></div></footer>

</body>
</html>`;
}
