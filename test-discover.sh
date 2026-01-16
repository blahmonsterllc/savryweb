#!/bin/bash

echo "🔥 Testing Discover Feature"
echo "======================================"
echo ""

# Check if server is running
echo "1️⃣ Checking if server is running..."
if curl -s http://localhost:3000/api/recipes/discover > /dev/null 2>&1; then
  echo "✅ Server is running!"
else
  echo "❌ Server is not running. Please start it with 'npm run dev'"
  exit 1
fi

echo ""
echo "2️⃣ Adding sample recipes to database..."
echo "   (8 delicious recipes from around the world)"
echo ""

# Seed sample recipes
RESPONSE=$(curl -s -X POST http://localhost:3000/api/recipes/seed-sample)
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "3️⃣ Fetching recipes from Discover API..."
echo ""

# Fetch recipes
RECIPES=$(curl -s http://localhost:3000/api/recipes/discover)
COUNT=$(echo "$RECIPES" | jq -r '.count' 2>/dev/null || echo "0")

echo "Found $COUNT recipes in the database!"
echo ""

if [ "$COUNT" -gt 0 ]; then
  echo "✅ SUCCESS! Sample recipes added successfully!"
  echo ""
  echo "📋 Sample Recipes:"
  echo "$RECIPES" | jq -r '.recipes[] | "   - \(.name) (\(.cuisine) - \(.difficulty))"' 2>/dev/null
  echo ""
  echo "🎨 View them on the Discover page:"
  echo "   👉 http://localhost:3000/dashboard/discover"
  echo ""
  echo "🎉 Your Discover page is ready!"
else
  echo "⚠️  No recipes found. Try running the seed script again."
fi

echo ""
echo "======================================"
echo "🔥 Test Complete!"




