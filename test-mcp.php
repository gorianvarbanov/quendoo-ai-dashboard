<?php
/**
 * Test script to explore Quendoo MCP Server with different message formats
 */

$mcpUrl = 'https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse';

echo "=== Testing Quendoo MCP Server ===\n\n";
echo "Step 1: Getting session ID from SSE...\n";

// Get session ID from SSE
$ch = curl_init($mcpUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 3);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: text/event-stream',
    'Cache-Control: no-cache'
]);

ob_start();
curl_exec($ch);
$sseOutput = ob_get_clean();
curl_close($ch);

if (preg_match('/data: \/messages\/\?session_id=([a-f0-9]+)/', $sseOutput, $matches)) {
    $sessionId = $matches[1];
    echo "✓ Session ID: $sessionId\n\n";

    $messagesUrl = "https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/messages/?session_id=$sessionId";
    $message = "Give me the availability for January";

    // Try different formats
    $formats = [
        'JSON with message key' => json_encode(['message' => $message]),
        'JSON with content key' => json_encode(['content' => $message]),
        'JSON with text key' => json_encode(['text' => $message]),
        'JSON with query key' => json_encode(['query' => $message]),
        'Plain text' => $message,
    ];

    foreach ($formats as $formatName => $payload) {
        echo "Testing format: $formatName\n";
        echo "Payload: " . (strlen($payload) > 100 ? substr($payload, 0, 100) . '...' : $payload) . "\n";

        $ch2 = curl_init($messagesUrl);
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_POST, true);
        curl_setopt($ch2, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch2, CURLOPT_TIMEOUT, 15);

        $headers = ['Accept: application/json'];
        if (strpos($formatName, 'JSON') !== false) {
            $headers[] = 'Content-Type: application/json';
        } else {
            $headers[] = 'Content-Type: text/plain';
        }
        curl_setopt($ch2, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch2);
        $httpCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);

        echo "→ HTTP $httpCode: ";
        if ($httpCode == 200) {
            echo "✓ SUCCESS!\n";
            $decoded = json_decode($response, true);
            if ($decoded) {
                echo json_encode($decoded, JSON_PRETTY_PRINT) . "\n";
            } else {
                echo $response . "\n";
            }
            break; // Stop on first success
        } else {
            echo "$response\n";
        }
        echo "\n";
    }

} else {
    echo "✗ Could not extract session ID\n";
}

echo "\n=== Test Complete ===\n";
