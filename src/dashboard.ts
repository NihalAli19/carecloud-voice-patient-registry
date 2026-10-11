export function dashboardHtml(nonce: string): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="CareCloud voice patient registration operations dashboard">
  <title>CareCloud | Voice Intake Registry</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light;
      --background: #f5f7f8;
      --surface: #ffffff;
      --surface-subtle: #f8fafb;
      --text: #17242d;
      --muted: #63717a;
      --border: #dbe1e4;
      --navy: #173746;
      --teal: #087f72;
      --teal-soft: #e8f5f2;
      --warning-bg: #fff8eb;
      --warning-border: #df9a35;
      --danger: #b4233a;
      --success: #17835f;
      --shadow: 0 8px 28px rgba(23, 36, 45, 0.07);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--background);
      color: var(--text);
      font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    button, input { font: inherit; }
    button:focus-visible, input:focus-visible, a:focus-visible { outline: 3px solid rgba(8, 127, 114, 0.25); outline-offset: 2px; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .shell { min-height: 100vh; }
    .topbar {
      min-height: 68px;
      padding: 0 clamp(20px, 5vw, 64px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      background: var(--navy);
      color: #fff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .brand { display: flex; align-items: center; gap: 12px; color: inherit; font-weight: 700; text-decoration: none; }
    .brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(255, 255, 255, 0.28); border-radius: 8px; font-size: 12px; letter-spacing: 0.03em; }
    .brand-copy small { display: block; color: #bad0d9; font-size: 11px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
    .top-actions { display: flex; align-items: center; gap: 16px; }
    .service-status { display: flex; align-items: center; gap: 8px; color: #d4e2e7; font-size: 12px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #d6a548; }
    .status-dot[data-state="healthy"] { background: #3bc58c; }
    .status-dot[data-state="error"] { background: #f16c7e; }
    .text-button { border: 0; padding: 7px 9px; background: transparent; color: #d4e2e7; cursor: pointer; font: inherit; text-decoration: none; }
    .text-button:hover { color: #fff; }
    main { width: min(1320px, 100%); margin: 0 auto; padding: 38px clamp(20px, 5vw, 64px) 64px; }
    .page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .eyebrow { color: var(--teal); font-size: 11px; font-weight: 800; letter-spacing: 0.11em; text-transform: uppercase; }
    h1 { margin: 5px 0 7px; font-size: clamp(30px, 4vw, 44px); line-height: 1.12; letter-spacing: -0.025em; }
    h2 { margin: 0; font-size: 18px; }
    .sub { max-width: 700px; margin: 0; color: var(--muted); }
    .primary-button { border: 0; border-radius: 8px; padding: 10px 15px; background: var(--teal); color: #fff; font-weight: 700; cursor: pointer; }
    .primary-button:hover { background: #066d62; }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 22px; }
    .metric { padding: 18px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
    .metric span { display: block; margin-bottom: 5px; color: var(--muted); font-size: 12px; font-weight: 650; }
    .metric strong { font-size: 30px; line-height: 1.2; font-variant-numeric: tabular-nums; }
    .panel { margin-bottom: 22px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); }
    .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 17px 19px; border-bottom: 1px solid var(--border); }
    .panel-heading p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }


    .filters { display: flex; gap: 10px; flex-wrap: wrap; padding: 16px 18px; background: var(--surface-subtle); border-bottom: 1px solid var(--border); }
    .field { position: relative; flex: 1; min-width: 180px; }
    .field label { position: absolute; left: 11px; top: 5px; color: var(--muted); font-size: 9px; font-weight: 750; letter-spacing: 0.07em; text-transform: uppercase; }
    .field input { width: 100%; height: 48px; padding: 18px 11px 4px; background: #fff; border: 1px solid var(--border); border-radius: 8px; color: var(--text); }
    .search-button { min-height: 48px; padding: 0 18px; border: 1px solid var(--teal); border-radius: 8px; background: var(--teal); color: #fff; font-weight: 700; cursor: pointer; }
    .table-wrap { min-height: 160px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 11px 17px; background: var(--surface-subtle); border-bottom: 1px solid var(--border); color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; }
    td { padding: 13px 17px; border-bottom: 1px solid #edf0f1; white-space: nowrap; }
    tbody tr:last-child td { border-bottom: 0; }
    tr[data-id] { cursor: pointer; }
    tr[data-id]:hover { background: #f2faf8; }
    .name { font-weight: 740; }
    .muted { color: var(--muted); }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; background: var(--teal-soft); color: #076c62; font-size: 11px; font-weight: 700; }
    .badge-neutral { background: #edf1f3; color: #52616a; }
    .empty { padding: 44px 20px; color: var(--muted); text-align: center; }
    .panel-footer { display: flex; justify-content: space-between; gap: 18px; padding: 12px 18px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }
    .notice { padding: 13px 16px; border: 1px solid #f0d6a8; border-left: 4px solid var(--warning-border); border-radius: 8px; background: var(--warning-bg); color: #62491f; font-size: 12px; }
    .overlay { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 20px; background: rgba(17, 37, 47, 0.72); backdrop-filter: blur(5px); }
    .overlay[hidden], .drawer[hidden], .login[hidden], .auth-loading[hidden], .signup-only[hidden] { display: none; }
    .login { width: min(440px, 100%); padding: 30px; background: #fff; border-radius: 14px; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3); }
    .login h2 { margin: 5px 0 8px; font-size: 26px; }
    .login > p { margin: 0 0 20px; color: var(--muted); }
    .auth-field { margin-top: 13px; }
    .auth-field label { display: block; margin-bottom: 5px; color: #45545d; font-size: 12px; font-weight: 700; }
    .auth-field input { width: 100%; padding: 11px 12px; border: 1px solid var(--border); border-radius: 8px; }
    .login > .primary-button { width: 100%; margin-top: 5px; }
    .auth-switch { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 16px; color: var(--muted); font-size: 12px; }
    .link-button { width: auto; margin: 0; padding: 0; border: 0; background: transparent; color: var(--teal); font: inherit; font-weight: 750; cursor: pointer; }
    .link-button:hover { text-decoration: underline; }
    .back-link { display: block; margin-top: 15px; color: var(--teal); font-size: 12px; font-weight: 700; text-align: center; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    .auth-loading { width: min(360px, 100%); padding: 27px; border-radius: 14px; background: #fff; color: var(--muted); text-align: center; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3); }
    .user-label { color: #bcd0d8; font-size: 12px; }
    .error { min-height: 20px; padding-top: 4px; color: var(--danger); font-size: 12px; }
    .drawer { position: fixed; inset: 0; z-index: 9; display: flex; justify-content: flex-end; background: rgba(17, 37, 47, 0.48); }
    .drawer-card { width: min(560px, 100%); height: 100%; padding: 28px; overflow-y: auto; background: #fff; box-shadow: -18px 0 50px rgba(0, 0, 0, 0.15); }
    .drawer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
    .close { width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 50%; background: #fff; cursor: pointer; font-size: 20px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 22px; }
    .detail { padding-top: 9px; border-top: 1px solid var(--border); }
    .detail small { display: block; color: var(--muted); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }
    .detail strong { display: block; margin-top: 3px; overflow-wrap: anywhere; }
    .section-label { margin-top: 25px; color: var(--teal); font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    @media (max-width: 760px) {
      .page-heading { align-items: stretch; flex-direction: column; }
      .metrics { grid-template-columns: 1fr; }
      .primary-button { width: 100%; }
      .detail-grid { grid-template-columns: 1fr; }
      .topbar { padding: 0 18px; }
      .service-status span:last-child { display: none; }
      .panel-footer { flex-direction: column; }
    }
  </style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Back to assessment overview">
      <span class="brand-mark" aria-hidden="true">CC</span>
      <span class="brand-copy">Voice Intake Registry<small>CareCloud assessment</small></span>
    </a>
    <div class="top-actions">
      <div class="service-status" id="serviceStatus" role="status" aria-live="polite">
        <span class="status-dot" id="statusDot"></span><span id="statusText">Checking service</span>
      </div>
      <span class="user-label" id="userLabel" hidden></span>
      <a class="text-button" href="/">Overview</a>
      <button class="text-button" id="signOut" type="button" hidden>Sign out</button>
    </div>
  </header>

  <main>
    <section class="page-heading">
      <div>
        <div class="eyebrow">Operations dashboard</div>
        <h1>Patient registration operations</h1>
        <p class="sub">Review synthetic patient registrations and recent voice-call outcomes for this assessment environment.</p>
      </div>
      <button class="primary-button" id="refresh" type="button">Refresh data</button>
    </section>

    <section class="metrics" aria-label="Registry metrics">
      <article class="metric"><span>Active patients</span><strong id="patientCount">—</strong></article>
      <article class="metric"><span>Matching results</span><strong id="visibleCount">—</strong></article>
      <article class="metric"><span>Recent call sessions</span><strong id="callCount">—</strong></article>
    </section>

    <section class="panel" aria-labelledby="patientsHeading">
      <header class="panel-heading">
        <div><h2 id="patientsHeading">Patient registry</h2><p>Active records only. Select a row to review full details.</p></div>

      </header>
      <form class="filters" id="filters">
        <div class="field"><label for="lastName">Last name</label><input id="lastName" name="last_name" autocomplete="off"></div>
        <div class="field"><label for="dob">Date of birth</label><input id="dob" name="date_of_birth" placeholder="MM/DD/YYYY" inputmode="numeric" autocomplete="off"></div>
        <div class="field"><label for="phone">Phone</label><input id="phone" name="phone_number" placeholder="(555) 555-0123" inputmode="tel" autocomplete="off"></div>
        <button class="search-button" type="submit">Apply filters</button>
      </form>
      <div class="table-wrap">
        <table>
          <caption class="sr-only">Active patient records</caption>
          <thead><tr><th scope="col">Patient</th><th scope="col">Date of birth</th><th scope="col">Phone</th><th scope="col">Location</th><th scope="col">Language</th><th scope="col">Registered</th></tr></thead>
          <tbody id="patientRows"><tr><td colspan="6" class="empty">Authenticate to load records.</td></tr></tbody>
        </table>
      </div>
      <footer class="panel-footer"><span id="resultCount">—</span><span>Soft-delete enabled · Account session protected</span></footer>
    </section>

    <section class="panel" aria-labelledby="callsHeading">
      <header class="panel-heading"><div><h2 id="callsHeading">Recent call activity</h2><p>Latest persisted call outcomes; transcripts are intentionally not displayed here.</p></div></header>
      <div class="table-wrap">
        <table>
          <caption class="sr-only">Recent voice call sessions</caption>
          <thead><tr><th scope="col">Time</th><th scope="col">Patient</th><th scope="col">Caller</th><th scope="col">Status</th><th scope="col">Ended reason</th></tr></thead>
          <tbody id="callRows"><tr><td colspan="5" class="empty">Authenticate to load call activity.</td></tr></tbody>
        </table>
      </div>
    </section>

    <div class="notice"><strong>Demonstration environment.</strong> Use synthetic data only. This deployment is not approved for real patient information or HIPAA-regulated workloads.</div>
  </main>
</div>

<div class="overlay" id="auth">
  <div class="auth-loading" id="authLoading" role="status">Checking your session…</div>
  <form class="login" id="login" hidden>
    <div class="eyebrow">Secure registry access</div>
    <h2 id="authTitle">Sign in</h2>
    <p id="authDescription">Use your account to review synthetic patient registrations.</p>
    <div class="auth-field signup-only" id="nameField" hidden>
      <label for="displayName">Display name</label>
      <input id="displayName" name="display_name" type="text" autocomplete="name" maxlength="80">
    </div>
    <div class="auth-field">
      <label for="email">Email address</label>
      <input id="email" name="email" type="email" autocomplete="email" maxlength="254" required>
    </div>
    <div class="auth-field">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required>
    </div>
    <div class="auth-field signup-only" id="confirmField" hidden>
      <label for="confirmPassword">Confirm password</label>
      <input id="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128">
    </div>
    <div class="error" id="authError" role="alert"></div>
    <button class="primary-button" id="authSubmit" type="submit">Sign in</button>
    <div class="auth-switch"><span id="authSwitchText">New here?</span><button class="link-button" id="authSwitch" type="button">Create an account</button></div>
    <a class="back-link" href="/">Back to overview</a>
  </form>
</div>

<div class="drawer" id="drawer" hidden>
  <article class="drawer-card" role="dialog" aria-modal="true" aria-labelledby="detailName">
    <div class="drawer-head">
      <div><div class="eyebrow">Patient record</div><h2 id="detailName">Patient</h2></div>
      <button class="close" id="close" type="button" aria-label="Close patient details">×</button>
    </div>
    <div id="details"></div>
  </article>
</div>

<script nonce="${nonce}">
const state = {
  user: null,
  authMode: new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'signin',
  patients: [],
  calls: [],
  total: 0
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '—').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function setServiceState(status, label) {
  $('#statusDot').dataset.state = status;
  $('#statusText').textContent = label;
}

async function checkHealth() {
  try {
    const response = await fetch('/health', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || body.data?.status !== 'ok') throw new Error('unhealthy');
    setServiceState('healthy', 'Service operational');
  } catch {
    setServiceState('error', 'Service unavailable');
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === 'signup';
  $('#authTitle').textContent = signup ? 'Create your account' : 'Sign in';
  $('#authDescription').textContent = signup
    ? 'Create an account to review synthetic registration records.'
    : 'Use your account to review synthetic patient registrations.';
  $('#authSubmit').textContent = signup ? 'Create account' : 'Sign in';
  $('#authSwitchText').textContent = signup ? 'Already have an account?' : 'New here?';
  $('#authSwitch').textContent = signup ? 'Sign in' : 'Create an account';
  document.querySelectorAll('.signup-only').forEach((field) => { field.hidden = !signup; });
  $('#displayName').required = signup;
  $('#confirmPassword').required = signup;
  $('#password').autocomplete = signup ? 'new-password' : 'current-password';
  $('#authError').textContent = '';
}

function showAuth(message = '') {
  $('#auth').hidden = false;
  $('#authLoading').hidden = true;
  $('#login').hidden = false;
  $('#signOut').hidden = true;
  $('#userLabel').hidden = true;
  setAuthMode(state.authMode);
  $('#authError').textContent = message;
  $('#email').focus();
}

async function api(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (response.status === 401) {
    state.user = null;
    throw new Error('unauthorized');
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'Request failed');
  return body.data;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(date);
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10
    ? '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6)
    : value || '—';
}

function renderPatients() {
  const rows = $('#patientRows');
  if (!state.patients.length) {
    rows.innerHTML = '<tr><td colspan="6" class="empty">No active patients match the current filters.</td></tr>';
  } else {
    rows.innerHTML = state.patients.map((patient) =>
      '<tr data-id="' + escapeHtml(patient.patient_id) + '" tabindex="0">' +
        '<td><span class="name">' + escapeHtml(patient.first_name) + ' ' + escapeHtml(patient.last_name) + '</span><br><span class="muted">' + escapeHtml(patient.sex) + '</span></td>' +
        '<td>' + escapeHtml(patient.date_of_birth) + '</td>' +
        '<td>' + escapeHtml(formatPhone(patient.phone_number)) + '</td>' +
        '<td>' + escapeHtml(patient.city) + ', ' + escapeHtml(patient.state) + '</td>' +
        '<td><span class="badge">' + escapeHtml(patient.preferred_language) + '</span></td>' +
        '<td>' + escapeHtml(formatDate(patient.created_at)) + '</td>' +
      '</tr>'
    ).join('');
  }
  $('#patientCount').textContent = state.total;
  $('#visibleCount').textContent = state.patients.length;
  $('#resultCount').textContent = state.total + ' active record' + (state.total === 1 ? '' : 's');
  document.querySelectorAll('tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => showPatient(row.dataset.id));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showPatient(row.dataset.id);
      }
    });
  });
}

function renderCalls() {
  const rows = $('#callRows');
  if (!state.calls.length) {
    rows.innerHTML = '<tr><td colspan="5" class="empty">No call sessions have been recorded.</td></tr>';
  } else {
    rows.innerHTML = state.calls.map((call) => {
      const patientName = call.first_name || call.last_name
        ? escapeHtml((call.first_name || '') + ' ' + (call.last_name || ''))
        : '<span class="muted">Unlinked</span>';
      const statusClass = call.status === 'ended' ? 'badge' : 'badge badge-neutral';
      return '<tr>' +
        '<td>' + escapeHtml(formatDate(call.ended_at || call.created_at)) + '</td>' +
        '<td>' + patientName + '</td>' +
        '<td>' + escapeHtml(formatPhone(call.caller_number)) + '</td>' +
        '<td><span class="' + statusClass + '">' + escapeHtml(call.status) + '</span></td>' +
        '<td>' + escapeHtml(call.ended_reason) + '</td>' +
      '</tr>';
    }).join('');
  }
  $('#callCount').textContent = state.calls.length;
}

async function loadData() {
  const query = new URLSearchParams(new FormData($('#filters')));
  for (const [key, value] of [...query]) if (!value) query.delete(key);
  query.set('limit', '100');
  try {
    const [patients, calls] = await Promise.all([
      api('/patients?' + query),
      api('/calls?limit=25')
    ]);
    state.patients = patients.items;
    state.total = patients.pagination.total;
    state.calls = calls.items;
    $('#auth').hidden = true;
    $('#signOut').hidden = false;
    $('#userLabel').hidden = false;
    $('#authError').textContent = '';
    renderPatients();
    renderCalls();
  } catch (error) {
    if (error.message === 'unauthorized') {
      showAuth('Your session expired. Sign in again.');
      return;
    }
    $('#patientRows').innerHTML = '<tr><td colspan="6" class="empty">Unable to load records: ' + escapeHtml(error.message) + '</td></tr>';
    $('#callRows').innerHTML = '<tr><td colspan="5" class="empty">Unable to load call activity.</td></tr>';
  }
}

function showPatient(id) {
  const patient = state.patients.find((entry) => entry.patient_id === id);
  if (!patient) return;
  $('#detailName').textContent = patient.first_name + ' ' + patient.last_name;
  const labels = {
    patient_id: 'Patient ID', date_of_birth: 'Date of birth', sex: 'Sex', phone_number: 'Phone',
    email: 'Email', address_line_1: 'Address', address_line_2: 'Address line 2', city: 'City',
    state: 'State', zip_code: 'ZIP code', insurance_provider: 'Insurance provider',
    insurance_member_id: 'Member ID', preferred_language: 'Preferred language',
    emergency_contact_name: 'Emergency contact', emergency_contact_phone: 'Emergency phone',
    created_at: 'Created', updated_at: 'Updated'
  };
  $('#details').innerHTML = '<div class="section-label">Demographics and contact</div><div class="detail-grid">' +
    Object.entries(labels).map(([key, label]) => {
      const value = key.includes('phone')
        ? formatPhone(patient[key])
        : key.endsWith('_at') ? formatDate(patient[key]) : patient[key];
      return '<div class="detail"><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(value) + '</strong></div>';
    }).join('') + '</div>';
  $('#drawer').hidden = false;
  $('#close').focus();
}

function closeDrawer() {
  $('#drawer').hidden = true;
}

async function signOut() {
  try { await fetch('/auth/signout', { method: 'POST' }); } finally { window.location.assign('/'); }
}

async function initializeSession() {
  try {
    const response = await fetch('/auth/me', { cache: 'no-store' });
    if (!response.ok) throw new Error('anonymous');
    const body = await response.json();
    state.user = body.data;
    $('#userLabel').textContent = state.user.display_name;
    $('#userLabel').hidden = false;
    $('#auth').hidden = true;
    $('#signOut').hidden = false;
    await loadData();
  } catch {
    showAuth();
  }
}

$('#login').addEventListener('submit', async (event) => {
  event.preventDefault();
  const signup = state.authMode === 'signup';
  if (signup && $('#password').value !== $('#confirmPassword').value) {
    $('#authError').textContent = 'Passwords do not match.';
    return;
  }
  const submit = $('#authSubmit');
  submit.disabled = true;
  $('#authError').textContent = '';
  try {
    const payload = { email: $('#email').value, password: $('#password').value };
    if (signup) payload.display_name = $('#displayName').value;
    const response = await fetch(signup ? '/auth/signup' : '/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || 'Unable to continue.');
    state.user = body.data;
    $('#userLabel').textContent = state.user.display_name;
    $('#password').value = '';
    $('#confirmPassword').value = '';
    await loadData();
  } catch (error) {
    $('#authError').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
$('#authSwitch').addEventListener('click', () => setAuthMode(state.authMode === 'signin' ? 'signup' : 'signin'));
$('#filters').addEventListener('submit', (event) => { event.preventDefault(); loadData(); });
$('#refresh').addEventListener('click', () => { checkHealth(); if (state.user) loadData(); });
$('#signOut').addEventListener('click', signOut);
$('#close').addEventListener('click', closeDrawer);
$('#drawer').addEventListener('click', (event) => { if (event.target.id === 'drawer') closeDrawer(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

checkHealth();
initializeSession();
</script>
</body>
</html>`;
}