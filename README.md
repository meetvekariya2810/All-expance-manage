# 💰 Smart Personal Expense Management System

A modern, responsive, secure full-stack web application designed for managing daily personal and shared expenses between two primary users (Admin & Second Person User) with role-based permissions, interactive analytics, budget monitoring, receipt uploads, and multi-format exports (PDF, Excel, CSV).

---

## 🌟 Key Features

### 👤 Role-Based Access Control (RBAC)
1. **Main Person (Admin)**:
   * Full access to all transactions across all users.
   * Add, edit, and delete any expense record.
   * Manage users (Add user, Enable/Disable account, Reset password).
   * Manage custom categories & global monthly budget.
   * View combined reports, analytics, and export metrics.
2. **Second Person (User - Bhavik Bhai)**:
   * Private account access.
   * View, add, edit, and delete **only their own** expense records.
   * View personal spending dashboard, category pie chart, and budget tracking.
   * Restricted from admin settings and user management.

---

## 🎨 UI & Aesthetics
* **Glassmorphism Design**: High-contrast, clean visual design with subtle backdrop blurs, soft card shadows, and vibrant accent colors.
* **Dark / Light Mode**: Instant client-side toggle for dark mode preference.
* **Interactive Charts**: Powered by Chart.js (Doughnut category distribution, Monthly spending line trend, and side-by-side user comparison bar chart).
* **Mobile Responsive**: Off-canvas sidebar drawer for seamless phone, tablet, and desktop viewports.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, Custom CSS3 Glassmorphism System, Bootstrap 5, JavaScript (ES6+), Chart.js.
* **Backend**: Node.js, Express.js (REST API, JWT Authentication, Multer file upload handling).
* **Database**: MongoDB with Mongoose ODM + automatic fallback to embedded JSON data store (`data_store.json`) for seamless zero-setup offline execution.
* **Exports**: PDFKit (PDF statement generation) & ExcelJS (Excel `.xlsx` spreadsheet exports).

---

## 📁 Project Folder Structure

```text
bhavik bhai expance/
├── .env                       # Environment configuration
├── .env.example               # Template for environment variables
├── package.json               # Dependencies and scripts
├── server.js                  # Express application entry point
├── data_store.json            # Local JSON fallback store (auto-generated)
├── src/
│   ├── config/
│   │   └── db.js              # Database connector & fallback handler
│   ├── controllers/
│   │   ├── authController.js  # Auth & login logic
│   │   ├── budgetController.js# Budget management
│   │   ├── categoryController.js# Category management
│   │   ├── expenseController.js # Expense CRUD & bulk deletion
│   │   ├── reportController.js # Analytics & PDF/Excel export
│   │   └── userController.js   # Admin user management
│   ├── middleware/
│   │   ├── auth.js            # JWT token & role verification
│   │   └── upload.js          # Multer receipt file upload engine
│   ├── models/
│   │   ├── ActivityLog.js     # User activity logs schema
│   │   ├── Budget.js          # Monthly budget schema
│   │   ├── Category.js        # Expense category schema
│   │   ├── Expense.js         # Main expense record schema
│   │   └── User.js            # User account & credentials schema
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── budgetRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── expenseRoutes.js
│   │   ├── reportRoutes.js
│   │   └── userRoutes.js
│   └── utils/
│       └── seedData.js        # Initial seeding script
└── public/
    ├── css/
    │   └── style.css          # Glassmorphic design system styles
    ├── js/
    │   ├── app.js             # Main SPA controller & event handlers
    │   ├── auth.js            # JWT session manager & role gating
    │   ├── charts.js          # Chart.js visualization logic
    │   └── export.js          # PDF/Excel/CSV client export helpers
    ├── uploads/
    │   └── receipts/          # Uploaded expense invoice receipts
    └── index.html             # Application single page layout
```

---

## 🔑 Default Login Credentials

The application auto-seeds sample accounts upon initial run:

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Main Person (Admin)** | `admin` | `admin123` | Full System Access |
| **Second Person (User)** | `bhavik` | `user123` | Personal Records Only |

---

## ⚡ Quick Start & Installation

### 1. Install Dependencies
Open terminal in the project directory and run:
```bash
npm install
```

### 2. Seed Initial Data (Optional)
To seed initial demo expenses and accounts:
```bash
npm run seed
```

### 3. Start Server
Run the Node.js server:
```bash
npm start
```

Navigate to `http://localhost:5000` in your web browser.

---

## 📡 REST API Documentation

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | POST | Public | User authentication & JWT generation |
| `/api/auth/me` | GET | Authenticated | Get current user profile |
| `/api/expenses` | GET | Authenticated | List expenses with search, filters, pagination |
| `/api/expenses` | POST | Authenticated | Create expense record with receipt upload |
| `/api/expenses/:id` | PUT | Owner/Admin | Edit expense record |
| `/api/expenses/:id` | DELETE | Owner/Admin | Delete expense record |
| `/api/expenses/bulk` | DELETE | Owner/Admin | Bulk delete multiple expense records |
| `/api/categories` | GET | Authenticated | List all active expense categories |
| `/api/categories` | POST | Admin | Create custom category |
| `/api/budgets` | GET | Authenticated | Get monthly budget status |
| `/api/budgets` | POST | Authenticated | Set monthly budget amount |
| `/api/reports/metrics` | GET | Authenticated | Get dashboard metric summaries |
| `/api/reports/export/pdf` | GET | Authenticated | Download PDF expense statement |
| `/api/reports/export/excel`| GET | Authenticated | Download Excel `.xlsx` spreadsheet |
| `/api/users` | GET | Admin | List all registered users |
| `/api/users` | POST | Admin | Create new user account |
| `/api/users/:id/status` | PATCH | Admin | Enable or disable user access |

---

## ☁️ Deployment Instructions

### Deploy Backend (Render / Railway)
1. Push source code to GitHub repository.
2. Create a Web Service on Render or Railway connected to the repo.
3. Set Environment Variables (`PORT`, `JWT_SECRET`, `MONGODB_URI`).
4. Set Build Command to `npm install` and Start Command to `node server.js`.

### Deploy Database (MongoDB Atlas)
1. Create a cluster on MongoDB Atlas.
2. Obtain connection string and set `MONGODB_URI` in `.env`.

---

## 📄 License
This project is licensed under the MIT License.
