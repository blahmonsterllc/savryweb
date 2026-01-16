#!/bin/bash

echo "🥘 Setting up Savry Website..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Please install PostgreSQL and create a database."
    echo "   macOS: brew install postgresql"
    echo "   Then: createdb savry"
else
    echo "✅ PostgreSQL detected"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo ""
    echo "⚙️  Creating .env.local file..."
    cat > .env.local << EOF
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/savry"

# OpenAI API
OPENAI_API_KEY="your-openai-api-key"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
EOF
    echo "✅ Created .env.local"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env.local and add:"
    echo "   - Your PostgreSQL connection string"
    echo "   - Your OpenAI API key"
else
    echo "✅ .env.local already exists"
fi

# Generate Prisma client
echo ""
echo "🗄️  Generating Prisma client..."
npx prisma generate

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "1. Edit .env.local with your database URL and OpenAI API key"
echo ""
echo "2. Set up the database:"
echo "   npx prisma db push"
echo ""
echo "3. Run the development server:"
echo "   npm run dev"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "📱 For iOS app integration, see IOS_INTEGRATION.md"
echo ""







