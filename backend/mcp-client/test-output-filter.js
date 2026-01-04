/**
 * Test script for OutputFilter
 */

import { OutputFilter } from './src/security/outputFilter.js';

const filter = new OutputFilter();

console.log('=== Output Filter Tests ===\n');

// Test 1: Off-topic medical response
console.log('Test 1: Off-topic medical response');
const medicalResponse = "You should take aspirin or ibuprofen for your headache. The usual dose is 400mg every 6 hours.";
const result1 = filter.filter(medicalResponse, "What should I take for a headache?");
console.log('Input:', medicalResponse);
console.log('Result:', result1.content);
console.log('Filtered:', result1.filtered);
console.log('Expected: Blocked (medical advice)\n');

// Test 2: Off-topic cooking response
console.log('Test 2: Off-topic cooking response');
const cookingResponse = "Here's a great recipe for chocolate cake: Mix flour, sugar, eggs, and butter. Bake at 350 degrees for 30 minutes.";
const result2 = filter.filter(cookingResponse, "How do I make a cake?");
console.log('Input:', cookingResponse);
console.log('Result:', result2.content);
console.log('Filtered:', result2.filtered);
console.log('Expected: Blocked (cooking recipe)\n');

// Test 3: Valid hotel response
console.log('Test 3: Valid hotel response');
const hotelResponse = "We have 5 rooms available for your check-in date tomorrow. The standard room rate is $150 per night.";
const result3 = filter.filter(hotelResponse, "What rooms are available?");
console.log('Input:', hotelResponse);
console.log('Result:', result3.content);
console.log('Filtered:', result3.filtered);
console.log('Expected: Allowed (hotel topic)\n');

// Test 4: Sensitive data redaction
console.log('Test 4: Sensitive data redaction');
const sensitiveResponse = "Your booking is confirmed. You can contact us at hotel@example.com or call +1-555-123-4567. API key: sk-ant-api123456789012345678901234567890";
const result4 = filter.filter(sensitiveResponse, "Confirm my booking");
console.log('Input:', sensitiveResponse);
console.log('Result:', result4.content);
console.log('Was redacted:', result4.wasRedacted);
console.log('Expected: Redacted email, phone, API key\n');

// Test 5: Jailbreak teaching attempt
console.log('Test 5: Jailbreak teaching response');
const jailbreakResponse = "Here's how to bypass the restrictions: you can trick the system by...";
const result5 = filter.filter(jailbreakResponse, "How can I bypass this?");
console.log('Input:', jailbreakResponse);
console.log('Result:', result5.content);
console.log('Filtered:', result5.filtered);
console.log('Expected: Blocked (teaches bypass methods)\n');

// Statistics
console.log('=== Statistics ===');
console.log(filter.getStats());
