# Smart Tally XML Assistant

Smart Tally XML Assistant is a Next.js JavaScript frontend for preparing accounting Excel data for Tally Prime, now paired with an Express/Mongoose backend.

## Frontend

```bash
bun install
npm run build
npm run dev
```

The existing UI remains unchanged. To use the real API, set `NEXT_PUBLIC_API_URL=http://localhost:5000/api` in the frontend environment. Without it, the existing the Express backend is required for real data operations.

## Backend

```bash
cd backend
bun install
cp .env.example .env
# Set MONGO_URI and JWT_SECRET in backend/.env
bun run seed
bun run dev
```

The backend is JavaScript-only and uses Node.js, Express, MongoDB/Mongoose, JWT, bcrypt, Multer, SheetJS, Fuse.js, xmlbuilder2, fast-xml-parser, Helmet, CORS, rate limits, and Zod. It persists users, uploads, validations, reports, XML files, notifications, and password reset records in MongoDB.

## Demo credentials

These are demo credentials only:

- Email: `admin@smarttally.com`
- Password: `Demo@123`
- Name: Jainam Shah
- Organization: Saroj Metal
- Role: admin

## API documentation

See `API_DOCUMENTATION.md`, `backend/README.md`, and `postman_collection.json`.

## Runtime requirement

The backend cannot connect until a MongoDB URI is provided in `backend/.env`. No production secrets are included in this repository.
