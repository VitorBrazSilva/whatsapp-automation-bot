import { loadAppConfig } from "../config/index.js";
import {
  BaileysWhatsAppClient,
  type WhatsAppGroup,
  type WhatsAppGroupLister
} from "../integrations/index.js";

export interface GroupListWhatsAppClient extends WhatsAppGroupLister {
  connect(): Promise<void>;
  close?(): Promise<void> | void;
}

export interface ListGroupsCommandOptions {
  env?: NodeJS.ProcessEnv;
  whatsappClient?: GroupListWhatsAppClient;
  stdout?: (line: string) => void;
}

export interface ListGroupsCommandResult {
  groups: WhatsAppGroup[];
}

export async function runListGroupsCommand(
  options: ListGroupsCommandOptions = {}
): Promise<ListGroupsCommandResult> {
  const stdout = options.stdout ?? console.log;
  const config = loadAppConfig(options.env);
  const client =
    options.whatsappClient ??
    new BaileysWhatsAppClient({
      authDir: config.whatsappAuthDir
    });
  try {
    await client.connect();
    const groups = await client.listGroups();
    stdout(JSON.stringify({ event: "whatsapp.list_groups.completed", groups }, null, 2));
    return { groups };
  } finally {
    await client.close?.();
  }
}
