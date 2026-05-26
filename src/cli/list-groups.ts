import { createApp } from "../app.js";

const app = createApp();

console.log(
  JSON.stringify({
    event: "whatsapp.list_groups.requested",
    status: "not_implemented",
    whatsappGroupConfigured: app.config.whatsappGroupId !== null
  })
);
