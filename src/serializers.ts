import type { Todo, User } from "@/generated/prisma/client";

// The only way data leaves the API. Anything not listed here (passwordHash, userId, tokens) never goes out.

export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toPublicTodo(todo: Todo) {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    // A @db.Date comes back as UTC midnight. Read it back in UTC so it never shifts a day.
    dueDate: todo.dueDate?.toISOString().slice(0, 10) ?? null,
    completed: todo.completed,
    completedAt: todo.completedAt?.toISOString() ?? null,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  };
}

/** `YYYY-MM-DD` to the Date Prisma writes into a DATE column. */
export const dateOnlyToDb = (value: string) => new Date(`${value}T00:00:00.000Z`);
