import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { TaskReminder } from "@/lib/email/templates";

const BATCH_SIZE = 25;
const REMINDER_WINDOW_MS = 30 * 60 * 1000;
const CRON_WINDOW_MS = 60 * 1000;

type ReminderCandidate = {
  id: string;
  email: string;
  title: string;
  due_at: Date;
  due_timezone: string;
  kind: "at_due" | "thirty_minutes_before";
};

export async function sendDueReminders() {
  const now = new Date();
  const reminderWindowStart = new Date(now.getTime() + REMINDER_WINDOW_MS - CRON_WINDOW_MS);
  const reminderWindowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  return db.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<ReminderCandidate[]>`
      SELECT t.id, u.email, t.title, t.due_at, t.due_timezone,
        CASE
          WHEN t.reminder_preference::text IN ('thirty_minutes_before', 'both')
            AND t.due_at > ${reminderWindowStart}
            AND t.due_at <= ${reminderWindowEnd}
            AND t.reminder_30m_sent_at IS NULL
          THEN 'thirty_minutes_before'
          ELSE 'at_due'
        END AS kind
      FROM todos t
      JOIN users u ON u.id = t.user_id
      WHERE t.completed = false
        AND t.due_at IS NOT NULL
        AND (
          (t.reminder_preference::text IN ('thirty_minutes_before', 'both')
            AND t.due_at > ${reminderWindowStart}
            AND t.due_at <= ${reminderWindowEnd}
            AND t.reminder_30m_sent_at IS NULL)
          OR
          (t.reminder_preference::text IN ('at_due', 'both')
            AND t.due_at <= ${now}
            AND t.reminder_due_sent_at IS NULL)
        )
      ORDER BY t.due_at ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE OF t SKIP LOCKED`;

    let sent = 0;
    let failed = 0;
    for (const candidate of candidates) {
      const dueAtText = formatInTimeZone(candidate.due_at, candidate.due_timezone, "EEE, MMM d 'at' h:mm a zzz");
      const kind = candidate.kind;
      const delivered = await sendEmail({
        to: candidate.email,
        type: "reminder",
        subject: kind === "at_due" ? `Task due: ${candidate.title}` : `Due in 30 minutes: ${candidate.title}`,
        react: TaskReminder({ title: candidate.title, dueAtText, kind, appUrl: env.APP_URL }),
      });

      if (!delivered) {
        failed += 1;
        continue;
      }

      await tx.todo.update({
        where: { id: candidate.id },
        data: kind === "at_due" ? { reminderDueSentAt: now } : { reminder30mSentAt: now },
      });
      sent += 1;
    }

    return { checked: candidates.length, sent, failed };
  });
}