# Week 1 - Authentication Setup

## Setup Instructions

### 1. Server Setup
```bash
cd server
npm install bcryptjs jsonwebtoken dotenv express cors
npm install -D @types/bcryptjs @types/jsonwebtoken @types/express @types/cors @types/node

# Create admin user
npx ts-node src/seed.ts

# Start server
npm run dev
```

Server runs on http://localhost:5000

### 2. Client Setup
```bash
cd client
npm install axios react-router-dom
npm install -D @types/react-router-dom

# Start client
npm run dev
```

Client runs on http://localhost:5173

### 3. Login with admin account
Email: admin@4760weber.edu
Password: Admin1234!

## Files Added

### Server
- `server/src/db.ts` - JSON file database
- `server/src/seed.ts` - Admin user seeder
- `server/src/index.ts` - Main server file (REPLACE existing)
- `server/src/middleware/auth.ts` - JWT auth middleware
- `server/src/routes/auth.ts` - Login/register endpoints
- `server/.env` - Environment variables

### Client
- `client/src/App.tsx` - Main app with routing (REPLACE existing)
- `client/src/context/AuthContext.tsx` - Auth state management
- `client/src/pages/Login.tsx` - Login page
- `client/src/pages/Register.tsx` - Register page
- `client/src/pages/Dashboard.tsx` - Dashboard with placeholder buttons
- `client/src/pages/Auth.css` - Auth page styles
- `client/src/pages/Dashboard.css` - Dashboard styles
