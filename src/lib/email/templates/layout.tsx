import { Body, Button, Container, Heading, Html, Link, Preview, Text } from "@react-email/components";

const styles = {
  body: { backgroundColor: "#f6f7f9", fontFamily: "Helvetica, Arial, sans-serif", padding: "24px 0" },
  container: { backgroundColor: "#ffffff", borderRadius: "8px", padding: "32px", maxWidth: "480px" },
  heading: { fontSize: "22px", color: "#111827", margin: "0 0 16px" },
  text: { fontSize: "15px", color: "#374151", lineHeight: "22px" },
  button: { backgroundColor: "#111827", color: "#ffffff", borderRadius: "6px", padding: "12px 20px", fontSize: "15px" },
  small: { fontSize: "13px", color: "#6b7280", lineHeight: "20px" },
  link: { color: "#2563eb", wordBreak: "break-all" as const },
};

/** Shared shell: heading, one sentence, an optional button with the plain link below it, and a footnote. */
export function EmailLayout(props: {
  preview: string;
  heading: string;
  text: string;
  action?: { label: string; url: string };
  note?: string;
}) {
  return (
    <Html>
      <Preview>{props.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{props.heading}</Heading>
          <Text style={styles.text}>{props.text}</Text>
          {props.action && (
            <>
              <Button href={props.action.url} style={styles.button}>
                {props.action.label}
              </Button>
              <Text style={styles.small}>
                If the button doesn&apos;t work, paste this link into your browser:
                <br />
                <Link href={props.action.url} style={styles.link}>
                  {props.action.url}
                </Link>
              </Text>
            </>
          )}
          {props.note && <Text style={styles.small}>{props.note}</Text>}
        </Container>
      </Body>
    </Html>
  );
}
