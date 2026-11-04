import { EmailLayout } from "./layout";

export function VerifyEmail({ name, url }: { name: string; url: string }) {
  return (
    <EmailLayout
      preview="Confirm your email to start using Tasks"
      heading={`Welcome, ${name}`}
      text="Confirm your email address to finish setting up your account."
      action={{ label: "Verify email", url }}
      note="This link works for 24 hours. If you didn't sign up, you can ignore this email."
    />
  );
}

export function ResetPassword({ name, url }: { name: string; url: string }) {
  return (
    <EmailLayout
      preview="Reset your Tasks password"
      heading="Reset your password"
      text={`Hi ${name}, we got a request to reset your password. Choose a new one below.`}
      action={{ label: "Reset password", url }}
      note="This link works for 1 hour and only once. If you didn't ask for this, you can ignore this email."
    />
  );
}

export function PasswordChanged({ name, appUrl }: { name: string; appUrl: string }) {
  return (
    <EmailLayout
      preview="Your Tasks password was changed"
      heading="Your password was changed"
      text={`Hi ${name}, the password for your account was just changed and every device was signed out.`}
      action={{ label: "Log in", url: `${appUrl}/login` }}
      note="If this wasn't you, reset your password right away using “Forgot password” on the login page."
    />
  );
}

export function TaskReminder({
  title,
  dueAtText,
  kind,
  appUrl,
}: {
  title: string;
  dueAtText: string;
  kind: "at_due" | "thirty_minutes_before";
  appUrl: string;
}) {
  const timing = kind === "at_due" ? "is due now" : "is due in 30 minutes";
  return (
    <EmailLayout
      preview={`${title} ${timing}`}
      heading="Task reminder"
      text={`“${title}” ${timing}. Scheduled for ${dueAtText}.`}
      action={{ label: "Open your tasks", url: `${appUrl}/todos` }}
      note="You chose to receive this reminder in your Tasks account. You can change reminder settings by editing the task."
    />
  );
}
