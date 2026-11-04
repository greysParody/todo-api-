import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { handler, ok, parseBody, parseQuery } from "@/lib/http";
import { createTodoSchema, listTodosSchema } from "@/schemas/todo";
import * as todos from "@/services/todo.service";

export const GET = handler(async (req) => {
  const userId = await requireUser(req);
  const query = parseQuery(req, listTodosSchema);
  // Lists carry `meta` next to `data`, so this one skips ok().
  return NextResponse.json(await todos.listTodos(userId, query));
});

export const POST = handler(async (req) => {
  const userId = await requireUser(req);
  const input = await parseBody(req, createTodoSchema);
  return ok(await todos.createTodo(userId, input), 201);
});
