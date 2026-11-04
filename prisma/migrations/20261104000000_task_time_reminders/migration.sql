CREATE TYPE "ReminderPreference" AS ENUM ('none', 'at_due', 'thirty_minutes_before', 'both');

ALTER TABLE "todos"
ADD COLUMN "due_time" VARCHAR(5),
ADD COLUMN "due_timezone" VARCHAR(64),
ADD COLUMN "due_at" TIMESTAMPTZ(3),
ADD COLUMN "reminder_preference" "ReminderPreference" NOT NULL DEFAULT 'none',
ADD COLUMN "reminder_30m_sent_at" TIMESTAMPTZ(3),
ADD COLUMN "reminder_due_sent_at" TIMESTAMPTZ(3);

CREATE INDEX "todos_due_at_completed_idx" ON "todos"("due_at", "completed");