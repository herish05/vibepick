/** Minimal in-process Prometheus-format metrics (request count + latency sum per route). */
class Metrics {
  private counts = new Map<string, number>();
  private latency = new Map<string, number>();
  private custom = new Map<string, number>();

  observe(route: string, method: string, status: number, ms: number): void {
    const key = `route="${route}",method="${method}",status="${status}"`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.latency.set(key, (this.latency.get(key) ?? 0) + ms);
  }

  inc(name: string, by = 1): void {
    this.custom.set(name, (this.custom.get(name) ?? 0) + by);
  }

  render(): string {
    const lines: string[] = ['# TYPE http_requests_total counter', '# TYPE http_request_duration_ms_sum counter'];
    for (const [k, v] of this.counts) lines.push(`http_requests_total{${k}} ${v}`);
    for (const [k, v] of this.latency) lines.push(`http_request_duration_ms_sum{${k}} ${v.toFixed(2)}`);
    for (const [k, v] of this.custom) lines.push(`${k} ${v}`);
    return lines.join('\n') + '\n';
  }
}

export const metrics = new Metrics();
