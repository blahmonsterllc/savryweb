# Savry Website - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Run Setup Script
```bash
chmod +x setup.sh
./setup.sh
```

### 2. Configure Environment Variables

Edit `.env.local` and add your credentials:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/savry"
OPENAI_API_KEY="sk-your-api-key-here"
```

**Get API Key**: https://platform.openai.com/api-keys

### 3. Set Up Database

```bash
# Create database (if needed)
createdb savry

# Push schema to database
npx prisma db push

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### 4. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## 📱 iOS App Integration

Your iOS app can now make secure API calls to the server!

### Key Endpoints for iOS:

1. **Authentication**: `POST /api/app/auth`
2. **Generate Recipe**: `POST /api/app/recipes/generate`
3. **Generate Meal Plan**: `POST /api/app/meal-plans/generate`
4. **Generate Grocery List**: `POST /api/app/grocery-list/generate`
5. **Sync Data**: `GET /api/app/sync`

See `IOS_INTEGRATION.md` for detailed Swift implementation examples.

### Why This is Better:

✅ **Secure**: API keys stay on server  
✅ **Fast**: Caches popular recipes automatically  
✅ **Smart**: Returns existing recipes when appropriate  
✅ **Scalable**: Easy to add rate limiting and analytics  

## 🎯 Key Features

### Free Tier
- Smart recipe generation
- Meal planning (up to 14 days)
- Grocery list generation
- iOS app sync
- Access to popular recipes

### Pro Tier ($4.99/month)
- **Budget-optimized meal plans**
- **Weekly supermarket discounts**
- **Cost-saving recommendations**
- Priority support
- Unlimited meal plans

## 🗄️ Database Models

- **User**: Account with FREE/PRO tier
- **Recipe**: AI-generated and user recipes
- **MealPlan**: Weekly meal plans with budgets
- **GroceryList**: Auto-generated shopping lists
- **SupermarketDiscount**: Weekly store discounts (Pro)
- **SavedRecipe**: User's saved recipes

## 🔧 Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start               # Start production server

# Database
npx prisma db push      # Update database schema
npx prisma studio       # Visual database editor
npx prisma generate     # Regenerate Prisma client

# Linting
npm run lint            # Check for code issues
```

## 📝 Creating Your First User

### Via Web UI:
1. Go to http://localhost:3000/register
2. Create an account
3. Login at http://localhost:3000/login

### Via API (for testing):
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

## 🧪 Testing iOS Integration

1. Create a test user (Free tier)
2. Create a Pro user for testing Pro features
3. Use Postman or your iOS app to test endpoints

Example: Generate a recipe
```bash
# 1. Get auth token
curl -X POST http://localhost:3000/api/app/auth \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# 2. Generate recipe (use token from step 1)
curl -X POST http://localhost:3000/api/app/recipes/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "ingredients": ["chicken", "rice", "vegetables"],
    "cuisine": "Asian",
    "cookingTime": 30
  }'
```

## 🎨 Customization

### Update Branding Colors
Edit `tailwind.config.js` to match your iOS app colors:

```javascript
colors: {
  primary: {
    500: '#YOUR_COLOR',
    600: '#YOUR_COLOR',
    // ...
  }
}
```

### Add Your Logo
- Place your logo in `public/logo.png`
- Update references in `app/page.tsx` and navigation

## 🚀 Deployment

### Recommended: Vercel + Supabase/Neon

1. **Database**: Create PostgreSQL on Supabase or Neon
2. **Deploy**: Push to GitHub and connect to Vercel
3. **Environment Variables**: Add all `.env.local` vars to Vercel
4. **Domain**: Update `NEXTAUTH_URL` to your production domain

### Alternative: Railway, Heroku, or DigitalOcean

All work great with Next.js! Just ensure you:
- Set all environment variables
- Run `npx prisma generate` in build step
- Run `npx prisma db push` on first deploy

## 📚 Documentation

- `README.md` - Full technical documentation
- `IOS_INTEGRATION.md` - iOS app integration guide with Swift examples
- `prisma/schema.prisma` - Database schema reference

## 🆘 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
brew services list

# Start PostgreSQL
brew services start postgresql

# Test connection
psql -U postgres -d savry
```

### API Errors
- Check your API key is valid
- Ensure you have credits available
- Verify API key permissions

### Build Errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma
npx prisma generate
```

## 💡 Tips

1. **Development**: Use `npx prisma studio` to view/edit database visually
2. **Testing**: Create multiple test accounts (Free and Pro tier)
3. **iOS Sync**: Test sync endpoint regularly during development
4. **Caching**: Server automatically caches popular recipes - test this!
5. **Pro Features**: Test the discount integration with sample data

## 🎉 You're Ready!

Your Savry website is now set up with:
- ✅ Secure recipe generation (server-side only)
- ✅ User authentication and tiers
- ✅ Recipe generation and caching
- ✅ Meal planning with budget optimization
- ✅ iOS app sync endpoints
- ✅ Supermarket discount system (Pro)
- ✅ Beautiful, modern UI

Start the dev server and visit http://localhost:3000 🚀







