# 💰 Smart Personal Expense Management System (MERN Stack + MongoDB)

A modern, responsive, enterprise-grade full-stack **MERN** web application designed for managing daily personal and multi-user family expenses (**Admin: Bhavik Bhai**, **Users: Meet & Harsh**) with role-based access control (RBAC), interactive Chart.js analytics, monthly budget tracking, receipt attachment uploads, and multi-format reports (PDF, Excel, CSV).

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | **React 18 + Vite** | High-performance SPA with React Router, Context API, and modern reusable components |
| **Styling** | **Glassmorphism Design System** | Custom CSS3 glassmorphism, responsive navigation drawer, and seamless Dark/Light mode |
| **Charts** | **Chart.js + react-chartjs-2** | Category Doughnut, Monthly Spending Trend, Payment Breakdown, Daily Flow, and User Comparison |
| **Backend** | **Node.js + Express.js** | RESTful API architecture, JWT authentication, bcrypt password hashing, and Multer uploads |
| **Database** | **MongoDB + Mongoose** | **Authoritative primary database** with schema validation, indexing, and aggregation pipelines |
| **Reports** | **PDFKit & ExcelJS** | Server-side streamed PDF statements, formatted Excel `.xlsx` spreadsheets, and CSV exports |

---

## 📁 Clean MERN Project Structure

```text
bhavik-bhai-expance/
├── client/                     # React + Vite Frontend Application
│   ├── src/
│   │   ├── components/         # Reusable React components (Charts, Modals, StatCards, Header, Sidebar)
│   │   ├── context/            # Global state providers (AuthContext, ThemeContext, ToastContext)
│   │   ├── layouts/            # Layout wrappers (AppLayout with responsive sidebar & budget banner)
│   │   ├── pages/              # View pages (Dashboard, Expenses, Entry Form, Reports, Budget, Categories, Users)
│   │   ├── routes/             # Client routing & AdminRoute role protection
│   │   ├── services/           # Axios API services (auth, expenses, categories, budgets, reports, users)
│   │   ├── utils/              # Formatting helpers, constants, and payment methods
│   │   ├── App.jsx             # Root React application
│   │   ├── main.jsx            # React entry point
│   │   └── index.css           # Glassmorphism design system & theme variables
│   ├── package.json
│   └── vite.config.js          # Vite config with dev proxy to backend (/api -> :5000)
│
├── server/                     # Node.js + Express REST API Backend
│   ├── config/
│   │   └── db.js               # Authoritative MongoDB connection & zero-config embedded Mongo fallback
│   ├── controllers/            # Controller business logic (auth, expenses, budgets, categories, reports, users)
│   ├── middleware/             # JWT auth validation, role gating, and Multer file upload handler
│   ├── models/                 # Mongoose schemas (User, Expense, Category, Budget, ActivityLog)
│   ├── routes/                 # Express API routes
│   ├── uploads/                # Local uploaded receipt storage (/uploads/receipts/)
│   └── server.js               # Express server configuration & route mounting
│
├── scripts/
│   └── migrate.js              # Authoritative JSON to MongoDB migration script
│
├── data_store.backup.json      # Safe historical JSON snapshot backup
├── .env.example                # Environment variable configuration template
├── package.json                # Root orchestration scripts (concurrent dev, migrate, build, start)
└── server.js                   # Root application entry point
```

---

## 🔑 User Accounts & Access Roles

| Role | Username | Password | Permissions & Capabilities |
| :--- | :--- | :--- | :--- |
| **Main Admin (Bhavik Bhai)** | `bhavik` | `bhavik123` | **Full access**: View all users' expenses, manage categories, manage budgets, create/edit/delete/bulk-delete all records, switch dashboard view scopes, manage users (enable/disable/reset passwords), view family comparison analytics. |
| **Sub-Account 1 (Meet)** | `meet` | `meet123` | **Personal access**: View own personal dashboard, add/edit/delete own expenses, upload receipts, view own budget usage, export own statements. Strict backend protection blocks access to other members' data and admin controls. |
| **Sub-Account 2 (Harsh)** | `harsh` | `harsh123` | **Personal access**: Identical permissions to Meet. Strictly scoped to Harsh's own data. Blocked from other members' records and admin APIs. |

---

## ⚡ Quick Start & Development Commands

### 1. Prerequisites
- **Node.js**: v18 or later
- **MongoDB**: Local MongoDB daemon (`mongodb://127.0.0.1:27017/expense_tracker`), MongoDB Atlas URI, or zero-config automatic embedded MongoDB.

### 2. Installation
Install all dependencies (root server and React client):
```bash
npm install
npm --prefix client install
```

### 3. Migrate Historical Data to MongoDB
Run the migration script to import all historical users, 39 expenses, categories, and budgets into MongoDB:
```bash
npm run migrate
```

### 4. Run in Development Mode
Launch both backend and React Vite frontend concurrently:
```bash
npm run dev
```
- **React Frontend**: `http://localhost:5173`
- **Express Backend API**: `http://localhost:5000`

### 5. Production Build & Run
Build the optimized React production bundle and run the unified server:
```bash
npm run build
npm start
```
Open `http://localhost:5000` in your web browser.

---

## 📡 REST API Architecture

All endpoints are strictly authenticated via Bearer JWT token header or token query parameter:

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/health` | GET | Public | System status, architecture, and MongoDB connectivity |
| `/api/auth/login` | POST | Public | Authenticates user credentials & issues JWT token |
| `/api/auth/me` | GET | Authenticated | Retrieves current authenticated user profile & role |
| `/api/auth/profile` | PUT | Authenticated | Updates current user name, email, and mobile |
| `/api/auth/change-password` | POST | Authenticated | Updates current user password |
| `/api/expenses` | GET | Authenticated | Paginated, filtered, searchable expense records (role scoped) |
| `/api/expenses` | POST | Authenticated | Creates a new expense (with optional receipt file) |
| `/api/expenses/:id` | GET | Owner/Admin | Fetches single expense detail |
| `/api/expenses/:id` | PUT | Owner/Admin | Updates an existing expense |
| `/api/expenses/:id` | DELETE | Owner/Admin | Deletes an expense and removes attached receipt |
| `/api/expenses/bulk` | DELETE | Owner/Admin | Bulk deletes multiple expenses by ID list |
| `/api/expenses/clear-all` | DELETE | Owner/Admin | Clears expenses matching query filters |
| `/api/categories` | GET | Authenticated | Lists all active categories |
| `/api/categories` | POST | Admin | Creates a new category |
| `/api/categories/:id` | PUT | Admin | Updates category name or icon |
| `/api/categories/:id/status`| PATCH | Admin | Toggles category active/inactive status |
| `/api/budgets` | GET | Authenticated | Calculates monthly budget, spending, and percentage |
| `/api/budgets` | POST | Authenticated | Sets monthly budget limit |
| `/api/reports/metrics` | GET | Authenticated | Real MongoDB aggregation for stats & charts |
| `/api/reports/export/pdf` | GET | Authenticated | Generates and streams PDF statement |
| `/api/reports/export/excel`| GET | Authenticated | Generates and streams Excel `.xlsx` spreadsheet |
| `/api/reports/export/csv` | GET | Authenticated | Generates and streams CSV file |
| `/api/users` | GET | Admin | Lists all user accounts with spending statistics |
| `/api/users` | POST | Admin | Creates a new user account |
| `/api/users/:id` | PUT | Admin | Updates user name, email, mobile, role |
| `/api/users/:id/status` | PATCH | Admin | Enables or disables user account |
| `/api/users/:id/reset-password`| POST | Admin | Resets user password |

---

## 🔒 Security & Data Integrity Highlights

1. **Backend Authorization Enforcement**: Non-admin users are strictly scoped on the server layer. URL or query parameter tampering (`?person=...` or `?userId=...`) is ignored for non-admins.
2. **Authoritative MongoDB Persistence**: The application directly queries MongoDB with Mongoose models. Fallback JSON writing has been removed for runtime operations.
3. **Password Security**: Passwords are encrypted using `bcryptjs` with salt rounds. Plaintext passwords are never stored.
4. **Disabled Account Handling**: Real-time DB lookup in auth middleware invalidates sessions immediately if an account is disabled by Admin.
5. **Safe File Uploads**: Multer validates file types (JPEG, PNG, WEBP, PDF) and size limits (5MB), saving files with unique sanitized timestamps.

---

## 📄 License
MIT License
