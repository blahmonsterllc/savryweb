#!/bin/bash

# 🗽 Real World Test for ZIP Code 11764 (Miller Place, NY)
# This script sets up realistic deals for your area and guides you through testing

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  🗽 Real World Test - Miller Place, NY (ZIP 11764)       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if server is running
echo "📡 Step 1: Checking if server is running..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is running!${NC}"
else
    echo -e "${YELLOW}⚠️  Server not running. Starting it now...${NC}"
    echo "   Run 'npm run dev' in another terminal first"
    exit 1
fi
echo ""

# Step 2: Populate deals for 11764
echo "🏪 Step 2: Creating realistic deals for your area..."
echo "   ZIP Code: 11764 (Miller Place, NY)"
echo "   Stores: Stop & Shop, King Kullen, Target, ShopRite, Walmart"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3000/api/deals/test-11764)

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Deals created successfully!${NC}"
    echo ""
    
    # Parse and display results
    DEALS_COUNT=$(echo "$RESPONSE" | grep -o '"dealsCreated":[0-9]*' | grep -o '[0-9]*')
    SAVINGS=$(echo "$RESPONSE" | grep -o '"totalPotentialSavings":"[0-9.]*"' | grep -o '[0-9.]*')
    
    echo "📊 Results:"
    echo "   • $DEALS_COUNT deals created"
    echo "   • Potential savings: \$$SAVINGS"
    echo "   • Stores: Stop & Shop, King Kullen, Target, ShopRite, Walmart"
    echo ""
    
    # Show sample deals
    echo "📦 Sample Deals:"
    echo "   • Stop & Shop - Boneless Chicken Breast: \$2.99/lb (was \$5.99) - 50% OFF!"
    echo "   • Stop & Shop - Organic Baby Spinach: \$2.49 (was \$3.99) - 38% OFF"
    echo "   • Stop & Shop - Large Eggs: \$3.49 (was \$5.49) - 36% OFF"
    echo "   • ShopRite - Canned Tomatoes: \$1.79 (was \$2.79) - 36% OFF"
    echo "   • Target - Organic Pasta: \$1.49 (was \$2.49) - 40% OFF"
    echo ""
else
    echo -e "${YELLOW}⚠️  Failed to create deals. Response:${NC}"
    echo "$RESPONSE"
    exit 1
fi

# Step 3: Guide user to website
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}🌐 Step 3: Test on the Website!${NC}"
echo ""
echo "   1. Open your browser and visit:"
echo -e "      ${GREEN}http://localhost:3000/smart-meal-plan${NC}"
echo ""
echo "   2. Fill out the form:"
echo "      • ZIP Code: 11764"
echo "      • Days: 5"
echo "      • Budget: \$120 (Long Island pricing)"
echo "      • Servings: 4"
echo "      • Stores: ✓ Stop & Shop, ✓ ShopRite, ✓ Target"
echo ""
echo "   3. Click 'Generate Smart Meal Plan'"
echo ""
echo "   4. Wait 20-30 seconds while ChatGPT creates your plan"
echo ""
echo "   5. You'll see:"
echo "      ✓ 5-day meal plan with recipes"
echo "      ✓ Shopping list organized by aisle"
echo "      ✓ Store locations (Stop & Shop, ShopRite, Target)"
echo "      ✓ Exact aisle numbers (Aisle 1, Meat Counter, etc.)"
echo "      ✓ Total savings (~\$48.50 or 30% off)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}🎉 Your real-world test is ready!${NC}"
echo ""
echo "📖 For more details, see: REAL_WORLD_TEST_11764.md"
echo ""
echo "💡 Note: This uses realistic pricing for Long Island/NYC metro area"
echo "   (typically 10-20% higher than national average)"
echo ""




