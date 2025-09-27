// functions/lib/mailer.js
import nodemailer from 'nodemailer';

export function makeTransport() {
  const { MAIL_USER, MAIL_PASS } = process.env;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: MAIL_USER, pass: MAIL_PASS },
  });
}
export async function sendCodeMail(toEmail, code, fileName) {
  const transporter = makeTransport();
  const html = `
    <p>รหัสเข้าดูไฟล์ <b>${fileName || ''}</b></p>
    <h2 style="letter-spacing:3px">${code}</h2>
    <p>รหัสมีอายุ 10 นาที และใช้ได้ครั้งเดียว</p>
  `;
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: toEmail,
    subject: `รหัสเข้าดูไฟล์ (10 นาที)`,
    html,
  });
}
