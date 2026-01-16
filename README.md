# Savry - Smart Recipe & Meal Planning Website

A comprehensive web platform for the Savry iOS app, featuring intelligent recipe generation, meal planning, and grocery list creation.

## Features

### Core Functionality
- **Smart Recipe Generation**: Create unique recipes based on ingredients, dietary restrictions, and preferences
- **Smart Meal Planning**: Generate personalized weekly meal plans
- **Grocery Lists**: Automatically create organized shopping lists from recipes and meal plans
- **Recipe Database**: Save and access commonly generated recipes
- **iOS App Sync**: Seamless data synchronization with the Savry iOS app

### Pro Tier Features
- **Budget Optimization**: Create meal plans within your budget
- **Supermarket Discounts**: Access weekly discounts from local supermarkets
- **Budgeted Meal Plans**: Smart meal plans that maximize savings using available discounts

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **AI Integration**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- OpenAI API key

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file with:
```
DATABASE_URL="postgresql://user:password@localhost:5432/savry"
OPENAI_API_KEY="your-openai-api-key"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

4. Run the development server:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

## API Endpoints

### Web API (Browser Access)
- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - Authentication
- `POST /api/recipes/generate` - Generate recipe (web)
- `GET /api/recipes/popular` - Get popular recipes
- `POST /api/meal-plans/generate` - Generate meal plan (web)
- `GET /api/discounts/[location]` - Get supermarket discounts (Pro)

### iOS App API (Secure Server-Side)
All iOS app endpoints use Bearer token authentication and handle recipe generation server-side to keep your API key secure.

- `POST /api/app/auth` - iOS app authentication
- `POST /api/app/recipes/generate` - Generate recipe (returns cached popular recipes when possible)
- `POST /api/app/meal-plans/generate` - Generate meal plan with budget optimization
- `POST /api/app/grocery-list/generate` - Generate grocery list
- `GET /api/app/sync` - Sync user data with iOS app

### iOS App Integration

The iOS app should:

1. **Authenticate**: Call `/api/app/auth` with email/password to get JWT token
2. **Include Token**: Add `Authorization: Bearer <token>` header to all subsequent requests
3. **Call Server-Side APIs**: Use the `/api/app/*` endpoints for all recipe generation operations
4. **Sync Data**: Periodically call `/api/app/sync` to sync recipes, meal plans, and grocery lists

Example iOS authentication:
```swift
// Swift example
let url = URL(string: "https://your-domain.com/api/app/auth")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body = ["email": email, "password": password]
request.httpBody = try? JSONEncoder().encode(body)

// Store the returned token for subsequent requests
```

## Database Schema

The application uses the following main models:
- **User**: User accounts with tier information (FREE/PRO)
- **Recipe**: AI-generated and user-created recipes
- **MealPlan**: Weekly meal plans with budget tracking
- **GroceryList**: Auto-generated shopping lists
- **SupermarketDiscount**: Weekly supermarket discount data (Pro tier)
- **SavedRecipe**: User's saved recipes

## Security Features

- **Server-Side Processing**: All recipe generation happens on the server, protecting your API keys
- **JWT Authentication**: Secure token-based authentication for iOS app
- **Session Management**: NextAuth.js for web session handling
- **Password Hashing**: bcrypt for secure password storage
- **Tier-Based Access**: Pro features are restricted server-side

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Update database schema
npx prisma db push
```

## Deployment

This app is designed to be deployed on:
- **Vercel** (recommended for Next.js)
- **Railway** or **Heroku** (for database + app)
- Any Node.js hosting platform

Remember to:
1. Set all environment variables in your hosting platform
2. Set up PostgreSQL database
3. Run Prisma migrations
4. Update `NEXTAUTH_URL` to your production domain

## Pro Tier Supermarket Discounts

The supermarket discount scraper (`lib/supermarket-scraper.ts`) currently uses sample data. To implement real discount scraping:

1. Partner with supermarket chains for API access (recommended)
2. Implement web scrapers for specific stores (check their terms of service)
3. Use third-party grocery deal APIs

## Contributing

This is a private project for the Savry iOS app. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved







