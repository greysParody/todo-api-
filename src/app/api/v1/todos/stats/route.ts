import { requireUser } from "@/lib/auth/require-user";
import { handler, ok } from "@/lib/http";
import * as todos from "@/services/todo.service";

export const GET = handler(async (req) => {
  const userId = await requireUser(req);
  return ok(await todos.getStats(userId));
});
