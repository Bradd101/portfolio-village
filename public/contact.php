<?php
/**
 * Contact form endpoint. Speaks SMTP directly over a socket (STARTTLS + AUTH LOGIN)
 * so this runs on plain shared hosting with no Composer/PHPMailer dependency.
 */

require __DIR__ . '/cors.php';

header('Content-Type: application/json');
send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$configPath = __DIR__ . '/mail-config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Mail is not configured on this server yet.']);
    exit;
}
$config = require $configPath;

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$name = trim((string)($input['name'] ?? ''));
$email = trim((string)($input['email'] ?? ''));
$message = trim((string)($input['message'] ?? ''));
$honeypot = trim((string)($input['website'] ?? '')); // hidden field; bots fill it, humans don't

if ($honeypot !== '') {
    // Silently pretend success so the bot moves on.
    echo json_encode(['ok' => true]);
    exit;
}

if ($name === '' || $email === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please fill in your name, email and message.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'That email address does not look valid.']);
    exit;
}

if (mb_strlen($message) > 5000) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Message is too long.']);
    exit;
}

// Strip CR/LF from header-bound fields to block SMTP header injection.
$stripCrlf = fn($s) => str_replace(["\r", "\n"], '', $s);
$name = $stripCrlf($name);
$email = $stripCrlf($email);

try {
    send_via_smtp($config, $name, $email, $message);
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(502);
    error_log('[contact.php] send failed: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'error' => 'Could not send your message right now. Please try again later.']);
}

/**
 * @throws RuntimeException on any SMTP-level failure
 */
function send_via_smtp(array $config, string $fromName, string $fromEmail, string $message): void
{
    $host = $config['smtp_host'];
    $port = (int)$config['smtp_port'];
    $user = $config['smtp_user'];
    $pass = $config['smtp_pass'];
    $toEmail = $config['to_email'];
    $toName = $config['to_name'];
    $envelopeFromEmail = $config['from_email'];
    $envelopeFromName = $config['from_name'];

    $timeout = 15;
    $socket = @stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, $timeout);
    if (!$socket) {
        throw new RuntimeException("Could not connect to SMTP host: {$errstr} ({$errno})");
    }
    stream_set_timeout($socket, $timeout);

    $expect = function (string $contextLabel, array $okCodes) use ($socket) {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            // Multi-line SMTP replies use "250-" for continuation, "250 " for the last line.
            if (preg_match('/^\d{3} /', $line)) {
                break;
            }
        }
        $code = (int)substr($response, 0, 3);
        if (!in_array($code, $okCodes, true)) {
            throw new RuntimeException("SMTP error during {$contextLabel}: {$response}");
        }
        return $response;
    };

    $send = function (string $line) use ($socket) {
        fwrite($socket, $line . "\r\n");
    };

    $expect('connect', [220]);

    $send('EHLO portfolio-village');
    $expect('EHLO', [250]);

    $send('STARTTLS');
    $expect('STARTTLS', [220]);

    if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        throw new RuntimeException('TLS negotiation failed.');
    }

    $send('EHLO portfolio-village');
    $expect('EHLO after STARTTLS', [250]);

    $send('AUTH LOGIN');
    $expect('AUTH LOGIN', [334]);

    $send(base64_encode($user));
    $expect('AUTH username', [334]);

    $send(base64_encode($pass));
    $expect('AUTH password', [235]);

    $send("MAIL FROM:<{$envelopeFromEmail}>");
    $expect('MAIL FROM', [250]);

    $send("RCPT TO:<{$toEmail}>");
    $expect('RCPT TO', [250, 251]);

    $send('DATA');
    $expect('DATA', [354]);

    $subject = "Village contact form: message from {$fromName}";
    $bodyEscaped = str_replace("\n", "\r\n", wordwrap($message, 72));
    // RFC 5321 dot-stuffing: a line that is just "." would otherwise end the
    // DATA section early and let the rest of the message be read back as
    // SMTP commands, so any line starting with "." gets a second "." added.
    $bodyEscaped = preg_replace('/^\./m', '..', $bodyEscaped);

    $headers = [
        "From: {$envelopeFromName} <{$envelopeFromEmail}>",
        "Reply-To: {$fromName} <{$fromEmail}>",
        "To: {$toName} <{$toEmail}>",
        "Subject: {$subject}",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Date: ' . date('r'),
    ];

    $data = implode("\r\n", $headers) . "\r\n\r\n" . $bodyEscaped . "\r\n.";
    $send($data);
    $expect('message body', [250]);

    $send('QUIT');
    fclose($socket);
}
