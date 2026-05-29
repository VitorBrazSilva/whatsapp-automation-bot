export interface LoggerPort {
  info(fields: Record<string, unknown>): void;
  warn(fields: Record<string, unknown>): void;
  error(fields: Record<string, unknown>): void;
}

export interface MetricsPort {
  incrementCounter(name: string, labels?: Record<string, string>, value?: number): void;
}

export const nullLoggerPort: LoggerPort = {
  info() {
    return undefined;
  },
  warn() {
    return undefined;
  },
  error() {
    return undefined;
  }
};

export const nullMetricsPort: MetricsPort = {
  incrementCounter() {
    return undefined;
  }
};
