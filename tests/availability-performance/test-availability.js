/**
 * SpaceShare Microservices — Availability Test Script
 *
 * Tests health endpoints of all services and the aggregated gateway health.
 * Runs repeated checks over a configurable duration to measure uptime percentage.
 *
 * Usage:
 *   node test-availability.js [--duration <seconds>] [--interval <ms>] [--gateway-url <url>]
 *
 * Example:
 *   node test-availability.js --duration 60 --interval 5000
 */

const DEFAULTS = {
  GATEWAY_URL: 'http://localhost:4000',
  SERVICES: {
    'api-gateway': 'http://localhost:4000/health',
    'auth-service': 'http://localhost:4001/health',
    'listing-service': 'http://localhost:4002/health',
    'search-service': 'http://localhost:4003/health',
    'booking-service': 'http://localhost:4004/health',
    'subscription-service': 'http://localhost:4005/health',
    'notification-service': 'http://localhost:4006/health',
    'analytics-service': 'http://localhost:4007/health',
    'payment-service': 'http://localhost:4008/health',
  },
  DURATION_SECONDS: 60,
  INTERVAL_MS: 5000,
};

// ── Parse CLI args ──────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULTS };
  for (let i = 0; i < args.length; i += 2) {
    switch (args[i]) {
      case '--duration':
        config.DURATION_SECONDS = parseInt(args[i + 1], 10);
        break;
      case '--interval':
        config.INTERVAL_MS = parseInt(args[i + 1], 10);
        break;
      case '--gateway-url':
        config.GATEWAY_URL = args[i + 1];
        break;
    }
  }
  return config;
}

// ── Health check for a single service ───────────────────────
async function checkService(name, url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const body = await res.json().catch(() => null);

    return {
      name,
      url,
      status: res.ok ? 'UP' : 'DEGRADED',
      httpStatus: res.status,
      latency,
      body,
    };
  } catch (err) {
    return {
      name,
      url,
      status: 'DOWN',
      httpStatus: null,
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

// ── Single round of checks ──────────────────────────────────
async function runRound(services) {
  const checks = await Promise.all(
    Object.entries(services).map(([name, url]) => checkService(name, url))
  );
  return checks;
}

// ── Pretty table printing ───────────────────────────────────
function printRound(roundNum, results) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`  Round #${roundNum}  |  ${new Date().toISOString()}`);
  console.log(`${'─'.repeat(80)}`);
  console.log(
    '  Service'.padEnd(28) +
      'Status'.padEnd(12) +
      'HTTP'.padEnd(8) +
      'Latency'.padEnd(12) +
      'Details'
  );
  console.log(`${'─'.repeat(80)}`);

  for (const r of results) {
    const statusIcon = r.status === 'UP' ? '✅' : r.status === 'DEGRADED' ? '⚠️' : '❌';
    const details = r.error || '';
    console.log(
      `  ${statusIcon} ${r.name}`.padEnd(28) +
        r.status.padEnd(12) +
        String(r.httpStatus ?? '-').padEnd(8) +
        `${r.latency}ms`.padEnd(12) +
        details
    );
  }
}

// ── Main loop ───────────────────────────────────────────────
async function main() {
  const config = parseArgs();
  const totalRounds = Math.ceil((config.DURATION_SECONDS * 1000) / config.INTERVAL_MS);

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        SpaceShare — Availability Test                       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration     : ${config.DURATION_SECONDS}s`);
  console.log(`║  Interval     : ${config.INTERVAL_MS}ms`);
  console.log(`║  Total rounds : ${totalRounds}`);
  console.log(`║  Services     : ${Object.keys(config.SERVICES).length}`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Aggregate stats
  const stats = {};
  for (const name of Object.keys(config.SERVICES)) {
    stats[name] = { up: 0, degraded: 0, down: 0, totalLatency: 0, maxLatency: 0, minLatency: Infinity };
  }

  for (let round = 1; round <= totalRounds; round++) {
    const results = await runRound(config.SERVICES);
    printRound(round, results);

    for (const r of results) {
      const s = stats[r.name];
      if (r.status === 'UP') s.up++;
      else if (r.status === 'DEGRADED') s.degraded++;
      else s.down++;
      s.totalLatency += r.latency;
      s.maxLatency = Math.max(s.maxLatency, r.latency);
      s.minLatency = Math.min(s.minLatency, r.latency);
    }

    if (round < totalRounds) {
      await new Promise((resolve) => setTimeout(resolve, config.INTERVAL_MS));
    }
  }

  // ── Summary report ──────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                       AVAILABILITY SUMMARY REPORT                           ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log(
    '  Service'.padEnd(24) +
      'Uptime %'.padEnd(12) +
      'Avg(ms)'.padEnd(10) +
      'Min(ms)'.padEnd(10) +
      'Max(ms)'.padEnd(10) +
      'UP'.padEnd(6) +
      'DEGR'.padEnd(6) +
      'DOWN'
  );
  console.log(`${'─'.repeat(82)}`);

  for (const [name, s] of Object.entries(stats)) {
    const total = s.up + s.degraded + s.down;
    const uptime = total > 0 ? ((s.up / total) * 100).toFixed(1) : '0.0';
    const avg = total > 0 ? Math.round(s.totalLatency / total) : '-';
    const min = s.minLatency === Infinity ? '-' : s.minLatency;

    console.log(
      `  ${name}`.padEnd(24) +
        `${uptime}%`.padEnd(12) +
        String(avg).padEnd(10) +
        String(min).padEnd(10) +
        String(s.maxLatency).padEnd(10) +
        String(s.up).padEnd(6) +
        String(s.degraded).padEnd(6) +
        String(s.down)
    );
  }

  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  // Exit code: 1 if any service was down in > 20% of checks
  const anyUnhealthy = Object.values(stats).some((s) => {
    const total = s.up + s.degraded + s.down;
    return total > 0 && s.down / total > 0.2;
  });
  process.exit(anyUnhealthy ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
