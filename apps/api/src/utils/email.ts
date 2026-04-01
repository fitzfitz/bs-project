import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { logger } from "./logger";

const log = logger.child({ module: "email" });

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Attachment[];
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    log.warn("SMTP not configured — emails will be skipped");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: port ? parseInt(port, 10) : 587,
    secure: port === "465",
    auth: { user, pass },
  });

  return transporter;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    log.info({ to: opts.to, subject: opts.subject }, "Email skipped (SMTP not configured)");
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments,
    });
    log.info({ to: opts.to, subject: opts.subject }, "Email sent");
    return true;
  } catch (err) {
    log.error({ err, to: opts.to }, "Email send failed");
    return false;
  }
}
