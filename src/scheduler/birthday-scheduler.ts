export interface BirthdayScheduler {
  start(): Promise<void>;
  stop(): Promise<void>;
}
