import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { handler, ok } from "@/lib/http";
import * as todos from "@/services/todo.service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const userId = await requireUser(req);
  const { id } = await params;
  return ok(await todos.duplicateTodo(userId, id), 201);
});