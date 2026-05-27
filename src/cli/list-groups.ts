import { createApp } from "../app.js";
import { BaileysWhatsAppClient } from "../integrations/index.js";

const app = createApp();
const client = new BaileysWhatsAppClient({
  authDir: app.config.whatsappAuthDir
});

try {
  await client.connect();
  const groups = await client.listGroups();
  console.log(JSON.stringify({ event: "whatsapp.list_groups.completed", groups }, null, 2));
  await client.close();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "whatsapp.list_groups.failed",
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error."
    })
  );
  await client.close();
  process.exitCode = 1;
}
