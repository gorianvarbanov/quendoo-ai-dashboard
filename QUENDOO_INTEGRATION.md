# Quendoo AI Chatbot Integration Guide

This guide explains how to embed the Quendoo AI Chatbot into your Quendoo admin panel.

## Overview

The chatbot can be embedded as an iframe and will automatically receive the Quendoo API key via PostMessage API for seamless integration.

## Integration Steps

### 1. Embed the Chatbot in Your Admin Panel

Add this HTML to your admin panel page:

```html
<!-- Quendoo AI Chatbot -->
<div id="quendoo-chatbot-container" style="width: 100%; height: 600px;">
  <iframe
    id="quendoo-chatbot-iframe"
    src="https://quendoo-ai-dashboard.web.app"
    style="width: 100%; height: 100%; border: none; border-radius: 8px;"
    allow="clipboard-write"
  ></iframe>
</div>
```

### 2. Add Integration JavaScript

Add this JavaScript code to send the API key to the chatbot:

```javascript
<script>
(function() {
  // Get the iframe element
  const chatbotIframe = document.getElementById('quendoo-chatbot-iframe');

  // Your Quendoo API key (retrieve from your backend/session)
  // IMPORTANT: Never hardcode the API key in frontend code!
  // This should come from your backend via PHP/session
  const quendooApiKey = '<?php echo $_SESSION['quendoo_api_key']; ?>';

  // Optional: Additional context
  const hotelId = '<?php echo $_SESSION['hotel_id']; ?>';
  const userId = '<?php echo $_SESSION['user_id']; ?>';

  // Wait for chatbot to be ready
  let chatbotReady = false;

  window.addEventListener('message', function(event) {
    // Security: Verify the message is from the chatbot
    if (event.origin !== 'https://quendoo-ai-dashboard.web.app') {
      return;
    }

    // Handle chatbot ready message
    if (event.data.type === 'CHATBOT_READY') {
      console.log('Chatbot is ready');
      chatbotReady = true;

      // Send API key and configuration to chatbot
      sendConfigToChatbot();
    }

    // Handle confirmation messages
    if (event.data.type === 'QUENDOO_API_KEY_RECEIVED') {
      console.log('Chatbot received API key:', event.data.success);
    }

    if (event.data.type === 'QUENDOO_CONFIG_RECEIVED') {
      console.log('Chatbot received configuration:', event.data.success);
    }
  });

  // Send configuration to chatbot
  function sendConfigToChatbot() {
    if (!chatbotReady) {
      console.warn('Chatbot not ready yet');
      return;
    }

    // Option 1: Send only API key
    chatbotIframe.contentWindow.postMessage({
      type: 'QUENDOO_API_KEY',
      apiKey: quendooApiKey
    }, 'https://quendoo-ai-dashboard.web.app');

    // Option 2: Send full configuration (recommended)
    /*
    chatbotIframe.contentWindow.postMessage({
      type: 'QUENDOO_CONFIG',
      apiKey: quendooApiKey,
      hotelId: hotelId,
      userId: userId
    }, 'https://quendoo-ai-dashboard.web.app');
    */
  }

  // Also try sending immediately (in case chatbot loads before this script)
  chatbotIframe.addEventListener('load', function() {
    setTimeout(function() {
      if (!chatbotReady) {
        chatbotReady = true;
        sendConfigToChatbot();
      }
    }, 1000);
  });
})();
</script>
```

## PHP Backend Example

Here's how to securely pass the API key from your PHP backend:

```php
<?php
// admin/chatbot.php

// Make sure user is authenticated
session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: /login.php');
    exit;
}

// Retrieve the user's Quendoo API key from database
$userId = $_SESSION['user_id'];
$db = new PDO('mysql:host=localhost;dbname=quendoo', 'user', 'password');
$stmt = $db->prepare('SELECT api_key, hotel_id FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

// Store in session for JavaScript access
$_SESSION['quendoo_api_key'] = $user['api_key'];
$_SESSION['hotel_id'] = $user['hotel_id'];
?>

<!DOCTYPE html>
<html>
<head>
    <title>Quendoo AI Co-Pilot</title>
</head>
<body>
    <h1>Quendoo AI Co-Pilot</h1>

    <!-- Embed chatbot -->
    <div id="quendoo-chatbot-container" style="width: 100%; height: 600px;">
      <iframe
        id="quendoo-chatbot-iframe"
        src="https://quendoo-ai-dashboard.web.app"
        style="width: 100%; height: 100%; border: none; border-radius: 8px;"
        allow="clipboard-write"
      ></iframe>
    </div>

    <!-- Integration script (see above) -->
    <script>
    // ... (integration JavaScript from above)
    </script>
</body>
</html>
```

## Security Considerations

### 1. Origin Validation

The chatbot only accepts messages from trusted origins:
- `https://quendoo.com`
- `https://www.quendoo.com`
- `https://admin.quendoo.com`
- `http://localhost` (for development)

Make sure your domain is in the trusted list.

### 2. Never Hardcode API Keys

❌ **NEVER do this:**
```javascript
const quendooApiKey = 'hardcoded-api-key-12345';
```

✅ **Always do this:**
```javascript
const quendooApiKey = '<?php echo $_SESSION['quendoo_api_key']; ?>';
```

### 3. HTTPS Only in Production

Always use HTTPS for production deployments to prevent man-in-the-middle attacks.

## Message Protocol

### Messages FROM Quendoo Admin → Chatbot

#### 1. Send API Key Only
```javascript
{
  type: 'QUENDOO_API_KEY',
  apiKey: 'user-api-key-here'
}
```

#### 2. Send Full Configuration (Recommended)
```javascript
{
  type: 'QUENDOO_CONFIG',
  apiKey: 'user-api-key-here',
  hotelId: 'hotel-123',
  userId: 'user-456'
}
```

### Messages FROM Chatbot → Quendoo Admin

#### 1. Chatbot Ready
```javascript
{
  type: 'CHATBOT_READY'
}
```

#### 2. API Key Received
```javascript
{
  type: 'QUENDOO_API_KEY_RECEIVED',
  success: true
}
```

#### 3. Config Received
```javascript
{
  type: 'QUENDOO_CONFIG_RECEIVED',
  success: true
}
```

## Testing the Integration

### Local Testing

For local development, you can test with:

1. Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Chatbot Integration</title>
</head>
<body>
    <h1>Test Quendoo AI Chatbot</h1>

    <div style="margin-bottom: 20px;">
        <label>Quendoo API Key:</label>
        <input type="text" id="apiKeyInput" style="width: 400px;" placeholder="Enter your API key">
        <button onclick="sendApiKey()">Send to Chatbot</button>
    </div>

    <div id="quendoo-chatbot-container" style="width: 100%; height: 600px; border: 1px solid #ccc;">
      <iframe
        id="quendoo-chatbot-iframe"
        src="http://localhost:3007"
        style="width: 100%; height: 100%; border: none;"
        allow="clipboard-write"
      ></iframe>
    </div>

    <script>
        const chatbotIframe = document.getElementById('quendoo-chatbot-iframe');
        let chatbotReady = false;

        window.addEventListener('message', function(event) {
            console.log('Received message:', event.data);

            if (event.data.type === 'CHATBOT_READY') {
                console.log('✅ Chatbot is ready!');
                chatbotReady = true;
            }

            if (event.data.type === 'QUENDOO_API_KEY_RECEIVED') {
                console.log('✅ API key received by chatbot!');
                alert('API key successfully sent to chatbot!');
            }
        });

        function sendApiKey() {
            const apiKey = document.getElementById('apiKeyInput').value;

            if (!apiKey) {
                alert('Please enter an API key');
                return;
            }

            console.log('Sending API key to chatbot...');

            chatbotIframe.contentWindow.postMessage({
                type: 'QUENDOO_API_KEY',
                apiKey: apiKey
            }, '*');
        }

        // Auto-send after 2 seconds for testing
        setTimeout(function() {
            if (chatbotReady) {
                console.log('Auto-sending test API key...');
                // Uncomment to auto-send:
                // document.getElementById('apiKeyInput').value = 'test-api-key-123';
                // sendApiKey();
            }
        }, 2000);
    </script>
</body>
</html>
```

2. Open this file in your browser
3. Enter a test API key and click "Send to Chatbot"
4. Check the browser console for confirmation messages

### Production Testing

1. Deploy the chatbot to Firebase Hosting
2. Add your domain to the trusted origins list (in App.vue)
3. Test the integration in your admin panel
4. Verify the API key is received (check browser console)

## Troubleshooting

### Issue: Chatbot not receiving API key

**Check:**
1. Is the iframe fully loaded? (Add `load` event listener)
2. Is the origin correct? (Check console for security warnings)
3. Is the message format correct? (See message protocol above)

**Solution:**
```javascript
chatbotIframe.addEventListener('load', function() {
  setTimeout(sendConfigToChatbot, 1000); // Wait 1 second after load
});
```

### Issue: CORS or security errors

**Check:**
1. Are you using HTTPS? (Required in production)
2. Is your domain in the trusted origins list?
3. Are you sending to the correct origin?

**Solution:**
Update the trusted origins in `frontend/src/App.vue`:
```javascript
const trustedOrigins = [
  'https://quendoo.com',
  'https://your-domain.com' // Add your domain
]
```

### Issue: API key not persisting

**Check:**
1. Is localStorage enabled in the browser?
2. Are there any JavaScript errors?

**Solution:**
Open browser DevTools → Application → Local Storage → Check for `quendoo-settings`

## Support

For integration support, contact the Quendoo development team or check the project repository:
- GitHub: [github.com/gorianvarbanov/quendoo-ai-dashboard](https://github.com/gorianvarbanov/quendoo-ai-dashboard)

## Changelog

- **v1.0** - Initial PostMessage integration
  - Auto-receive API key from parent window
  - Support for QUENDOO_API_KEY and QUENDOO_CONFIG messages
  - Security: Origin validation
  - Confirmation messages back to parent
