# 💸 ExpenseFlow - Smart Expense Tracker

A modern, full-stack expense tracking web application with group expense splitting, UPI payments, AI insights, and beautiful analytics.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)

## ✨ Features

### 📊 Personal Finance
- **Dashboard** with financial health score, spending trends, and AI insights
- **Expense Management** — add, edit, delete, and categorize expenses
- **Analytics** — interactive charts (spending trends, category breakdown)
- **Savings Goals** — set and track financial goals with progress bars
- **Smart Alerts** — get notified about unusual spending patterns

### 👥 Group Expense Splitting (Splitwise-style)
- **Create Groups** — organize shared expenses with friends, trips, or roommates
- **Split Expenses** — equally or selectively among chosen members
- **Balance Tracking** — see who owes whom with optimized settlements
- **Settle Up** — record payments and clear debts

### 📱 UPI Payments
- **Pay via UPI** — one-tap payment using GPay, PhonePe, Paytm
- **Manage UPI IDs** — add/update member UPI IDs anytime
- **Secure** — generates standard `upi://pay` deep links; no credentials stored

### 🛠️ Smart Tools
- **Receipt Scanner (OCR)** — scan receipts with Tesseract.js
- **SMS Parser** — extract expenses from bank SMS messages
- **CSV Import** — bulk import expenses from spreadsheets
- **Quick Add** — fast expense entry via floating action button

### 🔐 Authentication
- Email/password registration and login
- Google OAuth integration (requires setup)
- JWT-based session management
- Remember Me functionality

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/Varsha230404/Expense-Tracker.git
cd Expense-Tracker

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and set your JWT_SECRET
```

### Running the App

#### Production (single server):
```bash
npm run build    # Build frontend
npm start        # Start server → http://localhost:3001
```

#### Development (with hot reload):
```bash
npm run dev      # Start both servers → http://localhost:5174
```

### Access on Mobile
Both your phone and PC must be on the same WiFi:
1. Find your PC's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Open `http://YOUR_PC_IP:3001` on your phone

## 📁 Project Structure

```
expense-tracker/
├── index.html          # Main HTML (app shell)
├── main.js             # Frontend application logic
├── index.css           # Styles and design system
├── server.js           # Express backend (API + static serving)
├── package.json        # Dependencies and scripts
├── .env                # Environment variables (not tracked)
├── .gitignore          # Git ignore rules
└── dist/               # Production build (generated)
```

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3001
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=production
```

## 🌐 Deployment

### Deploy to Render (Free)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:** Set `JWT_SECRET`
5. Deploy!

### Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub**
3. Add env vars: `JWT_SECRET`, `PORT`
4. Done!

## 🛡️ Security

- Passwords hashed with **bcrypt**
- JWT-based authentication
- UPI payments handled via native UPI apps (no credentials stored)
- CORS enabled for cross-origin requests

## 📄 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Backend | Node.js, Express.js |
| Database | SQLite (via sql.js) |
| Build Tool | Vite |
| Charts | Chart.js |
| OCR | Tesseract.js |
| Auth | JWT, bcrypt, Google OAuth |

## 📝 License

This project is open source and available for personal and educational use.

---

Made with ❤️ by [Varsha](https://github.com/Varsha230404)
