const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendNewCandidateNotification(candidate, offerTitle) {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail || !process.env.SMTP_HOST) {
    console.log('[Mailer] SMTP not configured — skipping email notification');
    return;
  }

  try {
    const fields = [
      `Name: ${candidate.name}`,
      `Phone: ${candidate.phone}`,
      `Graduation: ${candidate.graduation}`,
      `Experience: ${candidate.experience}`,
      `Language: ${candidate.language}`,
      `Language Level: ${candidate.languageLevel}`,
      `Nationality: ${candidate.nationality}`,
      `Offer: ${offerTitle || candidate.offer}`,
      `Recording: ${candidate.recordingUrl}`,
      `Submitted: ${candidate.createdAt}`,
    ];

    await getTransporter().sendMail({
      from: process.env.SMTP_USER,
      to: notifyEmail,
      subject: `New Candidate Submission — ${candidate.name}`,
      text: `A new candidate has submitted an application.\n\n${fields.join('\n')}`,
    });

    console.log('[Mailer] Notification sent to', notifyEmail);
  } catch (err) {
    console.error('[Mailer] Failed to send email:', err.message);
  }
}

module.exports = { sendNewCandidateNotification };
