# Savry Website - Complete Setup Guide

## 🎨 What You're Building

A beautiful, animated web app with:
- **Teal color scheme** matching your iOS app
- **Animated background** with floating fruits & vegetables (SVG line art)
- **Full web app experience** - not just a landing page!
- **Pro tier features** including budget meal planning and store location mapping
- **Secure recipe generation** - Processing happens server-side only

## 📋 Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org)
2. **PostgreSQL** - [Download](https://www.postgresql.org/download/)
3. **OpenAI API Key** - [Get one](https://platform.openai.com/api-keys)

## 🚀 Quick Start (5 Minutes)

### Step 1: Run Setup Script
```bash
cd /Users/gordonlafler/Desktop/savryiowebsite
chmod +x setup.sh
./setup.sh
```

### Step 2: Configure Environment

Edit `.env.local`:

```env
# Your PostgreSQL connection string
DATABASE_URL="postgresql://username:password@localhost:5432/savry"

# Your OpenAI API key
OPENAI_API_KEY="sk-your-key-here"

# Auto-generated (keep as-is)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[auto-generated]"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# For seeding store locations (optional)
ADMIN_SEED_KEY="any-secret-key"
```

### Step 3: Set Up Database

```bash
# Create database
createdb savry

# Push schema to database
npx prisma db push

# (Optional) Seed sample store location data
curl -X POST http://localhost:3000/api/store-locations/seed \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Kroger Downtown",
    "location": "90210",
    "adminKey": "your-admin-key"
  }'
```

### Step 4: Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## 🎨 Design Features

### Animated Background
The site features beautiful floating SVG illustrations of:
- 🍎 Apple
- 🥕 Carrot
- 🍅 Tomato
- 🥦 Broccoli
- 🍋 Lemon
- 🥑 Avocado
- 🫑 Bell Pepper
- 🍓 Strawberry

All animated with smooth floating effects in teal/green colors!

### Color Palette
- **Primary (Teal)**: `#14b8a6`
- **Secondary (Cyan/Teal)**: `#06b6d4`
- Gradients blend these colors throughout

### Animations
- `float`: 3s ease-in-out loop
- `float-slow`: 4s variation
- `float-slower`: 5s variation
- `fade-in`: 0.5s entrance
- `slide-up`: 0.5s upward entrance
- `scale-in`: 0.3s scale entrance

All configured in `tailwind.config.js`

## 📱 Web App Pages

### Public Pages
- `/` - Animated landing page with features and pricing
- `/login` - User login
- `/register` - New user registration

### Dashboard Pages (Authenticated)
- `/dashboard` - Main dashboard with quick actions
- `/dashboard/recipes` - Browse user's recipes
- `/dashboard/recipes/generate` - AI recipe generation form
- `/dashboard/meal-plans` - Browse meal plans
- `/dashboard/meal-plans/generate` - Create new meal plan
- `/dashboard/deals` - Weekly store deals (Pro only)
- `/upgrade` - Upgrade to Pro page

## 🔐 User Tiers

### Free Tier
- Smart recipe generation
- Basic meal planning
- Grocery lists
- iOS app sync
- Save up to 50 recipes

### Pro Tier ($4.99/month)
- Everything in Free
- **Budget-optimized meal plans**
- **Weekly supermarket discounts**
- **Store location mapping** (aisle navigation)
- Unlimited recipes & meal plans
- Priority support

## 🤖 Recipe Generation (Server-Side Only!)

All recipe processing happens on the server - your API keys are never exposed to users!

### For Web Users
- `POST /api/recipes/generate` - Generate recipe
- `GET /api/recipes/popular` - Get cached popular recipes
- `POST /api/meal-plans/generate` - Generate meal plan
- `GET /api/discounts/[location]` - Get store deals (Pro)

### For iOS App
- `POST /api/app/auth` - Authenticate and get JWT
- `POST /api/app/recipes/generate` - Generate recipe (cached when possible)
- `POST /api/app/meal-plans/generate` - Generate meal plan with budget
- `POST /api/app/grocery-list/generate` - Generate grocery list
- `POST /api/app/grocery-list/locations` - Get store aisle locations (Pro)
- `GET /api/app/sync` - Sync all user data

## 🏪 Store Location Mapping (Pro Feature)

The store location system maps grocery items to store aisles!

### How It Works
1. Database stores item locations for each store/zip code
2. Items include: aisle number, section, shelf location
3. Grocery lists get optimized shopping routes
4. Items grouped by section for easy shopping

### Seeding Store Data

Create sample data for testing:

```bash
curl -X POST http://localhost:3000/api/store-locations/seed \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Kroger Store 123",
    "location": "90210",
    "adminKey": "your-admin-key"
  }'
```

This seeds ~20 common items with aisle locations.

### Using in iOS App

```swift
// Get optimized shopping route with locations
let response = try await api.post("/api/app/grocery-list/locations", [
    "groceryListId": "list_id",
    "storeName": "Kroger Store 123",
    "zipCode": "90210"
])

// Returns items sorted by aisle with locations:
// {
//   "optimizedRoute": [...],
//   "groupedBySection": {
//     "Produce": [...],
//     "Dairy": [...],
//     "Meat": [...]
//   }
// }
```

## 🗄️ Database Management

### View Database
```bash
npx prisma studio
```

Opens visual database editor at http://localhost:5555

### Update Schema
After editing `prisma/schema.prisma`:

```bash
npx prisma db push
```

### Reset Database
```bash
npx prisma db push --force-reset
```

## 🧪 Testing the App

### 1. Create Test Users

```bash
# Free tier user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "free@test.com", "password": "password123", "name": "Free User"}'

# Pro tier user (manually update in Prisma Studio)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "pro@test.com", "password": "password123", "name": "Pro User"}'
```

Then open Prisma Studio and change the Pro user's `tier` to `PRO`.

### 2. Test Recipe Generation

1. Login as either user
2. Go to "Generate Recipe"
3. Fill in form (or leave ingredients empty)
4. Click "Generate Recipe"
5. Watch it create a recipe!

### 3. Test Pro Features (Pro User Only)

1. Login as Pro user
2. Visit `/dashboard/deals`
3. Enter zip code (try "90210")
4. See weekly supermarket discounts
5. Click "Create Budget Meal Plan"

### 4. Test iOS API

```bash
# 1. Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/app/auth \
  -H "Content-Type: application/json" \
  -d '{"email": "pro@test.com", "password": "password123"}' \
  | jq -r '.token')

# 2. Generate recipe
curl -X POST http://localhost:3000/api/app/recipes/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ingredients": ["chicken", "rice"],
    "cuisine": "Asian",
    "cookingTime": 30
  }'
```

## 🎨 Customization

### Update Colors
Edit `tailwind.config.js`:

```javascript
colors: {
  primary: {
    500: '#YOUR_TEAL_COLOR',
    600: '#YOUR_TEAL_COLOR',
  },
  secondary: {
    500: '#YOUR_GREEN_COLOR',
    600: '#YOUR_GREEN_COLOR',
  }
}
```

### Add More Animated Vegetables
Edit `components/AnimatedBackground.tsx` and add more SVG shapes!

### Change Logo
Replace the "S" in the navbar with your logo:
Edit `components/Navbar.tsx` and `app/page.tsx`

## 🚀 Deployment

### Recommended: Vercel + Supabase

1. **Database**: Create PostgreSQL on [Supabase](https://supabase.com)
2. **Deploy**: Connect GitHub repo to [Vercel](https://vercel.com)
3. **Environment Variables**: Add all `.env.local` vars to Vercel
4. **Domain**: Update `NEXTAUTH_URL` to your domain

### Alternative: Railway

1. Create project on [Railway](https://railway.app)
2. Add PostgreSQL service
3. Add web service (this repo)
4. Set environment variables
5. Deploy!

## 📊 Monitoring Costs

### Recipe Generation Usage

The app is optimized for efficiency:
- Recipe generation: Very affordable per recipe
- Meal plan generation: Low cost per plan
- Caching reduces costs by ~70%

Monitor usage in your API dashboard.

### Cost Optimization Tips

1. **Caching**: App automatically caches popular recipes
2. **Limits**: Set API rate limits as needed
3. **Monitoring**: Track usage regularly
4. **Tiers**: Consider limiting Free tier to X recipes/month

## 🆘 Troubleshooting

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
brew services list

# Start PostgreSQL
brew services start postgresql

# Test connection
psql -U postgres
```

### "API Error"
- Check API key is valid
- Verify you have credits available
- Ensure API key has proper permissions

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
npx prisma generate
```

### Animations not working
```bash
# Rebuild Tailwind
npm run dev
# Hard refresh browser (Cmd+Shift+R)
```

## 📚 Documentation

- `README.md` - Technical documentation
- `FEATURES.md` - Complete feature list
- `IOS_INTEGRATION.md` - iOS app integration guide
- `QUICKSTART.md` - Quick start guide
- This file - Complete setup instructions

## 🎉 You're Ready!

Your Savry website is now set up with:
- ✅ Beautiful animated UI with teal colors
- ✅ Floating fruit/vegetable illustrations
- ✅ Full web app experience
- ✅ Secure recipe generation
- ✅ Pro tier with budget meal planning
- ✅ Store location mapping
- ✅ iOS app sync endpoints
- ✅ Weekly supermarket deals

Start the dev server and visit http://localhost:3000 to see your beautiful new web app! 🚀







