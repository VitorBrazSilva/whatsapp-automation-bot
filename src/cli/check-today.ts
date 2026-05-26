import { createApp } from "../app.js";

const app = createApp();

console.log(
  JSON.stringify({
    event: "birthday.check_today.requested",
    status: "not_implemented",
    timezone: app.config.timezone,
    dailyCheckTime: app.config.dailyCheckTime
  })
);
