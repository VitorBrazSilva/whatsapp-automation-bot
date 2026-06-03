import type { INestApplicationContext } from "@nestjs/common";
import type { WhatsAppGroup, WhatsAppGroupMessenger } from "../../application/index.js";
import { WHATSAPP_CLIENT } from "../../infrastructure/index.js";
import { createCommandContext } from "./application-context.js";

export interface ListGroupsCommandOptions {
  context?: INestApplicationContext;
  env?: NodeJS.ProcessEnv;
  stdout?: (line: string) => void;
}

export interface ListGroupsCommandResult {
  groups: WhatsAppGroup[];
}

export async function runListGroupsCommand(
  options: ListGroupsCommandOptions = {}
): Promise<ListGroupsCommandResult> {
  const stdout = options.stdout ?? console.log;
  const context =
    options.context ??
    (await createCommandContext({
      env: options.env
    }));
  const ownsContext = options.context === undefined;
  const client = context.get<WhatsAppGroupMessenger>(WHATSAPP_CLIENT);
  try {
    await client.connect();
    const groups = await client.listGroups();
    stdout(JSON.stringify({ event: "whatsapp.list_groups.completed", groups }, null, 2));
    return { groups };
  } finally {
    if (ownsContext) {
      await client.close();
      await context.close();
    }
  }
}
