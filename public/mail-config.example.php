<?php
// Copy this file to mail-config.php (same folder) and fill in your real values.
// mail-config.php is gitignored on purpose, never commit real SMTP credentials.

return [
    'smtp_host' => 'smtp-relay.brevo.com',
    'smtp_port' => 587,
    'smtp_user' => 'your-brevo-smtp-login',
    'smtp_pass' => 'your-brevo-smtp-key',

    // Where contact form submissions get delivered.
    'to_email' => 'you@example.com',
    'to_name' => 'Your Name',

    // Must be a sender Brevo has verified on your account, or Brevo will reject the send.
    'from_email' => 'you@example.com',
    'from_name' => 'Portfolio Village',
];
