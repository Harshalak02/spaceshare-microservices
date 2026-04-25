/**
 * SpaceShare Microservices — Performance & Load Test Script
 *
 * Simulates concurrent users hitting key API endpoints to measure:
 *   - Throughput (requests/sec)
 *   - Latency percentiles (p50, p90, p95, p99)
 *   - Error rate
 *   - Rate-limiter behavior
 *
 * Usage:
 *   node test-performance.js [--concurrency <N>] [--duration <seconds>] [--base-url <url>]
 *
 * Examples:
 *   node test-performance.js --concurrency 10 --duration 30
 *   node test-performance.js --concurrency 50 --duration 60
 */

const DEFAULTS = {
  BASE_URL: 'http://localhost:4000',
  CONCURRENCY: 10,
  DURATION_SECONDS: 30,
  AUTH_EMAIL: 'kavan.gandhi32@gmail.com',
  AUTH_PASSWORD: 'test123',
};

// ── Parse CLI args ──────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULTS };
  for (let i = 0; i < args.length; i += 2) {
    switch (args[i]) {
      case '--concurrency':
        config.CONCURRENCY = parseInt(args[i + 1], 10);
        break;
      case '--duration':
        config.DURATION_SECONDS = parseInt(args[i + 1], 10);
        break;
      case '--base-url':
        config.BASE_URL = args[i + 1];
        break;
      case '--email':
        config.AUTH_EMAIL = args[i + 1];
        break;
      case '--password':
        config.AUTH_PASSWORD = args[i + 1];
        break;
    }
  }
  return config;
}

// ── Latency statistics helpers ──────────────────────────────
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(latencies) {
  if (latencies.length === 0) {
    return { count: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    avg: Math.round(sum / sorted.length),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// ── HTTP helper ─────────────────────────────────────────────
async function timedFetch(url, options = {}) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const body = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, latency, body, error: null };
  } catch (err) {
    return { ok: false, status: 0, latency: Date.now() - start, body: '', error: err.message };
  }
}

// ── Test scenario definitions ───────────────────────────────
function buildScenarios(baseUrl, token) {
  const scenarios = [
    {
      name: 'GET /health (gateway)',
      weight: 2,
      run: () => timedFetch(`${baseUrl}/health`),
    },
    {
      name: 'GET /api/search/spaces',
      weight: 5,
      run: () => timedFetch(`${baseUrl}/api/search/spaces?lat=17.4455&lon=78.3489`),
    },
  ];

  // Authenticated scenarios — only if we have a token
  if (token) {
    scenarios.push(
      {
        name: 'GET /api/listings/spaces',
        weight: 3,
        run: () =>
          timedFetch(`${baseUrl}/api/listings/spaces`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
      },
      {
        name: 'GET /api/bookings/my',
        weight: 2,
        run: () =>
          timedFetch(`${baseUrl}/api/bookings/bookings/my`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
      },
      {
        name: 'GET /api/subscriptions/my',
        weight: 1,
        run: () =>
          timedFetch(`${baseUrl}/api/subscriptions/my`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
      },
      {
        name: 'GET /api/notifications/my',
        weight: 1,
        run: () =>
          timedFetch(`${baseUrl}/api/notifications/my`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
      }
    );
  }

  return scenarios;
}

// ── Weighted random selection ───────────────────────────────
function pickScenario(scenarios) {
  const totalWeight = scenarios.reduce((s, sc) => s + sc.weight, 0);
  let r = Math.random() * totalWeight;
  for (const sc of scenarios) {
    r -= sc.weight;
    if (r <= 0) return sc;
  }
  return scenarios[scenarios.length - 1];
}

// ── Worker loop ─────────────────────────────────────────────
async function worker(id, scenarios, endTime, results) {
  while (Date.now() < endTime) {
    const scenario = pickScenario(scenarios);
    const res = await scenario.run();

    if (!results[scenario.name]) {
      results[scenario.name] = { latencies: [], errors: 0, successes: 0, rateLimited: 0 };
    }
    const bucket = results[scenario.name];
    bucket.latencies.push(res.latency);

    if (res.status === 429) {
      bucket.rateLimited++;
    } else if (!res.ok) {
      bucket.errors++;
    } else {
      bucket.successes++;
    }

    // Small random delay to avoid perfect synchronization
    await new Promise((r) => setTimeout(r, Math.random() * 100));
  }
}

// ── Login helper ────────────────────────────────────────────
async function login(baseUrl, email, password) {
  console.log(`  Attempting login as ${email}...`);
  try {
    const res = await timedFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = JSON.parse(res.body);
      console.log(`  ✅ Login successful (${res.latency}ms)`);
      return data.token;
    }
    console.log(`  ⚠️  Login failed (HTTP ${res.status}) — ${res.body}`);
    console.log(`  ⚠️  Running unauthenticated tests only`);
    return null;
  } catch (err) {
    console.log(`  ⚠️  Login error: ${err.message} — running unauthenticated tests only`);
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  const config = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        SpaceShare — Performance & Load Test                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Base URL     : ${config.BASE_URL}`);
  console.log(`║  Concurrency  : ${config.CONCURRENCY} virtual users`);
  console.log(`║  Duration     : ${config.DURATION_SECONDS}s`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Check gateway is reachable
  console.log('  Checking gateway health...');
  const healthCheck = await timedFetch(`${config.BASE_URL}/health`);
  if (!healthCheck.ok) {
    console.error('  ❌ Gateway is not reachable! Make sure services are running.');
    console.error(`     Status: ${healthCheck.status}, Error: ${healthCheck.error || healthCheck.body}`);
    process.exit(1);
  }
  console.log(`  ✅ Gateway is UP (${healthCheck.latency}ms)\n`);

  // 2. Try to authenticate
  const token = await login(config.BASE_URL, config.AUTH_EMAIL, config.AUTH_PASSWORD);
  console.log('');

  // 3. Build scenarios
  const scenarios = buildScenarios(config.BASE_URL, token);
  console.log(`  Scenarios: ${scenarios.map((s) => s.name).join(', ')}\n`);

  // 4. Run load test
  const results = {};
  const endTime = Date.now() + config.DURATION_SECONDS * 1000;

  console.log(`  ⏱️  Starting load test at ${new Date().toISOString()}...`);
  console.log(`  ⏱️  Will run until ${new Date(endTime).toISOString()}\n`);

  // Progress ticker
  const progressInterval = setInterval(() => {
    const totalReqs = Object.values(results).reduce(
      (sum, b) => sum + b.latencies.length,
      0
    );
    const elapsed = Math.round((Date.now() - (endTime - config.DURATION_SECONDS * 1000)) / 1000);
    process.stdout.write(`\r  ⏳ ${elapsed}s elapsed | ${totalReqs} requests sent...`);
  }, 1000);

  // Launch workers
  const workers = [];
  for (let i = 0; i < config.CONCURRENCY; i++) {
    workers.push(worker(i, scenarios, endTime, results));
  }
  await Promise.all(workers);
  clearInterval(progressInterval);

  // 5. Report
  console.log('\n\n');
  console.log('╔═════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          PERFORMANCE TEST RESULTS                                      ║');
  console.log('╠═════════════════════════════════════════════════════════════════════════════════════════╣');

  const header =
    '  Endpoint'.padEnd(32) +
    'Reqs'.padEnd(8) +
    'OK'.padEnd(8) +
    'Err'.padEnd(7) +
    '429'.padEnd(7) +
    'Avg'.padEnd(8) +
    'P50'.padEnd(8) +
    'P90'.padEnd(8) +
    'P95'.padEnd(8) +
    'P99'.padEnd(8) +
    'Max';
  console.log(header);
  console.log(`${'─'.repeat(105)}`);

  let totalRequests = 0;
  let totalErrors = 0;
  let totalRateLimited = 0;

  for (const [name, bucket] of Object.entries(results)) {
    const stats = computeStats(bucket.latencies);
    totalRequests += stats.count;
    totalErrors += bucket.errors;
    totalRateLimited += bucket.rateLimited;

    console.log(
      `  ${name}`.padEnd(32) +
        String(stats.count).padEnd(8) +
        String(bucket.successes).padEnd(8) +
        String(bucket.errors).padEnd(7) +
        String(bucket.rateLimited).padEnd(7) +
        `${stats.avg}ms`.padEnd(8) +
        `${stats.p50}ms`.padEnd(8) +
        `${stats.p90}ms`.padEnd(8) +
        `${stats.p95}ms`.padEnd(8) +
        `${stats.p99}ms`.padEnd(8) +
        `${stats.max}ms`
    );
  }

  console.log(`${'─'.repeat(105)}`);

  const throughput = (totalRequests / config.DURATION_SECONDS).toFixed(1);
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : '0.00';
  const rateLimitRate = totalRequests > 0 ? ((totalRateLimited / totalRequests) * 100).toFixed(2) : '0.00';

  console.log(`\n  Total Requests  : ${totalRequests}`);
  console.log(`  Throughput      : ${throughput} req/s`);
  console.log(`  Error Rate      : ${errorRate}%`);
  console.log(`  Rate-Limited    : ${totalRateLimited} (${rateLimitRate}%)`);
  console.log(`  Concurrency     : ${config.CONCURRENCY} virtual users`);
  console.log(`  Duration        : ${config.DURATION_SECONDS}s`);

  console.log('\n╚═════════════════════════════════════════════════════════════════════════════════════════╝');

  // Verdict
  const allLatencies = Object.values(results).flatMap((b) => b.latencies);
  const globalStats = computeStats(allLatencies);

  console.log('\n  📊 VERDICT:');
  if (globalStats.p95 < 200 && parseFloat(errorRate) < 1) {
    console.log('  ✅ EXCELLENT — P95 < 200ms and error rate < 1%');
  } else if (globalStats.p95 < 500 && parseFloat(errorRate) < 5) {
    console.log('  ⚠️  ACCEPTABLE — P95 < 500ms and error rate < 5%');
  } else {
    console.log('  ❌ NEEDS IMPROVEMENT — high latency or error rate detected');
  }

  process.exit(parseFloat(errorRate) > 5 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
