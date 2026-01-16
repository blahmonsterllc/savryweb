#!/bin/bash

# 🎉 Install and Test Your Dream App
# Run this script to set everything up!

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   🎉 YOUR DREAM APP - INSTALLATION SCRIPT 🎉         ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install
echo "✅ Dependencies installed!"
echo ""

# Step 2: Check for OpenAI API key
echo "🔑 Step 2: Checking for OpenAI API key..."
if grep -q "OPENAI_API_KEY" .env.local 2>/dev/null; then
    echo "✅ OpenAI API key found!"
else
    echo "⚠️  OpenAI API key not found!"
    echo ""
    echo "Please add your OpenAI API key to .env.local:"
    echo "  echo 'OPENAI_API_KEY=sk-your-key-here' >> .env.local"
    echo ""
    echo "Get your key from: https://platform.openai.com/api-keys"
    echo ""
    read -p "Press Enter when you've added your API key..."
fi
echo ""

# Step 3: Offer to seed sample data
echo "🌱 Step 3: Would you like to add sample data?"
echo "   (Recommended for testing)"
echo ""
read -p "Add sample data? (y/n): " add_sample

if [ "$add_sample" = "y" ]; then
    echo ""
    echo "Starting dev server to seed data..."
    npm run dev &
    SERVER_PID=$!
    
    echo "Waiting for server to start..."
    sleep 10
    
    echo "Seeding sample data..."
    curl -X POST http://localhost:3000/api/deals/seed-sample
    
    echo ""
    echo "✅ Sample data added!"
    
    # Keep server running
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║              🎉 ALL SET! 🎉                           ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo ""
    echo "Your dev server is running!"
    echo ""
    echo "📍 Test your app at:"
    echo "   http://localhost:3000/smart-meal-plan"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    
    wait $SERVER_PID
else
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║              🎉 INSTALLATION COMPLETE! 🎉             ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo ""
    echo "To start your app:"
    echo "  1. npm run dev"
    echo "  2. Visit: http://localhost:3000/smart-meal-plan"
    echo ""
    echo "To add sample data later:"
    echo "  curl -X POST http://localhost:3000/api/deals/seed-sample"
    echo ""
fi

echo "📖 Documentation:"
echo "  - Quick Start: DREAM_APP_QUICKSTART.md"
echo "  - Full Guide: SMART_MEAL_PLANNER_GUIDE.md"
echo "  - Summary: YOUR_DREAM_APP_IS_READY.md"
echo ""
echo "Happy coding! 🚀"




