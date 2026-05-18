# Grant Management System - LinkUp Group Project

Weber State University - CS Capstone Project

## Project Overview

A grant management system for Weber State University that allows administrators to manage colleges, departments, and grant applications.

---

## Tech Stack

**Frontend:** React + TypeScript + Vite  
**Backend:** Node.js + Express + TypeScript  
**Database:** JSON file storage (MongoDB integration planned)  
**Authentication:** JWT with bcrypt password hashing

---

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/TaylorChau/LinkUpGroupProject.git
   cd LinkUpGroupProject
   ```

2. **Server Setup**
   ```bash
   cd server
   npm install
   
   # Create the admin user (run once)
   npx tsx src/seed.ts
   
   # Start the development server
   npm run dev
   ```
   Server runs on **http://localhost:5000**

3. **Client Setup** (in a new terminal)
   ```bash
   cd client
   npm install
   
   # Start the development server
   npm run dev
   ```
   Client runs on **http://localhost:5173**

---

## Default Admin Credentials

| Field    | Value                     |
|----------|---------------------------|
| Email    | admin@4760weber.edu       |
| Password | Admin1234!                |

⚠️ **Change this password after first login in production**

---

## Project Structure

```
LinkUpGroupProject/
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   └── auth.ts          # Login/register endpoints
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT verification
│   │   ├── db.ts                # JSON file database helper
│   │   ├── seed.ts              # Admin user seeder
│   │   └── index.ts             # Server entry point
│   ├── .env                     # Environment variables
│   ├── package.json
│   └── tsconfig.json
│
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx        # Login page
│   │   │   ├── Register.tsx     # Registration page
│   │   │   ├── Dashboard.tsx    # Main dashboard
│   │   │   ├── Auth.css         # Auth page styles
│   │   │   └── Dashboard.css    # Dashboard styles
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # Auth state management
│   │   ├── App.tsx              # Main app with routing
│   │   └── main.tsx
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

---

## Features Implemented (Week 1)

- ✅ User registration with password confirmation
- ✅ Secure password encryption using bcrypt (12 rounds)
- ✅ JWT-based authentication with 7-day expiration
- ✅ Protected routes (redirect to login if not authenticated)
- ✅ Admin user seeding
- ✅ Dashboard with placeholder Colleges and Departments buttons
- ✅ Responsive UI design

---

## API Endpoints

### Authentication

| Method | Endpoint             | Description                      | Auth Required |
|--------|----------------------|----------------------------------|---------------|
| POST   | `/api/auth/register` | Create a new user account        | No            |
| POST   | `/api/auth/login`    | Login and receive JWT token      | No            |
| GET    | `/api/health`        | Server health check              | No            |

### Request/Response Examples

**Register**
```json
POST /api/auth/register
{
  "email": "user@4760weber.edu",
  "password": "password123",
  "confirmPassword": "password123"
}

Response: 201 Created
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1234567890",
    "email": "user@4760weber.edu",
    "role": "user"
  }
}
```

**Login**
```json
POST /api/auth/login
{
  "email": "admin@4760weber.edu",
  "password": "Admin1234!"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "email": "admin@4760weber.edu",
    "role": "admin"
  }
}
```

---

## Environment Variables

Create a `.env` file in the `server` directory:

```env
PORT=5000
JWT_SECRET=your_super_secret_key_change_this_in_production
```

---

## Development Workflow

1. Make sure both server and client are running (two terminals)
2. Server auto-reloads on file changes (using `tsx watch`)
3. Client auto-reloads on file changes (using Vite HMR)
4. Access the app at http://localhost:5173

---

## Upcoming Features (Future Weeks)

- [ ] College management (CRUD operations)
- [ ] Department management (CRUD operations)
- [ ] Grant creation and submission
- [ ] User role management (admin vs regular users)
- [ ] MongoDB integration
- [ ] File upload for grant proposals
- [ ] Grant approval workflow
- [ ] Email notifications

---

## Team Members

- [Add team member names here]

---

## License

This project is for educational purposes as part of Weber State University's CS Capstone course.