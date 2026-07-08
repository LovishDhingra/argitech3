# 🌾 FarmSphere Local Execution Guide (using pnpm)

Follow this guide to set up and run the FarmSphere monorepo on your local machine using **pnpm**.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your local machine:
- **Node.js** (v18 or v20+ recommended)
- **pnpm** (Install globally via `npm install -g pnpm` if not already installed)
- **PostgreSQL** database (running locally or hosted on Cloud, e.g., Supabase / Neon)

---

## 🚀 Local Installation & Setup

### 1. Clone & Install Dependencies
Navigate to your project root directory and run:
```bash
pnpm install
```
This will automatically link all workspaces defined in `pnpm-workspace.yaml` and download packages for all services.

### 2. Configure Environment Variables (`.env`)
Create a `.env` file in the project root directory using `.env.example` as a template:
```env
# Database connection string (PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/farmsphere

# AI Integration
GROQ_API_KEY=your_groq_api_key_here

# User Authentication (Optional - if using Clerk in production)
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Live Mandi Price Data (Optional - data.gov.in)
DATA_GOV_IN_API_KEY=your_government_api_key
```

> **Note on Clerk Auth Bypass**: If you do not provide a `VITE_CLERK_PUBLISHABLE_KEY`, Vite will dynamically bundle a fully functional local Mock Auth Provider. You can sign in using any name and email directly in your browser.

---

## 💾 Database Migration

Before starting the server for the first time, apply the database schema:
```bash
pnpm --filter @workspace/db run push
```
This synchronizes your local PostgreSQL database with the Drizzle ORM schema and initializes all necessary tables.

---

## 🏃 Run the Application

You can start the entire stack using the root script or individual workspaces.

### Option A: Run everything with one command
```bash
pnpm dev
```
This runs:
- React Frontend (Vite) on port **5173**
- Express API Server on port **3000**

### Option B: Run components individually
To run the **API Server**:
```bash
pnpm --filter @workspace/api-server run dev
```

To run the **React Frontend**:
```bash
pnpm --filter @workspace/farmer-market run dev
```

---

## 🧪 Monorepo Commands Reference

- **Full Typecheck**:
  ```bash
  pnpm run typecheck
  ```
- **Build All Workspaces**:
  ```bash
  pnpm run build
  ```
- **Regenerate client-side API Hooks**:
  ```bash
  pnpm --filter @workspace/api-spec run codegen
  ```
