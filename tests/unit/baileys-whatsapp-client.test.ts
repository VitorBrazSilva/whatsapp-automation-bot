import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DisconnectReason,
  type ConnectionState,
  type GroupMetadata,
  type UserFacingSocketConfig
} from "baileys";
import {
  BaileysWhatsAppClientAdapter,
  type BaileysSocketLike,
  type WhatsAppLogger
} from "../../src/infrastructure/whatsapp/index.js";

describe("BaileysWhatsAppClientAdapter", () => {
  it("persists auth, renders QR without logging raw QR and notifies ready handlers", async () => {
    const authDir = await createTempDir();
    const sockets: FakeBaileysSocket[] = [];
    const qrCodes: string[] = [];
    const logger = new MemoryLogger();
    const client = new BaileysWhatsAppClientAdapter({
      authDir,
      authStateFactory: createAuthStateFactory(),
      socketFactory: createSocketFactory(sockets),
      qrWriter: (qr) => qrCodes.push(qr),
      logger
    });
    let readyCalls = 0;
    client.onReady(async () => {
      readyCalls += 1;
    });

    const connected = client.connect();
    await waitForSocket(sockets);
    sockets[0]?.emitConnectionUpdate({ qr: "raw-qr-secret" });
    sockets[0]?.emitCredsUpdate();
    sockets[0]?.emitConnectionUpdate({ connection: "open" });
    await connected;

    expect(qrCodes).toEqual(["raw-qr-secret"]);
    expect(readyCalls).toBe(1);
    expect(logger.entries).toContainEqual({
      level: "info",
      event: "whatsapp.qr.available"
    });
    expect(JSON.stringify(logger.entries)).not.toContain("raw-qr-secret");
    expect(sockets[0]?.savedCreds).toBe(1);
    await rm(authDir, { recursive: true, force: true });
  });

  it("normalizes sent group messages and validates group JIDs", async () => {
    const sockets: FakeBaileysSocket[] = [];
    const client = await createConnectedClient(sockets);

    const result = await client.sendGroupMessage("family@g.us", "Parabens!");

    expect(result).toEqual({
      providerMessageId: "provider-1",
      sentAt: new Date("2026-05-26T12:00:00.000Z")
    });
    expect(sockets[0]?.sentMessages).toEqual([{ jid: "family@g.us", text: "Parabens!" }]);
    await expect(client.sendGroupMessage("not-a-group", "Oi")).rejects.toMatchObject({
      code: "WHATSAPP_INVALID_GROUP_ID"
    });
  });

  it("lists groups without exposing participants", async () => {
    const sockets: FakeBaileysSocket[] = [];
    const client = await createConnectedClient(sockets);
    sockets[0]?.setGroups({
      "b@g.us": createGroup("b@g.us", "Grupo B", ["one@s.whatsapp.net"]),
      "a@g.us": createGroup("a@g.us", "Grupo A", ["one@s.whatsapp.net", "two@s.whatsapp.net"])
    });

    await expect(client.listGroups()).resolves.toEqual([
      { id: "a@g.us", subject: "Grupo A", participantCount: 2 },
      { id: "b@g.us", subject: "Grupo B", participantCount: 1 }
    ]);
  });

  it("reconnects on transient close and fires ready handlers again", async () => {
    const sockets: FakeBaileysSocket[] = [];
    const client = await createConnectedClient(sockets);
    let readyCalls = 0;
    client.onReady(async () => {
      readyCalls += 1;
    });

    sockets[0]?.emitConnectionUpdate({
      connection: "close",
      lastDisconnect: createDisconnect(DisconnectReason.restartRequired)
    });
    await waitForSocket(sockets, 2);
    sockets[1]?.emitConnectionUpdate({ connection: "open" });

    expect(sockets).toHaveLength(2);
    expect(readyCalls).toBe(1);
  });

  it("maps send provider failures to a known WhatsApp error", async () => {
    const sockets: FakeBaileysSocket[] = [];
    const client = await createConnectedClient(sockets);
    sockets[0]?.failSend(new Error("provider unavailable"));

    await expect(client.sendGroupMessage("family@g.us", "Parabens!")).rejects.toMatchObject({
      name: "WhatsAppSendError",
      code: "WHATSAPP_SEND_FAILED",
      message: "provider unavailable"
    });
  });
});

async function createConnectedClient(
  sockets: FakeBaileysSocket[]
): Promise<BaileysWhatsAppClientAdapter> {
  const client = new BaileysWhatsAppClientAdapter({
    authDir: "unused-test-auth",
    authStateFactory: createAuthStateFactory(),
    socketFactory: createSocketFactory(sockets),
    qrWriter: () => undefined,
    logger: new MemoryLogger(),
    now: () => new Date("2026-05-26T12:00:00.000Z")
  });
  const connected = client.connect();
  await waitForSocket(sockets);
  sockets[0]?.emitConnectionUpdate({ connection: "open" });
  await connected;
  return client;
}

function createSocketFactory(
  sockets: FakeBaileysSocket[]
): (config: UserFacingSocketConfig) => BaileysSocketLike {
  return () => {
    const socket = new FakeBaileysSocket();
    sockets.push(socket);
    return socket;
  };
}

function createAuthStateFactory(): () => Promise<{
  state: UserFacingSocketConfig["auth"];
  saveCreds: () => Promise<void>;
}> {
  return async () => {
    return {
      state: {
        creds: {},
        keys: {}
      } as UserFacingSocketConfig["auth"],
      saveCreds: async () => {
        FakeBaileysSocket.latest?.incrementSavedCreds();
      }
    };
  };
}

function createGroup(id: string, subject: string, participants: string[]): GroupMetadata {
  return {
    id,
    subject,
    participants: participants.map((participant) => ({ id: participant }))
  } as GroupMetadata;
}

function createDisconnect(statusCode: number): NonNullable<ConnectionState["lastDisconnect"]> {
  return {
    date: new Date("2026-05-26T12:00:00.000Z"),
    error: Object.assign(new Error("connection closed"), {
      output: { statusCode }
    })
  };
}

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "birthday-bot-whatsapp-"));
}

async function waitForSocket(sockets: FakeBaileysSocket[], count = 1): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (sockets.length >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for fake Baileys socket.");
}

class FakeBaileysSocket implements BaileysSocketLike {
  static latest: FakeBaileysSocket | null = null;

  readonly ev = {
    on: (event: "connection.update" | "creds.update", listener: unknown) => {
      if (event === "connection.update") {
        this.connectionListeners.push(listener as (update: Partial<ConnectionState>) => void);
      }
      if (event === "creds.update") {
        this.credsListeners.push(listener as () => void);
      }
    }
  };
  readonly sentMessages: Array<{ jid: string; text: string }> = [];
  savedCreds = 0;

  private readonly connectionListeners: Array<(update: Partial<ConnectionState>) => void> = [];
  private readonly credsListeners: Array<() => void> = [];
  private groups: Record<string, GroupMetadata> = {};
  private sendError: Error | null = null;

  constructor() {
    FakeBaileysSocket.latest = this;
  }

  async sendMessage(jid: string, content: { text: string }) {
    if (this.sendError !== null) {
      throw this.sendError;
    }
    this.sentMessages.push({ jid, text: content.text });
    return {
      key: {
        id: `provider-${this.sentMessages.length}`
      }
    } as never;
  }

  async groupFetchAllParticipating() {
    return this.groups;
  }

  emitConnectionUpdate(update: Partial<ConnectionState>): void {
    for (const listener of this.connectionListeners) {
      listener(update);
    }
  }

  emitCredsUpdate(): void {
    for (const listener of this.credsListeners) {
      listener();
    }
  }

  setGroups(groups: Record<string, GroupMetadata>): void {
    this.groups = groups;
  }

  failSend(error: Error): void {
    this.sendError = error;
  }

  incrementSavedCreds(): void {
    this.savedCreds += 1;
  }
}

class MemoryLogger implements WhatsAppLogger {
  readonly entries: Array<Record<string, unknown>> = [];

  info(fields: Record<string, unknown>): void {
    this.entries.push({ level: "info", ...fields });
  }

  warn(fields: Record<string, unknown>): void {
    this.entries.push({ level: "warn", ...fields });
  }

  error(fields: Record<string, unknown>): void {
    this.entries.push({ level: "error", ...fields });
  }
}
