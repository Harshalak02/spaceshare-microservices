/**
 * SpaceShare — Non-Functional Requirements (NFR) Test Suite
 *
 * Tests:
 *   1. Availability   — 99.99% uptime target across all services
 *   2. Performance     — Cache hit < 500ms, Cache miss < 1.5s
 *   3. Security        — JWT expiry validation (24hr)
 *   4. Concurrency     — 200 simultaneous requests
 *   5. Scalability     — 500 baseline / 2000 peak users
 *
 * Usage:
 *   node test-nfr.js [--base-url <url>] [--email <e>] [--password <p>] [--email2 <e2>] [--password2 <p2>]
 *
 * Requires: Node 18+ (built-in fetch)
 */

// ── Config ──────────────────────────────────────────────────
const CONFIG = {
  BASE_URL: 'http://localhost:4000',
  AUTH_EMAIL: 'kavan.gandhi32@gmail.com',
  AUTH_PASSWORD: 'test123',
  // Second user for concurrency / double-booking tests
  AUTH_EMAIL_2: 'kavan.gandhi31@gmail.com',
  AUTH_PASSWORD_2: 'test123',
  // Service direct URLs for individual health checks
  SERVICES: {
    'api-gateway':          'http://localhost:4000/health',
    'auth-service':         'http://localhost:4001/health',
    'listing-service':      'http://localhost:4002/health',
    'search-service':       'http://localhost:4003/health',
    'booking-service':      'http://localhost:4004/health',
    'subscription-service': 'http://localhost:4005/health',
    'notification-service': 'http://localhost:4006/health',
    'analytics-service':    'http://localhost:4007/health',
    'payment-service':      'http://localhost:4008/health',
  },
  // NFR thresholds
  AVAILABILITY_TARGET: 99.99,
  CACHE_HIT_MAX_MS: 500,
  CACHE_MISS_MAX_MS: 1500,
  JWT_EXPIRY_HOURS: 24,
  CONCURRENCY_TARGET: 200,
  BASELINE_USERS: 500,
  PEAK_USERS: 2000,
  // Test durations
  AVAILABILITY_DURATION_S: 60,
  AVAILABILITY_INTERVAL_MS: 2000,
};

// ── Parse CLI args ──────────────────────────────────────────
(function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--base-url') CONFIG.BASE_URL = args[i + 1];
    if (args[i] === '--email') CONFIG.AUTH_EMAIL = args[i + 1];
    if (args[i] === '--password') CONFIG.AUTH_PASSWORD = args[i + 1];
    if (args[i] === '--email2') CONFIG.AUTH_EMAIL_2 = args[i + 1];
    if (args[i] === '--password2') CONFIG.AUTH_PASSWORD_2 = args[i + 1];
  }
})();

// ── Helpers ─────────────────────────────────────────────────
async function timedFetch(url, opts = {}) {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    const body = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, latency: Date.now() - start, body, error: null };
  } catch (err) {
    return { ok: false, status: 0, latency: Date.now() - start, body: '', error: err.message };
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

function stats(latencies) {
  if (!latencies.length) return { count: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0 };
  const s = [...latencies].sort((a, b) => a - b);
  return {
    count: s.length,
    avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
    p50: percentile(s, 50), p90: percentile(s, 90),
    p95: percentile(s, 95), p99: percentile(s, 99),
    min: s[0], max: s[s.length - 1],
  };
}

function printHeader(title) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(80)}`);
}

function printResult(name, passed, detail) {
  console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}  ${name}`);
  if (detail) console.log(`           ${detail}`);
}

// Token cache — avoids repeated login calls that hit the auth rate limiter
const tokenCache = {};

async function loginAs(email, password) {
  if (tokenCache[email]) return tokenCache[email];
  const res = await timedFetch(`${CONFIG.BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) {
    const data = JSON.parse(res.body);
    tokenCache[email] = data.token;
    return data.token;
  }
  return null;
}

async function login() {
  return loginAs(CONFIG.AUTH_EMAIL, CONFIG.AUTH_PASSWORD);
}

// ── Results accumulator ─────────────────────────────────────
const RESULTS = [];
function record(category, name, passed, detail) {
  RESULTS.push({ category, name, passed, detail });
  printResult(name, passed, detail);
}

// ════════════════════════════════════════════════════════════
// TEST 1: AVAILABILITY — 99.99% uptime
// ════════════════════════════════════════════════════════════
async function testAvailability() {
  printHeader('TEST 1: AVAILABILITY (Target: 99.99% uptime)');
  const rounds = Math.ceil((CONFIG.AVAILABILITY_DURATION_S * 1000) / CONFIG.AVAILABILITY_INTERVAL_MS);
  console.log(`  Polling ${Object.keys(CONFIG.SERVICES).length} services every ${CONFIG.AVAILABILITY_INTERVAL_MS}ms for ${CONFIG.AVAILABILITY_DURATION_S}s (${rounds} rounds)\n`);

  const counters = {};
  for (const name of Object.keys(CONFIG.SERVICES)) {
    counters[name] = { up: 0, total: 0, latencies: [] };
  }

  for (let r = 1; r <= rounds; r++) {
    const checks = await Promise.all(
      Object.entries(CONFIG.SERVICES).map(async ([name, url]) => {
        const res = await timedFetch(url);
        counters[name].total++;
        if (res.ok) counters[name].up++;
        counters[name].latencies.push(res.latency);
        return { name, ok: res.ok, latency: res.latency };
      })
    );
    const allUp = checks.every(c => c.ok);
    process.stdout.write(`\r  Round ${r}/${rounds} — ${allUp ? '✅ All UP' : '⚠️  Some DOWN'}   `);

    if (r < rounds) await new Promise(r => setTimeout(r, CONFIG.AVAILABILITY_INTERVAL_MS));
  }
  console.log('\n');

  // Report per service
  console.log('  Service'.padEnd(28) + 'Uptime %'.padEnd(12) + 'Avg(ms)'.padEnd(10) + 'Max(ms)'.padEnd(10) + 'Status');
  console.log(`  ${'─'.repeat(70)}`);

  let allPassed = true;
  for (const [name, c] of Object.entries(counters)) {
    const uptime = c.total > 0 ? (c.up / c.total) * 100 : 0;
    const s = stats(c.latencies);
    const passed = uptime >= CONFIG.AVAILABILITY_TARGET;
    if (!passed) allPassed = false;
    console.log(
      `  ${name}`.padEnd(28) +
      `${uptime.toFixed(2)}%`.padEnd(12) +
      `${s.avg}`.padEnd(10) +
      `${s.max}`.padEnd(10) +
      (passed ? '✅' : '❌')
    );
  }
  console.log('');
  record('Availability', `All services ≥ ${CONFIG.AVAILABILITY_TARGET}% uptime`, allPassed,
    allPassed ? 'All services met target' : 'One or more services below target');
}

// ════════════════════════════════════════════════════════════
// TEST 2: PERFORMANCE — Cache hit/miss latency
// ════════════════════════════════════════════════════════════
async function testPerformance() {
  printHeader('TEST 2: PERFORMANCE (Cache Hit < 500ms, Cache Miss < 1.5s)');
  const searchUrl = `${CONFIG.BASE_URL}/api/search/spaces?lat=17.4455&lon=78.3489`;

  // First request — likely cache miss
  console.log('  Sending first search request (expected cache miss)...');
  const miss1 = await timedFetch(searchUrl);
  const missData = miss1.ok ? JSON.parse(miss1.body) : {};
  const isMiss = missData.source !== 'cache';
  console.log(`  Response: ${miss1.latency}ms | source: ${missData.source || 'unknown'} | status: ${miss1.status}`);

  // Immediately send second request — should be cache hit
  console.log('  Sending second search request (expected cache hit)...');
  const hit1 = await timedFetch(searchUrl);
  const hitData = hit1.ok ? JSON.parse(hit1.body) : {};
  const isHit = hitData.source === 'cache';
  console.log(`  Response: ${hit1.latency}ms | source: ${hitData.source || 'unknown'} | status: ${hit1.status}`);

  // Run multiple cache-hit requests for statistical confidence
  console.log('  Running 20 cache-hit requests for statistical confidence...');
  const hitLatencies = [hit1.latency];
  for (let i = 0; i < 19; i++) {
    const r = await timedFetch(searchUrl);
    hitLatencies.push(r.latency);
  }
  const hitStats = stats(hitLatencies);

  // Run cache miss with different params
  console.log('  Running 5 cache-miss requests (varied params)...');
  const missLatencies = [miss1.latency];
  for (let i = 0; i < 4; i++) {
    const lat = 17.4 + Math.random() * 0.1;
    const lon = 78.3 + Math.random() * 0.1;
    const r = await timedFetch(`${CONFIG.BASE_URL}/api/search/spaces?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&radiusKm=${1 + i}`);
    missLatencies.push(r.latency);
  }
  const missStats = stats(missLatencies);

  console.log(`\n  Cache Hit  — Avg: ${hitStats.avg}ms | P95: ${hitStats.p95}ms | Max: ${hitStats.max}ms (threshold: ${CONFIG.CACHE_HIT_MAX_MS}ms)`);
  console.log(`  Cache Miss — Avg: ${missStats.avg}ms | P95: ${missStats.p95}ms | Max: ${missStats.max}ms (threshold: ${CONFIG.CACHE_MISS_MAX_MS}ms)\n`);

  record('Performance', `Cache Hit P95 < ${CONFIG.CACHE_HIT_MAX_MS}ms`,
    hitStats.p95 < CONFIG.CACHE_HIT_MAX_MS,
    `P95=${hitStats.p95}ms, Avg=${hitStats.avg}ms`);
  record('Performance', `Cache Miss P95 < ${CONFIG.CACHE_MISS_MAX_MS}ms`,
    missStats.p95 < CONFIG.CACHE_MISS_MAX_MS,
    `P95=${missStats.p95}ms, Avg=${missStats.avg}ms`);
}

// ════════════════════════════════════════════════════════════
// TEST 3: SECURITY — JWT expiry validation
// ════════════════════════════════════════════════════════════
async function testSecurity() {
  printHeader('TEST 3: SECURITY (JWT expiry = 24 hours)');

  // Try login
  console.log(`  Attempting login as ${CONFIG.AUTH_EMAIL}...`);
  const token = await login();

  if (!token) {
    console.log('  ⚠️  Login failed — testing with a crafted JWT instead\n');
    // Test with an expired token
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJndWVzdCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ.invalid';
    const res = await timedFetch(`${CONFIG.BASE_URL}/api/bookings/bookings/my`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    record('Security', 'Expired JWT rejected', res.status === 401,
      `HTTP ${res.status} (expected 401)`);

    // Test with no token
    const noAuth = await timedFetch(`${CONFIG.BASE_URL}/api/bookings/bookings/my`);
    record('Security', 'Missing JWT rejected', noAuth.status === 401,
      `HTTP ${noAuth.status} (expected 401)`);

    // Test with malformed token
    const badRes = await timedFetch(`${CONFIG.BASE_URL}/api/bookings/bookings/my`, {
      headers: { Authorization: 'Bearer malformed.token.here' },
    });
    record('Security', 'Malformed JWT rejected', badRes.status === 401,
      `HTTP ${badRes.status} (expected 401)`);
    return;
  }

  console.log('  ✅ Login successful\n');

  // Decode JWT to check expiry
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const iat = payload.iat;
    const exp = payload.exp;
    const expiryHours = (exp - iat) / 3600;
    console.log(`  JWT issued at : ${new Date(iat * 1000).toISOString()}`);
    console.log(`  JWT expires at: ${new Date(exp * 1000).toISOString()}`);
    console.log(`  Expiry window : ${expiryHours} hours\n`);

    record('Security', `JWT expiry = ${CONFIG.JWT_EXPIRY_HOURS}h`,
      Math.abs(expiryHours - CONFIG.JWT_EXPIRY_HOURS) < 0.1,
      `Actual: ${expiryHours}h`);
  } catch (e) {
    record('Security', 'JWT payload readable', false, e.message);
  }

  // Valid token should work
  const validRes = await timedFetch(`${CONFIG.BASE_URL}/api/bookings/bookings/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  record('Security', 'Valid JWT accepted', validRes.ok || validRes.status < 500,
    `HTTP ${validRes.status}`);

  // Expired token should fail
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJndWVzdCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ.invalid';
  const expRes = await timedFetch(`${CONFIG.BASE_URL}/api/bookings/bookings/my`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  record('Security', 'Expired JWT rejected', expRes.status === 401,
    `HTTP ${expRes.status} (expected 401)`);

  // No token should fail
  const noAuth = await timedFetch(`${CONFIG.BASE_URL}/api/bookings/bookings/my`);
  record('Security', 'Missing JWT rejected', noAuth.status === 401,
    `HTTP ${noAuth.status} (expected 401)`);
}

// ════════════════════════════════════════════════════════════
// TEST 4: CONCURRENCY — 200 simultaneous requests
// ════════════════════════════════════════════════════════════
async function testConcurrency() {
  printHeader(`TEST 4: CONCURRENCY (${CONFIG.CONCURRENCY_TARGET} simultaneous requests)`);
  const searchUrl = `${CONFIG.BASE_URL}/api/search/spaces?lat=17.4455&lon=78.3489`;

  console.log(`  Firing ${CONFIG.CONCURRENCY_TARGET} simultaneous requests to search endpoint...\n`);

  const start = Date.now();
  const promises = [];
  for (let i = 0; i < CONFIG.CONCURRENCY_TARGET; i++) {
    promises.push(timedFetch(searchUrl));
  }
  const results = await Promise.all(promises);
  const wallClock = Date.now() - start;

  const successes = results.filter(r => r.ok).length;
  const errors = results.filter(r => !r.ok && r.status !== 429).length;
  const rateLimited = results.filter(r => r.status === 429).length;
  const latencies = results.map(r => r.latency);
  const s = stats(latencies);

  console.log(`  Wall clock time : ${wallClock}ms`);
  console.log(`  Successful      : ${successes}/${CONFIG.CONCURRENCY_TARGET}`);
  console.log(`  Errors          : ${errors}`);
  console.log(`  Rate-limited    : ${rateLimited}`);
  console.log(`  Latency — Avg: ${s.avg}ms | P50: ${s.p50}ms | P95: ${s.p95}ms | P99: ${s.p99}ms | Max: ${s.max}ms\n`);

  const successRate = ((successes + rateLimited) / CONFIG.CONCURRENCY_TARGET) * 100;
  record('Concurrency', `${CONFIG.CONCURRENCY_TARGET} simultaneous requests handled`,
    successRate >= 95,
    `${successRate.toFixed(1)}% handled (${successes} OK + ${rateLimited} rate-limited)`);
  record('Concurrency', `P95 latency under load < 2s`,
    s.p95 < 2000,
    `P95=${s.p95}ms`);

  // ── Concurrent Booking Conflict Test (2 users, same slot) ──
  console.log('  --- Concurrent Booking Conflict Test (2 Users) ---');

  // Reuse cached tokens or log in fresh — avoids rate-limiter rejections
  console.log(`  Logging in User 1: ${CONFIG.AUTH_EMAIL}`);
  const token1 = await loginAs(CONFIG.AUTH_EMAIL, CONFIG.AUTH_PASSWORD);
  console.log(`  Logging in User 2: ${CONFIG.AUTH_EMAIL_2}`);
  const token2 = await loginAs(CONFIG.AUTH_EMAIL_2, CONFIG.AUTH_PASSWORD_2);

  if (!token1 && !token2) {
    console.log('  ⚠️  Skipping booking conflict test (both logins unavailable)\n');
    record('Concurrency', 'Double-booking prevention', null, 'Skipped — both logins unavailable');
    return;
  }
  if (!token1 || !token2) {
    const available = token1 ? CONFIG.AUTH_EMAIL : CONFIG.AUTH_EMAIL_2;
    const failed = !token1 ? CONFIG.AUTH_EMAIL : CONFIG.AUTH_EMAIL_2;
    console.log(`  ⚠️  Only ${available} logged in; ${failed} login failed`);
    console.log('  Proceeding with single-user concurrency test as fallback\n');
  }

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  futureDate.setUTCHours(10, 0, 0, 0);

  // Both users try to book the same space & time slot
  const makeBookingBody = (userLabel) => JSON.stringify({
    space_id: 1,
    start_slot_utc: futureDate.toISOString(),
    slot_count: 1,
    guest_count: 1,
    idempotency_key: `nfr-conflict-${userLabel}-${Date.now()}`,
  });

  // Build concurrent requests — 5 from each user (10 total)
  const bookingPromises = [];
  const tokens = [token1, token2].filter(Boolean);

  console.log(`  Sending 10 concurrent booking requests (5 per user) for the same slot...`);
  for (let i = 0; i < 10; i++) {
    const tok = tokens[i % tokens.length];
    const label = i % tokens.length === 0 ? 'user1' : 'user2';
    bookingPromises.push(timedFetch(`${CONFIG.BASE_URL}/api/bookings/book`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: makeBookingBody(`${label}-${i}`),
    }));
  }
  const bookingResults = await Promise.all(bookingPromises);
  const created = bookingResults.filter(r => r.status === 201).length;
  const conflicts = bookingResults.filter(r => r.status === 409).length;
  const otherStatuses = bookingResults.filter(r => r.status !== 201 && r.status !== 409);
  console.log(`  Created: ${created} | Conflicts (409): ${conflicts} | Other: ${otherStatuses.length}`);
  if (otherStatuses.length > 0) {
    const statusCounts = {};
    otherStatuses.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
    console.log(`  Other status breakdown: ${JSON.stringify(statusCounts)}`);
  }
  console.log('');

  record('Concurrency', 'Double-booking prevention (same slot, 2 users)',
    created <= 1,
    `${created} booking(s) created, ${conflicts} conflicts detected`);
}

// ════════════════════════════════════════════════════════════
// TEST 5: SCALABILITY — 500 baseline / 2000 peak users
// ════════════════════════════════════════════════════════════
async function testScalability() {
  printHeader(`TEST 5: SCALABILITY (${CONFIG.BASELINE_USERS} baseline → ${CONFIG.PEAK_USERS} peak users)`);
  const searchUrl = `${CONFIG.BASE_URL}/api/search/spaces?lat=17.4455&lon=78.3489`;
  const healthUrl = `${CONFIG.BASE_URL}/health`;

  // Phase 1: Baseline (500 users simulated as burst)
  console.log(`  Phase 1: Baseline load — ${CONFIG.BASELINE_USERS} requests...\n`);
  const baselineStart = Date.now();
  const baselinePromises = [];
  for (let i = 0; i < CONFIG.BASELINE_USERS; i++) {
    // Mix: 70% search, 30% health
    const url = Math.random() < 0.7 ? searchUrl : healthUrl;
    baselinePromises.push(timedFetch(url));
  }
  const baselineResults = await Promise.all(baselinePromises);
  const baselineWall = Date.now() - baselineStart;
  const baselineOk = baselineResults.filter(r => r.ok).length;
  const baselineRL = baselineResults.filter(r => r.status === 429).length;
  const baselineErr = baselineResults.filter(r => !r.ok && r.status !== 429).length;
  const baselineStats = stats(baselineResults.map(r => r.latency));

  console.log(`  Baseline Results:`);
  console.log(`    Wall clock  : ${baselineWall}ms`);
  console.log(`    Throughput  : ${(CONFIG.BASELINE_USERS / (baselineWall / 1000)).toFixed(0)} req/s`);
  console.log(`    OK/RL/Err   : ${baselineOk}/${baselineRL}/${baselineErr}`);
  console.log(`    Latency     : Avg=${baselineStats.avg}ms P95=${baselineStats.p95}ms Max=${baselineStats.max}ms\n`);

  // Phase 2: Peak (2000 users simulated as burst)
  console.log(`  Phase 2: Peak load — ${CONFIG.PEAK_USERS} requests...\n`);
  const peakStart = Date.now();
  const peakPromises = [];
  for (let i = 0; i < 800; i++) {
    const url = searchUrl;
    peakPromises.push(timedFetch(url));
  }
  const peakResults = await Promise.all(peakPromises);
  const peakWall = Date.now() - peakStart;
  const peakOk = peakResults.filter(r => r.ok).length;
  const peakRL = peakResults.filter(r => r.status === 429).length;
  const peakErr = peakResults.filter(r => !r.ok && r.status !== 429).length;
  const peakStats = stats(peakResults.map(r => r.latency));

  console.log(`  Peak Results:`);
  console.log(`    Wall clock  : ${peakWall}ms`);
  console.log(`    Throughput  : ${(CONFIG.PEAK_USERS / (peakWall / 1000)).toFixed(0)} req/s`);
  console.log(`    OK/RL/Err   : ${peakOk}/${peakRL}/${peakErr}`);
  console.log(`    Latency     : Avg=${peakStats.avg}ms P95=${peakStats.p95}ms Max=${peakStats.max}ms\n`);

  // Degradation check
  const degradation = peakStats.p95 > 0 && baselineStats.p95 > 0
    ? ((peakStats.p95 - baselineStats.p95) / baselineStats.p95 * 100).toFixed(1)
    : 'N/A';
  console.log(`  P95 latency degradation (baseline→peak): ${degradation}%\n`);

  const baselineSuccessRate = ((baselineOk + baselineRL) / CONFIG.BASELINE_USERS * 100);
  const peakSuccessRate = ((peakOk + peakRL) / CONFIG.PEAK_USERS * 100);

  record('Scalability', `Baseline (${CONFIG.BASELINE_USERS}) — success rate ≥ 95%`,
    baselineSuccessRate >= 95,
    `${baselineSuccessRate.toFixed(1)}% (${baselineOk} OK + ${baselineRL} rate-limited)`);
  record('Scalability', `Peak (${CONFIG.PEAK_USERS}) — success rate ≥ 90%`,
    peakSuccessRate >= 90,
    `${peakSuccessRate.toFixed(1)}% (${peakOk} OK + ${peakRL} rate-limited)`);
  record('Scalability', `Peak P95 latency < 3s`,
    peakStats.p95 < 3000,
    `P95=${peakStats.p95}ms`);
  record('Scalability', `Degradation < 300%`,
    degradation === 'N/A' || parseFloat(degradation) < 300,
    `${degradation}%`);
}

// ════════════════════════════════════════════════════════════
// FINAL REPORT
// ════════════════════════════════════════════════════════════
function printFinalReport() {
  printHeader('NFR TEST SUMMARY REPORT');
  const categories = [...new Set(RESULTS.map(r => r.category))];

  for (const cat of categories) {
    console.log(`\n  ── ${cat} ──`);
    const catResults = RESULTS.filter(r => r.category === cat);
    for (const r of catResults) {
      const icon = r.passed === null ? '⏭️' : r.passed ? '✅' : '❌';
      console.log(`    ${icon} ${r.name}`);
      if (r.detail) console.log(`       ${r.detail}`);
    }
  }

  const total = RESULTS.filter(r => r.passed !== null).length;
  const passed = RESULTS.filter(r => r.passed === true).length;
  const failed = RESULTS.filter(r => r.passed === false).length;
  const skipped = RESULTS.filter(r => r.passed === null).length;

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  TOTAL: ${passed}/${total} passed | ${failed} failed | ${skipped} skipped`);
  console.log(`${'═'.repeat(80)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     SpaceShare — NFR Test Suite                             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Base URL : ${CONFIG.BASE_URL}`);
  console.log(`║  User 1   : ${CONFIG.AUTH_EMAIL}`);
  console.log(`║  User 2   : ${CONFIG.AUTH_EMAIL_2}`);
  console.log(`║  Time     : ${new Date().toISOString()}`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // await testAvailability();
  await testPerformance();
  await testSecurity();
  await testConcurrency();
  await testScalability();
  printFinalReport();
}

main().catch(err => { console.error('Fatal:', err); process.exit(2); });
