import { describe, expect, it } from "vitest";
import {
  InMemoryMetricsRegistry,
  JsonLogger,
  sanitizeLogFields
} from "../../src/observability/index.js";

describe("observability", () => {
  it("writes structured JSON logs with redacted sensitive fields", () => {
    const lines: string[] = [];
    const logger = new JsonLogger({
      now: () => new Date("2026-05-26T12:00:00.000Z"),
      sink: (line) => lines.push(line)
    });

    logger.info({
      event: "test.event",
      personId: "person-1",
      apiKey: "sk-secret-key",
      qr: "raw-qr-secret",
      messageText: "Mensagem completa nao deve ir para logs",
      nested: {
        authorization: "Bearer secret-token"
      }
    });

    expect(JSON.parse(lines[0] ?? "{}")).toEqual({
      level: "info",
      timestamp: "2026-05-26T12:00:00.000Z",
      event: "test.event",
      personId: "person-1",
      apiKey: "[redacted]",
      qr: "[redacted]",
      messageText: "[redacted]",
      nested: {
        authorization: "[redacted]"
      }
    });
    expect(lines[0]).not.toContain("secret-key");
    expect(lines[0]).not.toContain("raw-qr-secret");
    expect(lines[0]).not.toContain("Mensagem completa");
  });

  it("sanitizes secret-like values in error messages", () => {
    const sanitized = sanitizeLogFields({
      event: "provider.failed",
      errorMessage: "Request failed for sk-abc123456789 and Bearer token-secret"
    });

    expect(sanitized.errorMessage).toBe("Request failed for [redacted] and [redacted]");
  });

  it("renders enabled metrics in Prometheus text format", () => {
    const metrics = new InMemoryMetricsRegistry();

    metrics.incrementCounter("birthday_checks_total", { status: "completed" });
    metrics.incrementCounter("birthday_delivery_attempts_total", { status: "sent" }, 2);
    metrics.incrementCounter("birthday_duplicate_skips_total");
    metrics.setGauge("whatsapp_connection_state", 1);

    const output = metrics.renderPrometheus();

    expect(output).toContain("# TYPE birthday_checks_total counter");
    expect(output).toContain('birthday_checks_total{status="completed"} 1');
    expect(output).toContain('birthday_delivery_attempts_total{status="sent"} 2');
    expect(output).toContain("birthday_duplicate_skips_total 1");
    expect(output).toContain("whatsapp_connection_state 1");
  });
});
