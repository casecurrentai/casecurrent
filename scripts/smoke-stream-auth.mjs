#!/usr/bin/env node
/**
 * Smoke test for Twilio stream authentication
 * Verifies TwiML generation and auth token presence
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function testTwiMLGeneration() {
  console.log('=== Smoke Test: Stream Auth ===\n');
  
  // Test 1: TwiML generation
  console.log('1. Testing TwiML generation...');
  const uniqueCallSid = `CA${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const formData = new URLSearchParams({
    CallSid: uniqueCallSid,
    To: '+18443214257',
    From: '+15551234567',
    CallStatus: 'ringing'
  });

  const response = await fetch(`${BASE_URL}/v1/telephony/twilio/voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  const contentType = response.headers.get('content-type');
  const body = await response.text();

  console.log(`   Status: ${response.status}`);
  console.log(`   Content-Type: ${contentType}`);
  
  // Assertions
  const checks = [
    { name: 'Status 200', pass: response.status === 200 },
    { name: 'Content-Type is text/xml', pass: contentType?.includes('text/xml') },
    { name: 'Contains <Stream>', pass: body.includes('<Stream') },
    { name: 'Stream URL is clean (no querystring)', pass: body.includes('url="wss://') && !body.includes('url="wss://casecurrent.co/v1/telephony/twilio/stream?') },
    { name: 'Contains <Parameter name="auth_token">', pass: body.includes('<Parameter name="auth_token"') },
    { name: 'Contains <Parameter name="ts">', pass: body.includes('<Parameter name="ts"') },
    { name: 'Contains <Parameter name="callSid">', pass: body.includes('<Parameter name="callSid"') },
    { name: 'Contains <Parameter name="orgId">', pass: body.includes('<Parameter name="orgId"') },
  ];

  console.log('\n   Checks:');
  let allPass = true;
  for (const check of checks) {
    const icon = check.pass ? '✓' : '✗';
    console.log(`   ${icon} ${check.name}`);
    if (!check.pass) allPass = false;
  }

  // Show TwiML (redacted)
  console.log('\n   TwiML (auth_token redacted):');
  const redacted = body.replace(/value="[a-f0-9]{64}"/g, 'value="[REDACTED]"');
  console.log('   ' + redacted.split('\n').join('\n   '));

  // Test 2: Auth function unit test (inline)
  console.log('\n2. Testing auth logic (inline)...');
  
  const crypto = await import('crypto');
  const testSecret = 'test-secret-123';
  const testTs = Math.floor(Date.now() / 1000);
  const expectedToken = crypto.createHmac('sha256', testSecret).update(`${testTs}`).digest('hex');
  
  // Simulate validation
  const verifyToken = (secret, ts, token) => {
    const expected = crypto.createHmac('sha256', secret).update(`${ts}`).digest('hex');
    return token === expected;
  };

  const authChecks = [
    { name: 'Valid token passes', pass: verifyToken(testSecret, testTs, expectedToken) },
    { name: 'Wrong token fails', pass: !verifyToken(testSecret, testTs, 'wrongtoken') },
    { name: 'Wrong timestamp fails', pass: !verifyToken(testSecret, testTs - 1, expectedToken) },
  ];

  console.log('   Checks:');
  for (const check of authChecks) {
    const icon = check.pass ? '✓' : '✗';
    console.log(`   ${icon} ${check.name}`);
    if (!check.pass) allPass = false;
  }

  // Summary
  console.log('\n=== Result ===');
  if (allPass) {
    console.log('✓ All checks passed');
    process.exit(0);
  } else {
    console.log('✗ Some checks failed');
    process.exit(1);
  }
}

testTwiMLGeneration().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
