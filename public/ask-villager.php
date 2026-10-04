<?php
/**
 * AI villager endpoint. Calls Google's Gemini API server-side so the key
 * never reaches the browser, and does a light per-session rate limit so a
 * runaway script can't rack up API cost.
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

$configPath = __DIR__ . '/ai-config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'The villager is still asleep (AI not configured on this server yet).']);
    exit;
}
$config = require $configPath;

// IP-based limit first. The session limit below is easy to dodge by just not
// sending cookies, so this is the real backstop on API cost.
check_ip_rate_limit(40, 600);

// --- light per-session rate limit: 20 questions per 10 minutes ---
session_start();
$now = time();
$window = 600;
$limit = 20;
if (!isset($_SESSION['villager_hits']) || $now - ($_SESSION['villager_window_start'] ?? 0) > $window) {
    $_SESSION['villager_hits'] = 0;
    $_SESSION['villager_window_start'] = $now;
}
if ($_SESSION['villager_hits'] >= $limit) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => "That's a lot of questions! Give the villager a few minutes to catch their breath."]);
    exit;
}
$_SESSION['villager_hits']++;

/**
 * Per-IP limit backed by a temp file, since a scripted client can trivially
 * avoid the session based limiter above by dropping cookies between requests.
 */
function check_ip_rate_limit(int $limit, int $windowSeconds): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = sys_get_temp_dir() . '/portfolio_village_rl_' . md5($ip) . '.json';
    $now = time();

    $state = ['count' => 0, 'start' => $now];
    if (is_file($file)) {
        $decoded = json_decode((string)file_get_contents($file), true);
        if (is_array($decoded) && $now - ($decoded['start'] ?? 0) < $windowSeconds) {
            $state = $decoded;
        }
    }

    $state['count']++;
    file_put_contents($file, json_encode($state));

    if ($state['count'] > $limit) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => "That's a lot of questions! Give the villager a few minutes to catch their breath."]);
        exit;
    }
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$question = trim((string)($input['question'] ?? ''));

if ($question === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Ask the villager something first!']);
    exit;
}
if (mb_strlen($question) > 500) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'That question is a bit long, try something shorter.']);
    exit;
}

$systemPrompt = build_system_prompt();

try {
    $reply = ask_gemini($config, $systemPrompt, $question);
    echo json_encode(['ok' => true, 'reply' => $reply]);
} catch (Throwable $e) {
    http_response_code(502);
    error_log('[ask-villager.php] ' . $e->getMessage());
    echo json_encode(['ok' => false, 'error' => "The villager didn't quite catch that. Try again in a moment."]);
}

/**
 * Keep this in sync with src/content.ts. Plain-text mirror of the same
 * bio facts, used only to ground the AI's answers.
 */
function build_system_prompt(): string
{
    $facts = <<<FACTS
Name: Bradley France
Role: Full Stack Developer

About: Bradley is a full stack developer passionate about technology, who builds
home projects to learn new languages (Python, Java, C#, JavaScript) and runs a
small web design and hosting business as a weekend side project. Background
includes networking/infrastructure (Cisco, Active Directory, VMware).

Current work: Full Stack Developer at Cyncly (2022-present), US Website Team.
TypeScript, Node.js, NestJS, React and C# within a containerised monorepo
serving CMS, ERP and other business-critical systems across international
markets; Docker-based dev/test/deploy workflows, architectural work on
modularisation and performance. Also Software Developer & eStore Specialist at
Cyncly, senior technical lead for a high-traffic custom CMS (PHP, JavaScript,
MySQL), plus Azure-hosted Linux (CentOS) infrastructure: patch management,
monitoring/backups, CI/CD via Azure DevOps, PCI DSS/GDPR compliance including
penetration-test coordination, and over £45,000/year in infrastructure savings.

Previous roles: Technical Support & Infrastructure Engineer at 20i (Aug 2021 -
Jul 2022), 24/7 hosting support with root access, BASH automation, MySQL
troubleshooting, REST API incident investigation, Nagios monitoring, email/SSL
administration. Data Infrastructure Engineer at Phoenix Networks (Jan 2021 -
Aug 2021), field deployment of network/security systems: structured cabling,
Cisco switch/router configuration, Paxton access control and Hikvision CCTV
installs.

Skills: TypeScript, Node.js, NestJS, React, C#, PHP, MySQL, Docker, Azure,
Linux, BASH, REST APIs, Cisco networking, Active Directory, VMware.

Hobbies: Old School RuneScape, music (old-school rap to 60s rock), previously
ice hockey and airsoft.

Contact: francebradley101@hotmail.co.uk, LinkedIn: bradley-france-477280231
FACTS;

    return "You are a friendly, slightly cheeky villager NPC living in Bradley France's "
        . "retro portfolio village. Visitors can ask you questions about Bradley. Answer "
        . "ONLY using the facts below, never invent experience, dates, employers, or skills "
        . "that aren't listed. Keep replies short: 1-3 sentences, warm and a little playful, "
        . "like an RPG villager chatting with a traveller. If asked something the facts don't "
        . "cover, say you're not sure and suggest checking the Town Hall (CV) or emailing "
        . "Bradley directly.\n\n" . $facts;
}

/**
 * @throws RuntimeException on any API-level failure
 */
function ask_gemini(array $config, string $systemPrompt, string $question): string
{
    $model = $config['model'];
    $apiKey = $config['gemini_api_key'];
    $maxTokens = $config['max_output_tokens'] ?? 350;

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

    $body = [
        'system_instruction' => [
            'parts' => ['text' => $systemPrompt],
        ],
        'contents' => [
            ['parts' => [['text' => $question]]],
        ],
        'generationConfig' => [
            'maxOutputTokens' => $maxTokens,
            'temperature' => 0.8,
        ],
    ];

    // Gemini's flash tier occasionally returns 503 UNAVAILABLE under load.
    // A couple of short, fast retries clear most of these transparently.
    $maxAttempts = 3;
    $response = false;
    $status = 0;
    $curlError = '';

    for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-goog-api-key: ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => json_encode($body),
            CURLOPT_TIMEOUT => 20,
        ]);

        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);

        if ($response !== false && $status !== 503) {
            break;
        }
        if ($attempt < $maxAttempts) {
            usleep(400000); // 400ms before retrying
        }
    }

    if ($response === false) {
        throw new RuntimeException("cURL error: {$curlError}");
    }
    if ($status !== 200) {
        throw new RuntimeException("Gemini returned HTTP {$status}: {$response}");
    }

    $data = json_decode($response, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

    if ($text === null) {
        $blockReason = $data['promptFeedback']['blockReason'] ?? null;
        throw new RuntimeException('No text in Gemini response' . ($blockReason ? " (blocked: {$blockReason})" : '') . ': ' . $response);
    }

    return trim($text);
}
