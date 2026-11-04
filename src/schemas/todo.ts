import { z } from "zod";

export const PRIORITIES = ["low", "medium", "high"] as const;

const titleSchema = z
  .string({ error: "Give the task a title." })
  .trim()
  .min(1, "Give the task a title.")
  .max(200, "Keep the title under 200 characters.");

const prioritySchema = z.enum(PRIORITIES, { error: "Priority must be low, medium or high." });

/** Empty or whitespace-only becomes null. `undefined` stays undefined so PATCH can tell "not sent" from "clear it". */
const descriptionSchema = z
  .string({ error: "Description must be text or null." })
  .max(2000, "Keep the description under 2000 characters.")
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v?.trim() ? v.trim() : null));

/** `YYYY-MM-DD` that is a real calendar date. A regex alone would accept 2026-02-30. */
const dueDateSchema = z
  .string({ error: "Use a date like 2026-10-05, or null." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-05.")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "That date doesn't exist.")
  .nullable()
  .optional();

export const createTodoSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  priority: prioritySchema.default("medium"),
  dueDate: dueDateSchema,
});

export const updateTodoSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema,
  priority: prioritySchema.optional(),
  dueDate: dueDateSchema,
  completed: z.boolean({ error: "Completed must be true or false." }).optional(),
});

export const listTodosSchema = z.object({
  status: z.enum(["all", "active", "completed"], { error: "Status must be all, active or completed." }).default("all"),
  priority: prioritySchema.optional(),
  search: z
    .string()
    .trim()
    .max(200, "Search must be at most 200 characters.")
    .optional()
    .transform((v) => v || undefined),
  sort: z
    .enum(["createdAt", "dueDate", "priority", "title"], { error: "Sort must be createdAt, dueDate, priority or title." })
    .default("createdAt"),
  order: z.enum(["asc", "desc"], { error: "Order must be asc or desc." }).default("desc"),
  page: z.coerce.number({ error: "Page must be a whole number of 1 or more." })
    .int("Page must be a whole number of 1 or more.")
    .min(1, "Page must be a whole number of 1 or more.")
    .default(1),
  limit: z.coerce.number({ error: "Limit must be a whole number from 1 to 50." })
    .int("Limit must be a whole number from 1 to 50.")
    .min(1, "Limit must be a whole number from 1 to 50.")
    .max(50, "Limit must be a whole number from 1 to 50.")
    .default(10),
});

export const todoIdSchema = z.uuid();

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ListTodosQuery = z.infer<typeof listTodosSchema>;
