import type { Prisma } from "@/generated/prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { todoIdSchema, type CreateTodoInput, type ListTodosQuery, type UpdateTodoInput } from "@/schemas/todo";
import { dateOnlyToDb, toPublicTodo } from "@/serializers";

// Every query here filters by userId. Another user's todo is "not found", never "forbidden".

/** A malformed id would make Postgres throw on the uuid column (a 500). It can't exist, so it's a 404. */
function assertId(id: string) {
  if (!todoIdSchema.safeParse(id).success) throw Errors.notFound("Todo");
}

const todayUtc = () => dateOnlyToDb(new Date().toISOString().slice(0, 10));

function buildOrderBy(sort: ListTodosQuery["sort"], order: ListTodosQuery["order"]): Prisma.TodoOrderByWithRelationInput[] {
  // Tie-breakers keep the order total, so rows never repeat or vanish between pages.
  const tieBreak: Prisma.TodoOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "asc" }];
  switch (sort) {
    case "dueDate":
      return [{ dueDate: { sort: order, nulls: "last" } }, ...tieBreak];
    case "priority":
      // Postgres sorts enums by declaration order (low, medium, high), not alphabetically.
      return [{ priority: order }, ...tieBreak];
    case "title":
      return [{ title: order }, ...tieBreak];
    case "createdAt":
      return [{ createdAt: order }, { id: order }];
  }
}

export async function listTodos(userId: string, query: ListTodosQuery) {
  const where: Prisma.TodoWhereInput = { userId };
  if (query.status === "active") where.completed = false;
  if (query.status === "completed") where.completed = true;
  if (query.priority) where.priority = query.priority;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await db.$transaction([
    db.todo.count({ where }),
    db.todo.findMany({
      where,
      orderBy: buildOrderBy(query.sort, query.order),
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    data: rows.map(toPublicTodo),
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export async function createTodo(userId: string, input: CreateTodoInput) {
  const dueTime = input.dueTime ?? null;
  const dueTimezone = input.dueTimezone ?? null;
  const todo = await db.todo.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      dueDate: input.dueDate ? dateOnlyToDb(input.dueDate) : null,
      dueTime,
      dueTimezone,
      dueAt: getDueAt(input.dueDate, dueTime, dueTimezone),
      reminderPreference: input.reminderPreference,
    },
  });
  return toPublicTodo(todo);
}

export async function getTodo(userId: string, id: string) {
  assertId(id);
  const todo = await db.todo.findFirst({ where: { id, userId } });
  if (!todo) throw Errors.notFound("Todo");
  return toPublicTodo(todo);
}

export async function duplicateTodo(userId: string, id: string) {
  assertId(id);
  const source = await db.todo.findFirst({ where: { id, userId } });
  if (!source) throw Errors.notFound("Todo");

  const suffix = " (copy)";
  const title = `${Array.from(source.title).slice(0, 200 - suffix.length).join("").trimEnd()}${suffix}`;
  const duplicate = await db.todo.create({
    data: {
      userId,
      title,
      description: source.description,
      priority: source.priority,
      dueDate: source.dueDate,
      dueTime: source.dueTime,
      dueTimezone: source.dueTimezone,
      dueAt: source.dueAt,
      reminderPreference: source.reminderPreference,
    },
  });
  return toPublicTodo(duplicate);
}

export async function updateTodo(userId: string, id: string, input: UpdateTodoInput) {
  assertId(id);

  return db.$transaction(async (tx) => {
    const current = await tx.todo.findFirst({ where: { id, userId } });
    if (!current) throw Errors.notFound("Todo");

    const data: Prisma.TodoUpdateInput = { updatedAt: new Date() };
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    const scheduleChanged =
      input.dueDate !== undefined ||
      input.dueTime !== undefined ||
      input.dueTimezone !== undefined ||
      input.reminderPreference !== undefined;
    if (scheduleChanged) {
      const dueDate = input.dueDate === undefined ? current.dueDate?.toISOString().slice(0, 10) ?? null : input.dueDate;
      let dueTime = input.dueTime === undefined ? current.dueTime : input.dueTime;
      let dueTimezone = input.dueTimezone === undefined ? current.dueTimezone : input.dueTimezone;
      let reminderPreference = input.reminderPreference ?? current.reminderPreference;

      if (dueDate === null || dueTime === null) {
        dueTime = null;
        dueTimezone = null;
        reminderPreference = "none";
      }
      if (dueTime && (!dueDate || !dueTimezone)) {
        throw Errors.validation({ dueTime: ["A due time needs a due date and time zone."] });
      }
      if (reminderPreference !== "none" && (!dueDate || !dueTime || !dueTimezone)) {
        throw Errors.validation({ reminderPreference: ["Email reminders need a due date and time."] });
      }

      const dueAt = getDueAt(dueDate, dueTime, dueTimezone);
      if (dueAt && dueDate && dueTime && dueTimezone) {
        const localDateTime = `${dueDate}T${dueTime}:00`;
        if (formatInTimeZone(dueAt, dueTimezone, "yyyy-MM-dd'T'HH:mm:ss") !== localDateTime) {
          throw Errors.validation({ dueTime: ["That local time does not exist because of a clock change."] });
        }
      }

      data.dueDate = dueDate ? dateOnlyToDb(dueDate) : null;
      data.dueTime = dueTime;
      data.dueTimezone = dueTimezone;
      data.dueAt = dueAt;
      data.reminderPreference = reminderPreference;
      data.reminder30mSentAt = null;
      data.reminderDueSentAt = null;
    }
    // completedAt only moves when `completed` actually changes.
    if (input.completed !== undefined && input.completed !== current.completed) {
      data.completed = input.completed;
      data.completedAt = input.completed ? new Date() : null;
      if (!input.completed) {
        data.reminder30mSentAt = null;
        data.reminderDueSentAt = null;
      }
    }

    const todo = await tx.todo.update({ where: { id, userId }, data });
    return toPublicTodo(todo);
  });
}

function getDueAt(dueDate?: string | null, dueTime?: string | null, dueTimezone?: string | null): Date | null {
  if (!dueDate || !dueTime || !dueTimezone) return null;
  return fromZonedTime(`${dueDate}T${dueTime}:00`, dueTimezone);
}

export async function deleteTodo(userId: string, id: string) {
  assertId(id);
  const { count } = await db.todo.deleteMany({ where: { id, userId } });
  if (count === 0) throw Errors.notFound("Todo");
}

export async function deleteCompleted(userId: string) {
  const { count } = await db.todo.deleteMany({ where: { userId, completed: true } });
  return { deleted: count };
}

export async function getStats(userId: string) {
  const [total, completed, overdue] = await db.$transaction([
    db.todo.count({ where: { userId } }),
    db.todo.count({ where: { userId, completed: true } }),
    db.todo.count({ where: { userId, completed: false, dueDate: { lt: todayUtc() } } }),
  ]);
  return { total, active: total - completed, completed, overdue };
}
