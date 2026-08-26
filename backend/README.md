# Smart Tally XML Assistant API

JavaScript-only Express/Mongoose backend for the existing Smart Tally XML Assistant frontend.

## Setup

1. Start MongoDB locally or create a MongoDB Atlas database.
2. Copy `.env.example` to `.env` and set `MONGO_URI` and `JWT_SECRET`.
3. Install dependencies with `bun install`.
4. Seed the demo admin with `bun run seed`.
5. Start the API with `bun run dev`.

The API runs on `http://localhost:5000` by default. Set the frontend `NEXT_PUBLIC_API_URL=http://localhost:5000/api` to use real transport; without it the frontend does not use a backend-unavailable error handling.

## Demo account

`admin@smarttally.com` / `Demo@123` is created by the seed script and stored with a bcrypt hash. These are demo credentials only.

## Architecture

Express routes call controllers, controllers use Mongoose models and services, and all accounting file data is scoped to the authenticated user unless the user is an admin. Excel parsing uses SheetJS, validation is rule-based, recommendations use Fuse.js, and XML is generated/parsed before persistence.

## Health check

`GET /api/health`

## Full-stack boundary

The frontend UI is preserved. Email delivery, Redis caching, and government GST verification have safe development fallbacks. MongoDB is the source of truth when backend mode is enabled; localStorage is limited to frontend session/UI state.

See `../API_DOCUMENTATION.md` for endpoint details.
