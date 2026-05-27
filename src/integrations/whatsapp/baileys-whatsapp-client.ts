import { mkdir } from "node:fs/promises";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  type ConnectionState,
  type GroupMetadata,
  type UserFacingSocketConfig,
  type WAMessage
} from "baileys";
import pino from "pino";
import * as qrcode from "qrcode-terminal";
import {
  JsonLogger,
  nullMetricsRegistry,
  readErrorCode,
  readErrorMessage,
  type MetricsRegistry,
  type StructuredLogger
} from "../../observability/index.js";
import {
  WhatsAppSendError,
  type SendResult,
  type WhatsAppClient,
  type WhatsAppGroup,
  type WhatsAppGroupLister
} from "../whatsapp-client.js";

type ConnectionUpdate = Partial<ConnectionState>;
type ReadyHandler = () => Promise<void>;

interface BaileysEventEmitterLike {
  on(event: "connection.update", listener: (update: ConnectionUpdate) => void): void;
  on(event: "creds.update", listener: () => void): void;
}

export interface BaileysSocketLike {
  ev: BaileysEventEmitterLike;
  sendMessage(jid: string, content: { text: string }): Promise<WAMessage | undefined>;
  groupFetchAllParticipating(): Promise<Record<string, GroupMetadata>>;
  end?(error: Error | undefined): Promise<void>;
}

export interface BaileysAuthStateResult {
  state: UserFacingSocketConfig["auth"];
  saveCreds(): Promise<void>;
}

export type WhatsAppLogger = StructuredLogger;

export interface BaileysWhatsAppClientOptions {
  authDir: string;
  socketFactory?: (config: UserFacingSocketConfig) => BaileysSocketLike;
  authStateFactory?: (authDir: string) => Promise<BaileysAuthStateResult>;
  qrWriter?: (qr: string) => void;
  logger?: WhatsAppLogger;
  metrics?: MetricsRegistry;
  now?: () => Date;
}

type ConnectionStatus = "idle" | "connecting" | "ready" | "closed" | "logged_out";

export class BaileysWhatsAppClient implements WhatsAppClient, WhatsAppGroupLister {
  private readonly authDir: string;
  private readonly socketFactory: (config: UserFacingSocketConfig) => BaileysSocketLike;
  private readonly authStateFactory: (authDir: string) => Promise<BaileysAuthStateResult>;
  private readonly qrWriter: (qr: string) => void;
  private readonly logger: WhatsAppLogger;
  private readonly metrics: MetricsRegistry;
  private readonly now: () => Date;
  private readonly readyHandlers: ReadyHandler[] = [];

  private socket: BaileysSocketLike | null = null;
  private status: ConnectionStatus = "idle";
  private initialReadyPromise: Promise<void> | null = null;
  private resolveInitialReady: (() => void) | null = null;
  private rejectInitialReady: ((error: Error) => void) | null = null;

  constructor(options: BaileysWhatsAppClientOptions) {
    this.authDir = options.authDir;
    this.socketFactory = options.socketFactory ?? createDefaultSocket;
    this.authStateFactory = options.authStateFactory ?? useMultiFileAuthState;
    this.qrWriter = options.qrWriter ?? writeQrToTerminal;
    this.logger = options.logger ?? consoleJsonLogger;
    this.metrics = options.metrics ?? nullMetricsRegistry;
    this.now = options.now ?? (() => new Date());
  }

  async connect(): Promise<void> {
    if (this.status === "ready") {
      return;
    }
    if (this.initialReadyPromise !== null) {
      return this.initialReadyPromise;
    }
    this.initialReadyPromise = new Promise<void>((resolve, reject) => {
      this.resolveInitialReady = resolve;
      this.rejectInitialReady = reject;
    });
    try {
      await this.startSocket();
    } catch (error) {
      this.status = "idle";
      this.rejectInitialReady?.(normalizeWhatsAppError(
        error,
        "WHATSAPP_CONNECT_FAILED",
        "WhatsApp connection failed."
      ));
      this.initialReadyPromise = null;
      this.clearInitialPromiseHandlers();
      throw normalizeWhatsAppError(
        error,
        "WHATSAPP_CONNECT_FAILED",
        "WhatsApp connection failed."
      );
    }
    return this.initialReadyPromise;
  }

  async sendGroupMessage(groupId: string, text: string): Promise<SendResult> {
    if (!isGroupJid(groupId)) {
      throw new WhatsAppSendError(
        "WHATSAPP_INVALID_GROUP_ID",
        "Group id must be a WhatsApp group JID."
      );
    }
    const socket = this.requireReadySocket("WHATSAPP_NOT_CONNECTED");
    try {
      const sentMessage = await socket.sendMessage(groupId, { text });
      return {
        providerMessageId: sentMessage?.key.id ?? null,
        sentAt: this.now()
      };
    } catch (error) {
      throw normalizeWhatsAppError(error, "WHATSAPP_SEND_FAILED", "WhatsApp send failed.");
    }
  }

  async listGroups(): Promise<WhatsAppGroup[]> {
    const socket = this.requireReadySocket("WHATSAPP_NOT_CONNECTED");
    try {
      const groups = await socket.groupFetchAllParticipating();
      return Object.entries(groups)
        .map(([id, group]) => ({
          id,
          subject: group.subject,
          participantCount: group.participants.length
        }))
        .sort((left, right) => left.subject.localeCompare(right.subject));
    } catch (error) {
      throw normalizeWhatsAppError(
        error,
        "WHATSAPP_LIST_GROUPS_FAILED",
        "WhatsApp group listing failed."
      );
    }
  }

  onReady(handler: ReadyHandler): void {
    this.readyHandlers.push(handler);
  }

  async close(): Promise<void> {
    await this.socket?.end?.(undefined);
    this.socket = null;
    this.status = "closed";
  }

  private async startSocket(): Promise<void> {
    this.status = "connecting";
    this.recordConnectionState("connecting");
    await mkdir(this.authDir, { recursive: true });
    const { state, saveCreds } = await this.authStateFactory(this.authDir);
    const socket = this.socketFactory({
      auth: state,
      browser: Browsers.baileys("Birthday Bot"),
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
      syncFullHistory: false
    });
    this.socket = socket;
    socket.ev.on("creds.update", () => {
      void saveCreds().catch((error: unknown) => {
        this.logger.error({
          event: "whatsapp.credentials_save_failed",
          errorCode: readErrorCode(error),
          errorMessage: readErrorMessage(error)
        });
      });
    });
    socket.ev.on("connection.update", (update) => {
      void this.handleConnectionUpdate(update);
    });
  }

  private async handleConnectionUpdate(update: ConnectionUpdate): Promise<void> {
    if (update.qr !== undefined) {
      this.logger.info({ event: "whatsapp.qr.available" });
      this.qrWriter(update.qr);
    }
    if (update.connection === "open") {
      this.status = "ready";
      this.recordConnectionState("ready");
      this.logger.info({ event: "whatsapp.connection.open" });
      this.resolveInitialReady?.();
      this.initialReadyPromise = null;
      this.clearInitialPromiseHandlers();
      await this.notifyReadyHandlers();
      return;
    }
    if (update.connection !== "close") {
      return;
    }
    const statusCode = readDisconnectStatusCode(update);
    if (statusCode === DisconnectReason.loggedOut) {
      this.status = "logged_out";
      this.socket = null;
      this.recordConnectionState("logged_out");
      const error = new WhatsAppSendError(
        "WHATSAPP_LOGGED_OUT",
        "WhatsApp session logged out. Clear the session directory and pair again."
      );
      this.rejectInitialReady?.(error);
      this.initialReadyPromise = null;
      this.clearInitialPromiseHandlers();
      this.logger.warn({
        event: "whatsapp.connection.closed",
        reason: "logged_out"
      });
      return;
    }
    this.status = "closed";
    this.socket = null;
    this.recordConnectionState("closed");
    this.logger.warn({
      event: "whatsapp.connection.closed",
      reason: "reconnect",
      statusCode: statusCode ?? null
    });
    await this.startSocket();
  }

  private requireReadySocket(code: string): BaileysSocketLike {
    if (this.socket !== null && this.status === "ready") {
      return this.socket;
    }
    throw new WhatsAppSendError(code, "WhatsApp is not connected.");
  }

  private async notifyReadyHandlers(): Promise<void> {
    for (const handler of this.readyHandlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.error({
          event: "whatsapp.ready_handler_failed",
          errorCode: readErrorCode(error),
          errorMessage: readErrorMessage(error)
        });
      }
    }
  }

  private clearInitialPromiseHandlers(): void {
    this.resolveInitialReady = null;
    this.rejectInitialReady = null;
  }

  private recordConnectionState(status: ConnectionStatus): void {
    this.metrics.setGauge("whatsapp_connection_state", readConnectionStateValue(status));
  }
}

function createDefaultSocket(config: UserFacingSocketConfig): BaileysSocketLike {
  return makeWASocket(config);
}

function writeQrToTerminal(qr: string): void {
  qrcode.generate(qr, { small: true });
}

function isGroupJid(groupId: string): boolean {
  return groupId.endsWith("@g.us");
}

function normalizeWhatsAppError(error: unknown, code: string, fallbackMessage: string): Error {
  if (error instanceof WhatsAppSendError) {
    return error;
  }
  return new WhatsAppSendError(code, readErrorMessage(error) ?? fallbackMessage, error);
}

function readDisconnectStatusCode(update: ConnectionUpdate): number | undefined {
  const error = update.lastDisconnect?.error as
    | { output?: { statusCode?: number } }
    | undefined;
  return error?.output?.statusCode;
}

function readConnectionStateValue(status: ConnectionStatus): number {
  if (status === "ready") {
    return 1;
  }
  if (status === "connecting") {
    return 0.5;
  }
  if (status === "logged_out") {
    return -1;
  }
  return 0;
}

const consoleJsonLogger = new JsonLogger();
