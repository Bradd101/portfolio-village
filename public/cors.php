<?php
/**
 * Shared CORS handling for the contact and villager endpoints. Only the real
 * site origin gets the response reflected back; everything else is left
 * without an Allow-Origin header, which stops a browser on another site from
 * reading the response (it can still fire the request, but can't see the
 * result, which is what actually matters for abuse like spoofed submissions
 * or silently burning the Gemini quota from someone else's page).
 */

function send_cors_headers(): void
{
    $allowedOrigins = [
        'https://bradthedev.co.uk',
        'https://www.bradthedev.co.uk',
        'http://localhost:5173',
        'http://localhost:5177',
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
