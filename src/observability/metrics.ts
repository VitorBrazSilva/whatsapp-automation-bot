import { createServer, type Server } from "node:http";

export interface MetricsRegistry {
  incrementCounter(name: MetricName, labels?: MetricLabels, value?: number): void;
  setGauge(name: MetricName, value: number, labels?: MetricLabels): void;
  renderPrometheus(): string;
}

export interface MetricsServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface MetricsServerOptions {
  registry: MetricsRegistry;
  host: string;
  port: number;
}

export type MetricName =
  | "automation_runs_total"
  | "message_deliveries_total"
  | "message_delivery_duplicates_total"
  | "birthday_people_matched_total"
  | "message_generation_fallbacks_total"
  | "birthday_checks_total"
  | "birthday_birthdays_found_total"
  | "birthday_delivery_attempts_total"
  | "birthday_duplicate_skips_total"
  | "birthday_message_generation_failures_total"
  | "whatsapp_connection_state";

export type MetricLabels = Record<string, string | number | boolean>;

interface MetricSample {
  value: number;
  labels: MetricLabels;
}

const METRIC_HELP: Record<MetricName, string> = {
  automation_runs_total: "Total automation runs by automation and status.",
  message_deliveries_total: "Total message deliveries by automation and status.",
  message_delivery_duplicates_total: "Total duplicate message deliveries skipped.",
  birthday_people_matched_total: "Total birthday people matched.",
  message_generation_fallbacks_total: "Total message generations that used fallback.",
  birthday_checks_total: "Total birthday checks by status.",
  birthday_birthdays_found_total: "Total birthdays found during checks.",
  birthday_delivery_attempts_total: "Total birthday delivery attempts by status.",
  birthday_duplicate_skips_total: "Total duplicate birthday deliveries skipped.",
  birthday_message_generation_failures_total: "Total message generations that used fallback.",
  whatsapp_connection_state: "Current WhatsApp connection state as a numeric gauge."
};

const METRIC_TYPE: Record<MetricName, "counter" | "gauge"> = {
  automation_runs_total: "counter",
  message_deliveries_total: "counter",
  message_delivery_duplicates_total: "counter",
  birthday_people_matched_total: "counter",
  message_generation_fallbacks_total: "counter",
  birthday_checks_total: "counter",
  birthday_birthdays_found_total: "counter",
  birthday_delivery_attempts_total: "counter",
  birthday_duplicate_skips_total: "counter",
  birthday_message_generation_failures_total: "counter",
  whatsapp_connection_state: "gauge"
};

export class InMemoryMetricsRegistry implements MetricsRegistry {
  private readonly counters = new Map<string, MetricSample>();
  private readonly gauges = new Map<string, MetricSample>();

  incrementCounter(name: MetricName, labels: MetricLabels = {}, value = 1): void {
    const key = createMetricKey(name, labels);
    const previous = this.counters.get(key);
    this.counters.set(key, {
      labels,
      value: (previous?.value ?? 0) + value
    });
  }

  setGauge(name: MetricName, value: number, labels: MetricLabels = {}): void {
    this.gauges.set(createMetricKey(name, labels), {
      labels,
      value
    });
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const name of Object.keys(METRIC_HELP) as MetricName[]) {
      lines.push(`# HELP ${name} ${METRIC_HELP[name]}`);
      lines.push(`# TYPE ${name} ${METRIC_TYPE[name]}`);
      const samples = this.readSamples(name);
      for (const sample of samples) {
        lines.push(`${name}${formatLabels(sample.labels)} ${sample.value}`);
      }
    }
    return `${lines.join("\n")}\n`;
  }

  private readSamples(name: MetricName): MetricSample[] {
    const source = METRIC_TYPE[name] === "counter" ? this.counters : this.gauges;
    return [...source.entries()]
      .filter(([key]) => key.startsWith(`${name}|`))
      .map(([, sample]) => sample);
  }
}

export const nullMetricsRegistry: MetricsRegistry = {
  incrementCounter() {
    return undefined;
  },
  setGauge() {
    return undefined;
  },
  renderPrometheus() {
    return "";
  }
};

export class HttpMetricsServer implements MetricsServer {
  private readonly registry: MetricsRegistry;
  private readonly host: string;
  private readonly port: number;
  private server: Server | null = null;

  constructor(options: MetricsServerOptions) {
    this.registry = options.registry;
    this.host = options.host;
    this.port = options.port;
  }

  async start(): Promise<void> {
    if (this.server !== null) {
      return;
    }
    this.server = createServer((request, response) => {
      if (request.url !== "/metrics") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("not found\n");
        return;
      }
      response.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
      response.end(this.registry.renderPrometheus());
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.port, this.host, resolve);
    });
  }

  async stop(): Promise<void> {
    if (this.server === null) {
      return;
    }
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

function createMetricKey(name: MetricName, labels: MetricLabels): string {
  const labelKey = Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
  return `${name}|${labelKey}`;
}

function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return "";
  }
  const rendered = entries
    .map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`)
    .join(",");
  return `{${rendered}}`;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}
