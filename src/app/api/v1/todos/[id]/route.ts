import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { handler, noContent, ok, parseBody } from "@/lib/http";
import { updateTodoSchema } from "@/schemas/todo";
import * as todos from "@/services/todo.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const userId = await requireUser(req);
  const { id } = await params;
  return ok(await todos.getTodo(userId, id));
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const userId = await requireUser(req);
  const { id } = await params;
  const input = await parseBody(req, updateTodoSchema);
  return ok(await todos.updateTodo(userId, id, input));
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const userId = await requireUser(req);
  const { id } = await params;
  await todos.deleteTodo(userId, id);
  return noContent();
});
