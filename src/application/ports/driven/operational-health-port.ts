export type HealthCheckStatus = "ok" | "error";

export interface ReadinessReport {
  status: HealthCheckStatus;
  checks: Record<string, HealthCheckStatus>;
}

export interface OperationalReadinessPort {
  read(): Promise<ReadinessReport>;
}
