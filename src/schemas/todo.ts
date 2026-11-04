import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const PRIORITIES = ["low", "medium", "high"] as const;
export const REMINDER_PREFERENCES = ["none", "at_due", "thirty_minutes_before", "both"] as const;

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

const dueTimeSchema = z
  .string({ error: "Use a time like 09:30." })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time like 09:30.")
  .nullable()
  .optional();

const dueTimezoneSchema = z
  .string({ error: "Choose a valid time zone." })
  .max(64, "Time zone is too long.")
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone.")
  .nullable()
  .optional();

const reminderPreferenceSchema = z.enum(REMINDER_PREFERENCES, { error: "Choose a valid reminder option." });

function validateCreateSchedule(
  input: { dueDate?: string | null; dueTime?: string | null; dueTimezone?: string | null; reminderPreference: string },
  ctx: z.RefinementCtx,
) {
  if (input.dueTime && !input.dueDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Add a due date before setting a due time." });
  }
  if (input.dueTime && !input.dueTimezone) {
    ctx.addIssue({ code: "custom", path: ["dueTimezone"], message: "A time zone is required with a due time." });
  }
  if (!input.dueTime && input.dueTimezone) {
    ctx.addIssue({ code: "custom", path: ["dueTimezone"], message: "A time zone is only used with a due time." });
  }
  const parsedDate = typeof input.dueDate === "string" ? new Date(`${input.dueDate}T00:00:00.000Z`) : null;
  const validDate =
    !!parsedDate &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === input.dueDate;
  const validTime = typeof input.dueTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.dueTime);
  let validTimezone = false;
  if (input.dueTimezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.dueTimezone });
      validTimezone = true;
    } catch {
      validTimezone = false;
    }
  }
  if (input.dueDate && input.dueTime && input.dueTimezone && validDate && validTime && validTimezone) {
    const localDateTime = `${input.dueDate}T${input.dueTime}:00`;
    const instant = fromZonedTime(localDateTime, input.dueTimezone);
    if (formatInTimeZone(instant, input.dueTimezone, "yyyy-MM-dd'T'HH:mm:ss") !== localDateTime) {
      ctx.addIssue({ code: "custom", path: ["dueTime"], message: "That local time does not exist because of a clock change." });
    }
  }
  if (input.reminderPreference !== "none" && (!input.dueDate || !input.dueTime)) {
    ctx.addIssue({ code: "custom", path: ["reminderPreference"], message: "Email reminders need a due date and time." });
  }
}

export const createTodoSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  priority: prioritySchema.default("medium"),
  dueDate: dueDateSchema,
  dueTime: dueTimeSchema,
  dueTimezone: dueTimezoneSchema,
  reminderPreference: reminderPreferenceSchema.default("none"),
}).superRefine(validateCreateSchedule);

export const updateTodoSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema,
  priority: prioritySchema.optional(),
  dueDate: dueDateSchema,
  dueTime: dueTimeSchema,
  dueTimezone: dueTimezoneSchema,
  reminderPreference: reminderPreferenceSchema.optional(),
  completed: z.boolean({ error: "Completed must be true or false." }).optional(),
}).superRefine((input, ctx) => {
  if (input.dueDate === null && input.dueTime) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "A due time needs a due date." });
  }
  if (input.dueTimezone === null && input.dueTime) {
    ctx.addIssue({ code: "custom", path: ["dueTimezone"], message: "A due time needs a time zone." });
  }
  if (input.reminderPreference && input.reminderPreference !== "none" && (input.dueDate === null || input.dueTime === null)) {
    ctx.addIssue({ code: "custom", path: ["reminderPreference"], message: "Email reminders need a due date and time." });
  }
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
