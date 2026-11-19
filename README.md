# Simple CRM System

A beginner-friendly MERN customer relationship management application. It provides secure admin authentication plus customer, lead, deal, and follow-up management in a responsive SaaS-style dashboard.

## Features

- JWT authentication stored in HTTP-only cookies
- Private data per logged-in user
- Customer, lead, deal, and follow-up CRUD workflows
- Searchable customer, lead, deal, and follow-up lists
- Status updates with clear colored badges
- Dashboard statistics calculated from MongoDB data, including won-deal revenue
- Responsive interface for desktop and mobile

## Requirements

- Node.js 18 or newer
- MongoDB running locally, or a MongoDB Atlas connection string

## Setup

1. Configure the backend environment. Copy `server/.env.example` to `server/.env`, then update the values. For a local MongoDB installation, the example URI works as-is.

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/simple-crm
   JWT_SECRET=use_a_random_secret_with_at_least_32_characters
   PORT=5000
   CLIENT_URL=http://localhost:5173
   ```

2. Start the API in one terminal:

   ```bash
   cd server
   npm install
   npm run dev
   ```

3. Start the React application in another terminal:

   ```bash
   cd client
   npm install
   npm run dev
   ```

4. Open the local URL printed by Vite (normally `http://localhost:5173`). Select **Create an account** to register the first admin account. The account owns all CRM data it creates.

## How to use it

1. Add customers first; deals and follow-ups use customers as their linked records.
2. Add leads and update their statuses as they progress.
3. Create deals, mark successful opportunities as **Won**, and see the revenue update on the dashboard.
4. Schedule follow-ups and use the checkmark to mark them completed.

## API overview

The Express server exposes REST endpoints below `/api`:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- CRUD routes for `/customers`, `/leads`, `/deals`, and `/follow-ups`
- `GET /dashboard` for the authenticated dashboard data

Authentication is sent with an HTTP-only cookie; passwords are hashed with bcrypt and never returned by the API.

## Security notes

- The API will not start unless both `MONGODB_URI` and a JWT secret of at least 32 characters are configured.
- Authentication cookies are HTTP-only. They use `SameSite=Lax` locally and secure `SameSite=None` cookies in production.
- Authentication attempts are rate-limited, and protected records are scoped to their owning user.
- A customer with linked deals or follow-ups cannot be deleted until those records are removed or reassigned.

## Final MongoDB integration checklist

1. Install or start MongoDB locally, or obtain an Atlas URI.
2. Create `server/.env` from `server/.env.example`; never commit it.
3. Set `MONGODB_URI`, a strong `JWT_SECRET`, and the frontend `CLIENT_URL`.
4. Start the API and confirm `GET /api/health` responds successfully.
5. Register a test account, then verify every CRUD workflow and dashboard statistic with real data.
6. Run `npm test` in `server` and `npm run build` in `client` before deployment.


**#file structure**
Simple-CRM-System/
│
├── client/                    # React Frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Leads.jsx
│   │   │   ├── Deals.jsx
│   │   │   └── FollowUps.jsx
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   │
│   ├── index.html
│   └── package.json
│
├── server/                    # Node.js + Express
│   ├── models.js              # MongoDB Schemas
│   ├── routes.js              # All API Routes
│   ├── server.js              # Server + DB Connection
│   ├── .env                   # Database URI & Secrets
│   └── package.json
│
├── .gitignore
└── README.md
