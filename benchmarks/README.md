# P17 performance diagnostics

Run the deterministic performance harness from the repository root:

```bash
bun benchmarks/p17-performance.ts
```

The harness creates fixed datasets before measurement, performs three warmup iterations by default, and emits one JSON report to standard output. It covers:

- bootstrap of eight panels across two guards;
- page pagination over 100,000 records;
- table search over 100,000 records;
- option search over 100,000 records;
- global search across four resources containing 100,000 records in total;
- selection and resolution of a 24-widget dashboard;
- one notification poll-style refresh against 1,000 notifications.

The 100,000-row workloads use the harness's deterministic in-memory query adapter. Results measure Holo Panels orchestration plus that adapter; they are diagnostics, not claims about a production database driver. Notification timing measures the refresh performed by a poll tick and excludes the idle interval.

Every measurement reports minimum, median, mean, p95, maximum, operations per second, and a result checksum. Dataset creation and warmup are excluded from samples. Warmup and measured iteration counts can be changed within bounded ranges:

```bash
P17_BENCH_WARMUP=5 P17_BENCH_ITERATIONS=30 bun benchmarks/p17-performance.ts
```

Compare reports only on the same runtime, architecture, power mode, iteration settings, and data adapter. Use a production Holo database benchmark separately when evaluating query plans, indexes, connection pools, or driver performance.
