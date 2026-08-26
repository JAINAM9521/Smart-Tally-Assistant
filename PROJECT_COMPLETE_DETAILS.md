# Smart Tally XML Assistant — Complete Project Details

## Project
A full-stack accounting automation system that converts standardized Excel accounting data into validated Tally-compatible XML.

## Architecture
Next.js + React + JavaScript frontend
→ Node.js + Express REST API
→ MongoDB Atlas + Mongoose

## Workflow
Login → select voucher type → download real template → fill Excel → upload → full dataset parsing → validation → recommendations → safe Auto Fix → manual issue resolution → revalidation → 100% valid / 0 blocking errors → XML generation → XML parser validation → preview → download → Tally Prime import.

## Voucher Types
Sales, Purchase, Payment, Receipt, Contra, Journal, Credit Note, Debit Note.

## Frontend
Existing UI, routes, animations and animated icons are preserved. Accounting/application data is sourced from the backend; no mock-data fallback is used.

## Backend
Node.js, Express, Mongoose, JWT, bcryptjs, Multer, SheetJS/XLSX, Fuse.js, xmlbuilder2, fast-xml-parser, Zod, Helmet, CORS and rate limiting.

## Database
MongoDB Atlas. Core models: User, Upload, Conversion, Validation, ValidationReport, XMLFile, Notification, PasswordReset.

## Validation
The backend validates the complete uploaded dataset, not just the preview. Blocking errors prevent XML generation. Safe formatting issues may be auto-fixed. Remaining issues require explicit resolution and revalidation.

## XML
XML is generated only after validation reaches score 100 with zero blocking errors and validated status. Generated XML is parsed/validated before download.

## Security
JWT authentication, bcrypt password hashing, role-based access, ownership checks, Helmet, CORS, rate limiting, request validation and upload validation.

## Environment
Frontend: NEXT_PUBLIC_API_URL=http://localhost:5000/api
Backend: MONGO_URI, JWT_SECRET, JWT_EXPIRES_IN, PORT, CLIENT_URL.

Never commit real secrets.

## Verification
Static/source cleanup is included in this package. Live MongoDB Atlas and end-to-end Excel/XML tests must be run on a machine with database/network access; they must not be represented as PASS unless actually executed.
