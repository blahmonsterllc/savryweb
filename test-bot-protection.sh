#!/bin/bash

# Bot Protection Test Suite
# Tests if Meta bots and other unwanted traffic is blocked

echo "🛡️  Testing Bot Protection..."
echo ""

# Get the URL (default to localhost for development)
URL="${1:-http://localhost:3000}"

echo "Testing against: $URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Meta/Facebook Bot (should be blocked)
echo "Test 1: Facebook Bot on API endpoint"
echo "Command: curl -H 'User-Agent: facebookexternalhit/1.1' $URL/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: facebookexternalhit/1.1" "$URL/api/health")
if [ "$RESPONSE" = "403" ]; then
  echo "✅ PASS - Facebook bot blocked (403)"
else
  echo "❌ FAIL - Facebook bot not blocked (got $RESPONSE, expected 403)"
fi
echo ""

# Test 2: Meta/Facebook Bot on homepage (should still be blocked)
echo "Test 2: Facebook Bot on homepage"
echo "Command: curl -H 'User-Agent: facebookexternalhit/1.1' $URL/"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: facebookexternalhit/1.1" "$URL/")
if [ "$RESPONSE" = "403" ]; then
  echo "✅ PASS - Facebook bot blocked on homepage (403)"
else
  echo "❌ FAIL - Facebook bot not blocked (got $RESPONSE, expected 403)"
fi
echo ""

# Test 3: Twitter Bot (should be blocked)
echo "Test 3: Twitter Bot on API endpoint"
echo "Command: curl -H 'User-Agent: Twitterbot/1.0' $URL/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: Twitterbot/1.0" "$URL/api/health")
if [ "$RESPONSE" = "403" ]; then
  echo "✅ PASS - Twitter bot blocked (403)"
else
  echo "❌ FAIL - Twitter bot not blocked (got $RESPONSE, expected 403)"
fi
echo ""

# Test 4: Curl/Development Tool (should be blocked)
echo "Test 4: curl on API endpoint"
echo "Command: curl $URL/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/health")
if [ "$RESPONSE" = "403" ]; then
  echo "✅ PASS - curl blocked (403)"
else
  echo "❌ FAIL - curl not blocked (got $RESPONSE, expected 403)"
fi
echo ""

# Test 5: Googlebot on homepage (should be allowed)
echo "Test 5: Googlebot on homepage (should allow for SEO)"
echo "Command: curl -H 'User-Agent: Googlebot/2.1' $URL/"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: Googlebot/2.1" "$URL/")
if [ "$RESPONSE" = "200" ]; then
  echo "✅ PASS - Googlebot allowed on homepage (200)"
else
  echo "⚠️  WARNING - Googlebot got $RESPONSE (expected 200 for SEO)"
fi
echo ""

# Test 6: Googlebot on API (should be blocked)
echo "Test 6: Googlebot on API endpoint (should block)"
echo "Command: curl -H 'User-Agent: Googlebot/2.1' $URL/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: Googlebot/2.1" "$URL/api/health")
if [ "$RESPONSE" = "403" ]; then
  echo "✅ PASS - Googlebot blocked on API (403)"
else
  echo "❌ FAIL - Googlebot not blocked on API (got $RESPONSE, expected 403)"
fi
echo ""

# Test 7: Real Browser User Agent (should be allowed)
echo "Test 7: Real browser user agent (should allow)"
echo "Command: curl -H 'User-Agent: Mozilla/5.0...' $URL/"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "$URL/")
if [ "$RESPONSE" = "200" ]; then
  echo "✅ PASS - Real browser allowed (200)"
else
  echo "❌ FAIL - Real browser blocked (got $RESPONSE, expected 200)"
fi
echo ""

# Test 8: TikTok/ByteSpider Bot (should be blocked)
echo "Test 8: TikTok/ByteSpider Bot"
echo "Command: curl -H 'User-Agent: Bytespider' $URL/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: Bytespider" "$URL/api/health")
if [ "$RESPONSE" = "403" ]; then
  echo "✅ PASS - ByteSpider/TikTok bot blocked (403)"
else
  echo "❌ FAIL - ByteSpider bot not blocked (got $RESPONSE, expected 403)"
fi
echo ""

# Test 9: SEO Scraper (should be blocked)
echo "Test 9: SEO Scraper (AhrefsBot)"
echo "Command: curl -H 'User-Agent: AhrefsBot/7.0' $URL/"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: AhrefsBot/7.0" "$URL/")
if [ "$RESPONSE" = "403" ]; then
  echo "✅ PASS - AhrefsBot blocked (403)"
else
  echo "❌ FAIL - AhrefsBot not blocked (got $RESPONSE, expected 403)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Bot Protection Test Complete!"
echo ""
echo "Summary:"
echo "- Meta/Facebook bots: Should be blocked everywhere ✅"
echo "- Social media bots: Should be blocked everywhere ✅"
echo "- Development tools: Should be blocked everywhere ✅"
echo "- SEO scrapers: Should be blocked everywhere ✅"
echo "- Search engines: Allowed on public pages, blocked on APIs ⚠️"
echo "- Real browsers: Should be allowed everywhere ✅"
