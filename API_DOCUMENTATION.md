# Smart Tally XML Assistant API

Base URL: `http://localhost:5000/api`

All private routes require `Authorization: Bearer <jwt>`.

## Public

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | API health |
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Issue JWT |
| POST | `/auth/forgot-password` | Generate 10-minute OTP |
| POST | `/auth/reset-password` | Verify OTP and update password |
| GET | `/auth/verify-email/:token` | Development email verification |

## Authenticated workflow

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/auth/me` | Current user |
| POST | `/uploads` | Multer Excel upload |
| GET | `/uploads/:uploadId/preview?page=1&limit=50` | Paginated preview |
| GET | `/uploads` | Search/filter/paginated uploads |
| GET | `/templates/:voucherType/download` | Shared 8-column CSV template |
| POST | `/validation/:uploadId/validate` | Validate parsed rows |
| POST | `/validation/:validationId/auto-fix` | Apply safe fixes |
| POST | `/validation/:validationId/issues/:issueId/fix` | Fix one issue |
| POST | `/validation/:validationId/issues/:issueId/apply` | Apply recommendation |
| POST | `/validation/:validationId/issues/:issueId/ignore` | Ignore issue |
| POST | `/validation/:validationId/revalidate` | Revalidate current issues |
| POST | `/xml/generate/:validationId` | Generate only validated XML |
| GET | `/xml/:xmlId` | Preview XML |
| GET | `/xml/:xmlId/download` | Download XML attachment |
| DELETE | `/xml/:xmlId` | Delete owned XML |
| GET | `/reports/validation` | Validation reports |
| GET | `/analytics/dashboard` | MongoDB analytics |
| GET | `/notifications` | Notifications |
| PUT | `/notifications/:id/read` | Mark notification read |
| GET | `/user/profile` | Profile |
| PUT | `/user/profile` | Update name/organization |
| POST | `/chatbot/message` | Rule-based assistant |

Validation and XML generation reject pending issues. No hardcoded error count is used; summaries are derived from issue status values.
