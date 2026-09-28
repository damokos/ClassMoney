import type { Env } from "./types/env";
import { router } from "./router";
import { runNotificationDigest } from "./services/notification-digest";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return router(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runNotificationDigest(env);
  },
};
