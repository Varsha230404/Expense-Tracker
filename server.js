import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
let db;
const DB_PATH = process.env.NODE_ENV === 'production'
    ? '/tmp/expenses.db'
    : join(__dirname, 'expenses.db');

async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (existsSync(DB_PATH)) {
        const buffer = readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT,
      category_id INTEGER,
      user_id INTEGER,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      cover_image TEXT,
      author_id INTEGER,
      published INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

    // Create savings_goals table
    db.run(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      icon TEXT DEFAULT '🎯',
      color TEXT DEFAULT '#6366f1',
      deadline TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

    // Create group expense splitting tables
    db.run(`
    CREATE TABLE IF NOT EXISTS expense_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '👥',
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      user_id INTEGER,
      upi_id TEXT,
      FOREIGN KEY (group_id) REFERENCES expense_groups(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

    // Migration: add upi_id column if it doesn't exist (for existing databases)
    try { db.run('ALTER TABLE group_members ADD COLUMN upi_id TEXT'); } catch (e) { /* column already exists */ }

    db.run(`
    CREATE TABLE IF NOT EXISTS group_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      paid_by TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      split_type TEXT DEFAULT 'equal',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES expense_groups(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS group_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL,
      member_name TEXT NOT NULL,
      amount_owed REAL NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES group_expenses(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      from_member TEXT NOT NULL,
      to_member TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES expense_groups(id)
    )
  `);

    // Seed default categories if empty
    const result = db.exec('SELECT COUNT(*) as count FROM categories');
    const count = result.length > 0 ? result[0].values[0][0] : 0;

    if (count === 0) {
        const categories = [
            [1, 'Food & Dining', '🍔', '#FF6B6B'],
            [2, 'Transportation', '🚗', '#4ECDC4'],
            [3, 'Shopping', '🛍️', '#A855F7'],
            [4, 'Entertainment', '🎬', '#F59E0B'],
            [5, 'Bills & Utilities', '💡', '#3B82F6'],
            [6, 'Healthcare', '🏥', '#10B981'],
            [7, 'Travel', '✈️', '#EC4899'],
            [8, 'Education', '📚', '#6366F1'],
            [9, 'Personal Care', '💅', '#14B8A6'],
            [10, 'Other', '📦', '#64748B']
        ];

        categories.forEach(([id, name, icon, color]) => {
            db.run('INSERT INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?)', [id, name, icon, color]);
        });
    }

    // Seed sample blog posts if empty
    const blogResult = db.exec('SELECT COUNT(*) as count FROM blog_posts');
    const blogCount = blogResult.length > 0 ? blogResult[0].values[0][0] : 0;

    if (blogCount === 0) {
        const posts = [
            {
                title: '10 Tips to Save Money on Groceries',
                slug: '10-tips-save-money-groceries',
                content: `<p>Saving money on groceries doesn't have to mean sacrificing quality. Here are 10 practical tips to help you cut costs while still eating well.</p>
        <h2>1. Make a Shopping List</h2>
        <p>Before you head to the store, plan your meals for the week and create a detailed shopping list. Stick to it to avoid impulse purchases.</p>
        <h2>2. Use Coupons and Apps</h2>
        <p>Take advantage of digital coupons and cashback apps. Many stores have their own apps with exclusive deals.</p>
        <h2>3. Buy in Bulk</h2>
        <p>For non-perishables and items you use frequently, buying in bulk can lead to significant savings over time.</p>
        <h2>4. Shop Seasonal Produce</h2>
        <p>Fruits and vegetables in season are not only fresher but also cheaper. Plan your meals around what's in season.</p>
        <h2>5. Compare Unit Prices</h2>
        <p>Don't just look at the sticker price—compare the price per unit to find the best value.</p>
        <h2>6. Shop at Discount Stores</h2>
        <p>Stores like Aldi, Lidl, and Costco often offer the same products at significantly lower prices than traditional supermarkets.</p>
        <h2>7. Avoid Pre-Packaged Foods</h2>
        <p>Pre-cut vegetables, shredded cheese, and marinated meats cost more. Buy whole and do the prep yourself.</p>
        <h2>8. Never Shop Hungry</h2>
        <p>Shopping on an empty stomach leads to impulse buys. Eat before you go to stick to your list.</p>
        <h2>9. Check the Clearance Section</h2>
        <p>Many stores have clearance sections with discounted items near their sell-by date. These are often perfectly good for immediate use.</p>
        <h2>10. Grow Your Own Herbs</h2>
        <p>Fresh herbs are expensive but easy to grow. A small herb garden can save you money and add flavor to your meals.</p>`,
                excerpt: 'Learn practical strategies to reduce your grocery bill without sacrificing quality.',
                published: 1
            },
            {
                title: 'How to Create a Budget That Actually Works',
                slug: 'create-budget-that-works',
                content: `<p>Creating a budget is easy. Sticking to it? That's the hard part. Here's how to build a budget that you'll actually follow.</p>
        <h2>Understand Your Income</h2>
        <p>Start by calculating your total monthly income after taxes. This is your starting point for all budgeting decisions.</p>
        <h2>Track Your Spending</h2>
        <p>For one month, track every single expense. Use an app or spreadsheet to categorize where your money goes.</p>
        <h2>Use the 50/30/20 Rule</h2>
        <p>Allocate 50% of income to needs, 30% to wants, and 20% to savings and debt repayment.</p>
        <h2>Automate Your Savings</h2>
        <p>Set up automatic transfers to your savings account on payday. You can't spend what you don't see.</p>`,
                excerpt: 'A step-by-step guide to creating a sustainable budget that fits your lifestyle.',
                published: 1
            },
            {
                title: 'The Ultimate Guide to Tracking Expenses',
                slug: 'ultimate-guide-tracking-expenses',
                content: `<p>Expense tracking is the foundation of financial awareness. Without knowing where your money goes, you can't make informed decisions about your finances.</p>
        <h2>Why Track Expenses?</h2>
        <p>Tracking expenses helps you identify spending patterns, find areas to cut back, and ensure you're meeting your financial goals.</p>
        <h2>Choose Your Method</h2>
        <p>Whether it's a simple spreadsheet, a dedicated app, or good old pen and paper, find a method that works for your lifestyle.</p>
        <h2>Categorize Everything</h2>
        <p>Group your expenses into categories like food, transportation, entertainment, and bills. This makes it easier to analyze your spending.</p>
        <h2>Review Regularly</h2>
        <p>Set aside time each week to review your expenses. Look for patterns and areas where you can improve.</p>`,
                excerpt: 'Master the art of expense tracking to take control of your financial future.',
                published: 1
            }
        ];

        posts.forEach(post => {
            db.run(
                'INSERT INTO blog_posts (title, slug, content, excerpt, published) VALUES (?, ?, ?, ?, ?)',
                [post.title, post.slug, post.content, post.excerpt, post.published]
            );
        });
    }

    saveDatabase();
}

function saveDatabase() {
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error('Failed to save database:', err.message);
    }
}

// Helper to run queries
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function queryOne(sql, params = []) {
    const results = queryAll(sql, params);
    return results[0] || null;
}

function runQuery(sql, params = []) {
    db.run(sql, params);
    saveDatabase();
    // Get last insert rowid properly
    const result = db.exec('SELECT last_insert_rowid() as id');
    const lastId = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : null;
    return { lastInsertRowid: lastId };
}

// ============== AUTH MIDDLEWARE ==============
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Optional auth - doesn't fail if no token
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            // Invalid token, but we continue anyway
        }
    }
    next();
}

// ============== AUTH ROUTES ==============

// Security validation helpers
const securityValidation = {
    // Email validation
    isValidEmail(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    },

    // Password strength validation
    validatePassword(password) {
        const errors = [];
        if (password.length < 8) errors.push('Password must be at least 8 characters');
        if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
        if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
        if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain at least one special character');
        return errors;
    },

    // Name sanitization
    sanitizeName(name) {
        return name.replace(/<[^>]*>/g, '').trim().slice(0, 100);
    },

    // XSS prevention
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
};

// Rate limiting for login attempts (in-memory store)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(email) {
    const attempts = loginAttempts.get(email);
    if (!attempts) return { allowed: true };

    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        const timeSinceLockout = Date.now() - attempts.lastAttempt;
        if (timeSinceLockout < LOCKOUT_DURATION) {
            const remainingMinutes = Math.ceil((LOCKOUT_DURATION - timeSinceLockout) / 60000);
            return { allowed: false, message: `Too many failed attempts. Try again in ${remainingMinutes} minutes.` };
        }
        // Reset after lockout period
        loginAttempts.delete(email);
    }
    return { allowed: true };
}

function recordFailedAttempt(email) {
    const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(email, attempts);
}

function clearAttempts(email) {
    loginAttempts.delete(email);
}

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Required fields check
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        // Email validation
        if (!securityValidation.isValidEmail(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        // Password strength validation
        const passwordErrors = securityValidation.validatePassword(password);
        if (passwordErrors.length > 0) {
            return res.status(400).json({
                error: 'Password does not meet requirements',
                details: passwordErrors
            });
        }

        // Name validation
        const sanitizedName = securityValidation.sanitizeName(name);
        if (sanitizedName.length < 2) {
            return res.status(400).json({ error: 'Name must be at least 2 characters' });
        }

        // Check if user exists
        const existing = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password with stronger salt rounds
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        runQuery(
            'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email.toLowerCase(), hashedPassword, sanitizedName]
        );

        // Fetch the newly created user by email
        const user = queryOne('SELECT id, email, name, created_at FROM users WHERE email = ?', [email.toLowerCase()]);

        if (!user) {
            return res.status(500).json({ error: 'Failed to create user' });
        }

        // Generate token
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ user, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Email format validation
        if (!securityValidation.isValidEmail(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        // Check rate limiting
        const rateLimitCheck = checkRateLimit(email.toLowerCase());
        if (!rateLimitCheck.allowed) {
            return res.status(429).json({ error: rateLimitCheck.message });
        }

        // Find user
        const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) {
            recordFailedAttempt(email.toLowerCase());
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            recordFailedAttempt(email.toLowerCase());
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Clear failed attempts on successful login
        clearAttempts(email.toLowerCase());

        // Generate token
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Google OAuth Login
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ error: 'Google credential is required' });
        }

        // Decode the JWT from Google (in production, verify with Google's API)
        // The credential is a JWT from Google
        const base64Payload = credential.split('.')[1];
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));

        const { email, name, sub: googleId, picture } = payload;

        if (!email) {
            return res.status(400).json({ error: 'Email not provided by Google' });
        }

        // Check if user exists
        let user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

        if (!user) {
            // Create new user from Google data
            const randomPassword = await bcrypt.hash(Math.random().toString(36), 12);

            runQuery(
                'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
                [email.toLowerCase(), randomPassword, name || email.split('@')[0]]
            );

            user = queryOne('SELECT id, email, name, created_at FROM users WHERE email = ?', [email.toLowerCase()]);

            if (!user) {
                return res.status(500).json({ error: 'Failed to create user' });
            }
        }

        // Generate our JWT token
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token });

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Failed to authenticate with Google' });
    }
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
    try {
        const user = queryOne('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== CATEGORY ROUTES ==============

app.get('/api/categories', (req, res) => {
    try {
        const categories = queryAll('SELECT * FROM categories ORDER BY name');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== EXPENSE ROUTES (Protected) ==============

// GET all expenses for current user
app.get('/api/expenses', authMiddleware, (req, res) => {
    try {
        const { startDate, endDate, category_id, limit } = req.query;
        let query = `
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = ?
    `;
        const params = [req.user.id];

        if (startDate) {
            query += ' AND e.date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND e.date <= ?';
            params.push(endDate);
        }
        if (category_id) {
            query += ' AND e.category_id = ?';
            params.push(parseInt(category_id));
        }

        query += ' ORDER BY e.date DESC, e.created_at DESC';

        if (limit) {
            query += ' LIMIT ?';
            params.push(parseInt(limit));
        }

        const expenses = queryAll(query, params);
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single expense
app.get('/api/expenses/:id', authMiddleware, (req, res) => {
    try {
        const expense = queryOne(`
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.id = ? AND e.user_id = ?
    `, [parseInt(req.params.id), req.user.id]);

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json(expense);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE expense
app.post('/api/expenses', authMiddleware, (req, res) => {
    try {
        const { amount, description, category_id, date } = req.body;

        if (!amount || !date) {
            return res.status(400).json({ error: 'Amount and date are required' });
        }

        runQuery(`
      INSERT INTO expenses (amount, description, category_id, user_id, date)
      VALUES (?, ?, ?, ?, ?)
    `, [amount, description || '', category_id || null, req.user.id, date]);

        // Get the most recently created expense for this user
        const newExpense = queryOne(`
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = ?
      ORDER BY e.id DESC
      LIMIT 1
    `, [req.user.id]);

        res.status(201).json(newExpense);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE expense
app.put('/api/expenses/:id', authMiddleware, (req, res) => {
    try {
        const { amount, description, category_id, date } = req.body;
        const id = parseInt(req.params.id);

        const existing = queryOne('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        runQuery(`
      UPDATE expenses 
      SET amount = ?, description = ?, category_id = ?, date = ?
      WHERE id = ? AND user_id = ?
    `, [
            amount ?? existing.amount,
            description ?? existing.description,
            category_id ?? existing.category_id,
            date ?? existing.date,
            id,
            req.user.id
        ]);

        const updated = queryOne(`
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.id = ?
    `, [id]);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE expense
app.delete('/api/expenses/:id', authMiddleware, (req, res) => {
    try {
        const existing = queryOne('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [parseInt(req.params.id), req.user.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        runQuery('DELETE FROM expenses WHERE id = ? AND user_id = ?', [parseInt(req.params.id), req.user.id]);
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== ANALYTICS ROUTES (Protected) ==============

app.get('/api/analytics/summary', authMiddleware, (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const now = new Date();
        const defaultStart = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const defaultEnd = endDate || now.toISOString().split('T')[0];

        const summary = queryOne(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_spent,
        COALESCE(AVG(amount), 0) as average_expense,
        COALESCE(MAX(amount), 0) as highest_expense,
        COALESCE(MIN(amount), 0) as lowest_expense
      FROM expenses
      WHERE user_id = ? AND date >= ? AND date <= ?
    `, [req.user.id, defaultStart, defaultEnd]) || {
            total_transactions: 0,
            total_spent: 0,
            average_expense: 0,
            highest_expense: 0,
            lowest_expense: 0
        };

        const daysDiff = Math.ceil((new Date(defaultEnd) - new Date(defaultStart)) / (1000 * 60 * 60 * 24));
        const prevEnd = new Date(defaultStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - daysDiff);

        const prevSummary = queryOne(`
      SELECT COALESCE(SUM(amount), 0) as total_spent
      FROM expenses
      WHERE user_id = ? AND date >= ? AND date <= ?
    `, [req.user.id, prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]]) || { total_spent: 0 };

        res.json({
            ...summary,
            previous_period_spent: prevSummary.total_spent,
            period_start: defaultStart,
            period_end: defaultEnd
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/by-category', authMiddleware, (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const now = new Date();
        const defaultStart = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const defaultEnd = endDate || now.toISOString().split('T')[0];

        const byCategory = queryAll(`
      SELECT 
        c.id,
        c.name,
        c.icon,
        c.color,
        COUNT(e.id) as transaction_count,
        COALESCE(SUM(e.amount), 0) as total_amount
      FROM categories c
      LEFT JOIN expenses e ON c.id = e.category_id AND e.user_id = ? AND e.date >= ? AND e.date <= ?
      GROUP BY c.id
      ORDER BY total_amount DESC
    `, [req.user.id, defaultStart, defaultEnd]);

        res.json(byCategory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/daily', authMiddleware, (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const now = new Date();
        const defaultStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const defaultEnd = endDate || now.toISOString().split('T')[0];

        const daily = queryAll(`
      SELECT 
        date,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM expenses
      WHERE user_id = ? AND date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `, [req.user.id, defaultStart, defaultEnd]);

        res.json(daily);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== FEATURE 1: AI SPENDING INSIGHTS ==============

app.get('/api/insights', authMiddleware, (req, res) => {
    try {
        const insights = [];

        // Get current month spending
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const today = now.toISOString().split('T')[0];

        // Last month for comparison
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthStart = lastMonth.toISOString().split('T')[0];
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

        // Current month total
        const currentTotal = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
            WHERE user_id = ? AND date >= ? AND date <= ?
        `, [req.user.id, monthStart, today]) || { total: 0 };

        // Last month total
        const lastMonthTotal = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
            WHERE user_id = ? AND date >= ? AND date <= ?
        `, [req.user.id, lastMonthStart, lastMonthEnd]) || { total: 0 };

        // Compare spending
        if (lastMonthTotal.total > 0) {
            const percentChange = ((currentTotal.total - lastMonthTotal.total) / lastMonthTotal.total * 100).toFixed(1);
            if (percentChange > 20) {
                insights.push({
                    type: 'warning',
                    icon: '📈',
                    title: 'Spending Up',
                    message: `You're spending ${percentChange}% more than last month. Consider reviewing your expenses.`,
                    priority: 1
                });
            } else if (percentChange < -10) {
                insights.push({
                    type: 'success',
                    icon: '🎉',
                    title: 'Great Saving!',
                    message: `You've reduced spending by ${Math.abs(percentChange)}% compared to last month!`,
                    priority: 2
                });
            }
        }

        // Top spending category this month
        const topCategory = queryOne(`
            SELECT c.name, c.icon, COALESCE(SUM(e.amount), 0) as total
            FROM expenses e
            JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = ? AND e.date >= ? AND e.date <= ?
            GROUP BY c.id ORDER BY total DESC LIMIT 1
        `, [req.user.id, monthStart, today]);

        if (topCategory && topCategory.total > 0) {
            insights.push({
                type: 'info',
                icon: topCategory.icon || '💰',
                title: `Top Category: ${topCategory.name}`,
                message: `${topCategory.name} is your biggest expense this month at ${topCategory.total.toFixed(2)}.`,
                priority: 3
            });
        }

        // Average daily spending
        const daysInMonth = now.getDate();
        const avgDaily = currentTotal.total / daysInMonth;
        const projectedMonthly = avgDaily * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        insights.push({
            type: 'info',
            icon: '📊',
            title: 'Monthly Projection',
            message: `At your current pace, you'll spend approximately ${projectedMonthly.toFixed(2)} this month.`,
            priority: 4
        });

        // Find unused categories (potential savings)
        const unusedCategories = queryAll(`
            SELECT c.name FROM categories c
            LEFT JOIN expenses e ON c.id = e.category_id AND e.user_id = ? AND e.date >= ?
            WHERE e.id IS NULL LIMIT 3
        `, [req.user.id, monthStart]);

        if (unusedCategories.length > 0) {
            insights.push({
                type: 'tip',
                icon: '💡',
                title: 'Spending Tip',
                message: `You haven't spent on ${unusedCategories.map(c => c.name).join(', ')} this month. Great discipline!`,
                priority: 5
            });
        }

        res.json(insights.sort((a, b) => a.priority - b.priority));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== FEATURE 2: GAMIFICATION (ACHIEVEMENTS & STREAKS) ==============

app.get('/api/achievements', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const achievements = [];

        // Total expenses count
        const totalExpenses = queryOne('SELECT COUNT(*) as count FROM expenses WHERE user_id = ?', [userId]);

        // Achievement: First Expense
        if (totalExpenses.count >= 1) {
            achievements.push({ id: 'first_expense', name: 'First Step', icon: '🎯', description: 'Logged your first expense', unlocked: true });
        }

        // Achievement: 10 Expenses
        if (totalExpenses.count >= 10) {
            achievements.push({ id: 'ten_expenses', name: 'Getting Started', icon: '📝', description: 'Logged 10 expenses', unlocked: true });
        }

        // Achievement: 50 Expenses
        if (totalExpenses.count >= 50) {
            achievements.push({ id: 'fifty_expenses', name: 'Dedicated Tracker', icon: '📊', description: 'Logged 50 expenses', unlocked: true });
        }

        // Achievement: 100 Expenses
        achievements.push({
            id: 'hundred_expenses',
            name: 'Expense Master',
            icon: '🏆',
            description: 'Logged 100 expenses',
            unlocked: totalExpenses.count >= 100,
            progress: Math.min(100, (totalExpenses.count / 100) * 100)
        });

        // Calculate streak (consecutive days with expenses)
        const recentDays = queryAll(`
            SELECT DISTINCT date FROM expenses 
            WHERE user_id = ? 
            ORDER BY date DESC LIMIT 30
        `, [userId]);

        let streak = 0;
        let checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);

        for (const row of recentDays) {
            const expenseDate = new Date(row.date);
            expenseDate.setHours(0, 0, 0, 0);

            if (expenseDate.getTime() === checkDate.getTime()) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else if (expenseDate < checkDate) {
                break;
            }
        }

        // Streak achievements
        if (streak >= 3) {
            achievements.push({ id: 'streak_3', name: '3-Day Streak', icon: '🔥', description: 'Logged expenses for 3 days straight', unlocked: true });
        }
        if (streak >= 7) {
            achievements.push({ id: 'streak_7', name: 'Week Warrior', icon: '💪', description: '7-day logging streak', unlocked: true });
        }
        if (streak >= 30) {
            achievements.push({ id: 'streak_30', name: 'Monthly Champion', icon: '🏅', description: '30-day logging streak', unlocked: true });
        }

        // Total saved (if we track income, for now use a mock)
        const totalSpent = queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?', [userId]);

        if (totalSpent.total >= 10000) {
            achievements.push({ id: 'big_spender', name: 'Big Tracker', icon: '💰', description: 'Tracked 10,000+ in expenses', unlocked: true });
        }

        res.json({
            achievements: achievements.sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0)),
            stats: {
                currentStreak: streak,
                totalExpenses: totalExpenses.count,
                totalTracked: totalSpent.total
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== FEATURE 3: SMART ALERTS ==============

app.get('/api/alerts', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        const alerts = [];
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Get average spending per category
        const categoryAverages = queryAll(`
            SELECT c.id, c.name, c.icon, AVG(e.amount) as avg_amount
            FROM expenses e
            JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = ? AND e.date >= date('now', '-30 days')
            GROUP BY c.id
        `, [userId]);

        // Check today's expenses for anomalies
        const todayExpenses = queryAll(`
            SELECT e.*, c.name as category_name, c.icon as category_icon
            FROM expenses e
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = ? AND e.date = ?
        `, [userId, today]);

        for (const expense of todayExpenses) {
            const categoryAvg = categoryAverages.find(c => c.id === expense.category_id);
            if (categoryAvg && expense.amount > categoryAvg.avg_amount * 2) {
                alerts.push({
                    type: 'warning',
                    icon: '⚠️',
                    title: 'Unusual Expense',
                    message: `Your ${expense.category_name} expense of ${expense.amount} is ${((expense.amount / categoryAvg.avg_amount - 1) * 100).toFixed(0)}% above average.`,
                    expenseId: expense.id
                });
            }
        }

        // Check for potential duplicate expenses
        const recentDuplicates = queryAll(`
            SELECT amount, description, COUNT(*) as count
            FROM expenses
            WHERE user_id = ? AND date >= date('now', '-7 days')
            GROUP BY amount, description
            HAVING count > 1
        `, [userId]);

        for (const dup of recentDuplicates) {
            alerts.push({
                type: 'info',
                icon: '🔄',
                title: 'Possible Duplicate',
                message: `You have ${dup.count} similar expenses of ${dup.amount} for "${dup.description || 'unnamed'}".`
            });
        }

        // Budget warning (if spending more than projected)
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthSpent = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
            WHERE user_id = ? AND date >= ?
        `, [userId, monthStart]) || { total: 0 };

        // Get last 3 months average
        const threeMonthAvg = queryOne(`
            SELECT COALESCE(AVG(monthly_total), 0) as avg FROM (
                SELECT SUM(amount) as monthly_total
                FROM expenses
                WHERE user_id = ? AND date >= date('now', '-90 days')
                GROUP BY strftime('%Y-%m', date)
            )
        `, [userId]) || { avg: 0 };

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projectedSpend = (monthSpent.total / now.getDate()) * daysInMonth;

        if (threeMonthAvg.avg > 0 && projectedSpend > threeMonthAvg.avg * 1.2) {
            alerts.push({
                type: 'warning',
                icon: '📊',
                title: 'Budget Alert',
                message: `At current pace, you'll spend ${((projectedSpend / threeMonthAvg.avg - 1) * 100).toFixed(0)}% more than your 3-month average.`
            });
        }

        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== FEATURE 4: FINANCIAL HEALTH SCORE ==============

app.get('/api/health-score', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        let score = 50; // Start with neutral score
        const factors = [];

        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        // Factor 1: Consistency (regular tracking)
        const trackingDays = queryOne(`
            SELECT COUNT(DISTINCT date) as days FROM expenses 
            WHERE user_id = ? AND date >= date('now', '-30 days')
        `, [userId]) || { days: 0 };

        const consistencyScore = Math.min(20, (trackingDays.days / 30) * 20);
        score += consistencyScore - 10;
        factors.push({
            name: 'Tracking Consistency',
            score: Math.round(consistencyScore),
            maxScore: 20,
            status: trackingDays.days >= 20 ? 'excellent' : trackingDays.days >= 10 ? 'good' : 'needs_work'
        });

        // Factor 2: Spending trend (compared to last month)
        const currentSpend = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
            WHERE user_id = ? AND date >= ?
        `, [userId, monthStart]) || { total: 0 };

        const lastMonthSpend = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
            WHERE user_id = ? AND date >= date('now', '-60 days') AND date < date('now', '-30 days')
        `, [userId]) || { total: 0 };

        let trendScore = 15;
        if (lastMonthSpend.total > 0) {
            const change = (currentSpend.total - lastMonthSpend.total) / lastMonthSpend.total;
            if (change < -0.1) trendScore = 20; // Spending down
            else if (change > 0.2) trendScore = 5; // Spending up significantly
        }
        score += trendScore - 10;
        factors.push({
            name: 'Spending Trend',
            score: Math.round(trendScore),
            maxScore: 20,
            status: trendScore >= 15 ? 'excellent' : trendScore >= 10 ? 'good' : 'needs_work'
        });

        // Factor 3: Category diversity (not overspending in one area)
        const categorySpread = queryAll(`
            SELECT c.name, SUM(e.amount) as total
            FROM expenses e JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = ? AND e.date >= ?
            GROUP BY c.id
        `, [userId, monthStart]);

        let diversityScore = 15;
        if (categorySpread.length > 0) {
            const totalSpent = categorySpread.reduce((sum, c) => sum + c.total, 0);
            const maxCategory = Math.max(...categorySpread.map(c => c.total));
            const maxPercent = (maxCategory / totalSpent) * 100;

            if (maxPercent > 60) diversityScore = 5;
            else if (maxPercent < 40) diversityScore = 20;
        }
        score += diversityScore - 10;
        factors.push({
            name: 'Spending Diversity',
            score: Math.round(diversityScore),
            maxScore: 20,
            status: diversityScore >= 15 ? 'excellent' : diversityScore >= 10 ? 'good' : 'needs_work'
        });

        // Factor 4: Average expense size (smaller = more controlled)
        const avgExpense = queryOne(`
            SELECT COALESCE(AVG(amount), 0) as avg FROM expenses 
            WHERE user_id = ? AND date >= ?
        `, [userId, monthStart]) || { avg: 0 };

        let controlScore = 15;
        if (avgExpense.avg > 1000) controlScore = 8;
        else if (avgExpense.avg < 200) controlScore = 20;

        score += controlScore - 10;
        factors.push({
            name: 'Expense Control',
            score: Math.round(controlScore),
            maxScore: 20,
            status: controlScore >= 15 ? 'excellent' : controlScore >= 10 ? 'good' : 'needs_work'
        });

        // Normalize score to 0-100
        score = Math.max(0, Math.min(100, score));

        res.json({
            score: Math.round(score),
            grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F',
            factors,
            tips: score < 60 ? [
                'Track expenses daily to improve consistency',
                'Review your top spending category for savings opportunities',
                'Set spending limits for each category'
            ] : ['Great job! Keep maintaining your financial habits.']
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== FEATURE 5: SAVINGS GOALS ==============

app.get('/api/goals', authMiddleware, (req, res) => {
    try {
        const goals = queryAll(`
            SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC
        `, [req.user.id]);

        const goalsWithProgress = goals.map(goal => ({
            id: goal.id,
            name: goal.name,
            targetAmount: goal.target_amount,
            currentAmount: goal.current_amount,
            icon: goal.icon,
            color: goal.color,
            deadline: goal.deadline,
            progress: goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0,
            remaining: goal.target_amount - goal.current_amount,
            daysLeft: goal.deadline ? Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null
        }));

        res.json(goalsWithProgress);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/goals', authMiddleware, (req, res) => {
    try {
        const { name, targetAmount, deadline, icon, color } = req.body;

        if (!name || !targetAmount) {
            return res.status(400).json({ error: 'Name and target amount are required' });
        }

        // Save to database
        runQuery(`
            INSERT INTO savings_goals (user_id, name, target_amount, icon, color, deadline)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [req.user.id, name, parseFloat(targetAmount), icon || '🎯', color || '#6366f1', deadline || null]);

        // Get the newly created goal
        const newGoal = queryOne(`
            SELECT * FROM savings_goals WHERE user_id = ? ORDER BY id DESC LIMIT 1
        `, [req.user.id]);

        res.status(201).json({
            id: newGoal.id,
            name: newGoal.name,
            targetAmount: newGoal.target_amount,
            currentAmount: newGoal.current_amount,
            icon: newGoal.icon,
            color: newGoal.color,
            deadline: newGoal.deadline,
            progress: 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update goal progress
app.put('/api/goals/:id', authMiddleware, (req, res) => {
    try {
        const { currentAmount, name, targetAmount, icon, color, deadline } = req.body;
        const goalId = parseInt(req.params.id);

        // Verify goal belongs to user
        const goal = queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, req.user.id]);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        runQuery(`
            UPDATE savings_goals SET 
                current_amount = COALESCE(?, current_amount),
                name = COALESCE(?, name),
                target_amount = COALESCE(?, target_amount),
                icon = COALESCE(?, icon),
                color = COALESCE(?, color),
                deadline = COALESCE(?, deadline)
            WHERE id = ? AND user_id = ?
        `, [currentAmount, name, targetAmount, icon, color, deadline, goalId, req.user.id]);

        const updatedGoal = queryOne('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
        res.json(updatedGoal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete goal
app.delete('/api/goals/:id', authMiddleware, (req, res) => {
    try {
        const goalId = parseInt(req.params.id);

        const goal = queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, req.user.id]);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        runQuery('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, req.user.id]);
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== SMS TRANSACTION PARSER ==============
// Parses Indian bank SMS messages to extract transaction details

app.post('/api/parse-sms', authMiddleware, (req, res) => {
    try {
        const { smsText } = req.body;

        if (!smsText || smsText.trim().length === 0) {
            return res.status(400).json({ error: 'SMS text is required' });
        }

        const result = parseIndianBankSMS(smsText);

        if (!result.success) {
            return res.status(400).json({ error: result.error || 'Could not parse SMS' });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SMS Parser Function for Indian Banks
function parseIndianBankSMS(sms) {
    const text = sms.toLowerCase().trim();
    const originalText = sms.trim();

    // Detect if this is a transaction SMS
    const isTransaction = /debited|credited|spent|received|withdrawn|transferred|paid|payment|txn|transaction|debit|credit/i.test(text);
    if (!isTransaction) {
        return { success: false, error: 'This does not appear to be a transaction SMS' };
    }

    // Determine transaction type
    const isDebit = /debited|spent|withdrawn|paid|payment of|sent|debit/i.test(text) && !/credited/i.test(text);
    const isCredit = /credited|received|credit|refund/i.test(text);

    if (!isDebit && !isCredit) {
        return { success: false, error: 'Could not determine transaction type' };
    }

    // Extract amount - multiple patterns for different banks
    const amountPatterns = [
        /rs\.?\s*([\d,]+(?:\.\d{2})?)/i,
        /inr\.?\s*([\d,]+(?:\.\d{2})?)/i,
        /₹\s*([\d,]+(?:\.\d{2})?)/i,
        /rupees?\s*([\d,]+(?:\.\d{2})?)/i,
        /amount[:\s]+(?:rs\.?|inr\.?|₹)?\s*([\d,]+(?:\.\d{2})?)/i,
        /([\d,]+(?:\.\d{2})?)\s*(?:rs|inr|₹)/i
    ];

    let amount = null;
    for (const pattern of amountPatterns) {
        const match = originalText.match(pattern);
        if (match) {
            amount = parseFloat(match[1].replace(/,/g, ''));
            break;
        }
    }

    if (!amount || amount <= 0) {
        return { success: false, error: 'Could not extract transaction amount' };
    }

    // Detect bank
    const bankPatterns = {
        'HDFC': /hdfc/i,
        'ICICI': /icici/i,
        'SBI': /sbi|state bank/i,
        'Axis': /axis/i,
        'Kotak': /kotak/i,
        'Yes Bank': /yes bank|yesbank/i,
        'BOB': /bob|bank of baroda/i,
        'PNB': /pnb|punjab national/i,
        'Canara': /canara/i,
        'IDFC': /idfc/i,
        'IndusInd': /indusind/i,
        'Federal Bank': /federal/i,
        'Paytm': /paytm/i,
        'PhonePe': /phonepe/i,
        'GPay': /gpay|google pay/i
    };

    let bank = 'Unknown';
    for (const [bankName, pattern] of Object.entries(bankPatterns)) {
        if (pattern.test(text)) {
            bank = bankName;
            break;
        }
    }

    // Extract merchant/description
    const merchantPatterns = [
        /(?:at|to|from|@)\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+ref|\s+upi|\s*$)/i,
        /(?:vpa|upi)[:\s]+([a-z0-9@\.\-]+)/i,
        /(?:to|from)\s+(?:a\/c|ac|account)?\s*([A-Za-z0-9\s]+?)(?:\s+on|\s+ref|\s*$)/i,
        /paid to\s+([A-Za-z0-9\s&\-\.]+)/i,
        /transfer to\s+([A-Za-z0-9\s&\-\.]+)/i,
        /received from\s+([A-Za-z0-9\s&\-\.]+)/i
    ];

    let merchant = '';
    for (const pattern of merchantPatterns) {
        const match = originalText.match(pattern);
        if (match) {
            merchant = match[1].trim().substring(0, 50);
            break;
        }
    }

    // Extract date if available
    const datePatterns = [
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
        /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{2,4}?)/i,
        /on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i
    ];

    let transactionDate = new Date().toISOString().split('T')[0];
    for (const pattern of datePatterns) {
        const match = originalText.match(pattern);
        if (match) {
            try {
                const parsed = new Date(match[1]);
                if (!isNaN(parsed.getTime())) {
                    transactionDate = parsed.toISOString().split('T')[0];
                }
            } catch (e) { }
            break;
        }
    }

    // Auto-categorize based on merchant/keywords
    const categoryMapping = {
        1: ['food', 'restaurant', 'cafe', 'pizza', 'burger', 'swiggy', 'zomato', 'dominos', 'kfc', 'mcdonalds', 'starbucks', 'dunkin', 'bakery', 'meal', 'lunch', 'dinner', 'breakfast'],
        2: ['uber', 'ola', 'rapido', 'cab', 'taxi', 'auto', 'metro', 'irctc', 'railway', 'petrol', 'diesel', 'fuel', 'parking', 'fastag', 'toll'],
        3: ['amazon', 'flipkart', 'myntra', 'ajio', 'shopping', 'mall', 'store', 'mart', 'retail', 'shop', 'buy', 'purchase', 'meesho', 'nykaa'],
        4: ['netflix', 'prime', 'hotstar', 'spotify', 'movie', 'cinema', 'pvr', 'inox', 'game', 'play', 'subscription', 'disney', 'youtube'],
        5: ['electricity', 'bill', 'recharge', 'airtel', 'jio', 'vodafone', 'vi ', 'bsnl', 'water', 'gas', 'dth', 'tata sky', 'broadband', 'internet', 'wifi'],
        6: ['rent', 'housing', 'apartment', 'flat', 'maintenance', 'society'],
        7: ['hospital', 'medical', 'pharmacy', 'medicine', 'doctor', 'clinic', 'health', 'apollo', 'max', 'fortis', '1mg', 'netmeds', 'pharmeasy'],
        8: ['school', 'college', 'tuition', 'course', 'udemy', 'coursera', 'book', 'education', 'coaching', 'exam'],
        9: ['atm', 'cash', 'withdrawal', 'withdrawn']
    };

    let categoryId = 10; // Default: Other
    const searchText = (merchant + ' ' + text).toLowerCase();

    for (const [catId, keywords] of Object.entries(categoryMapping)) {
        if (keywords.some(kw => searchText.includes(kw))) {
            categoryId = parseInt(catId);
            break;
        }
    }

    // Get category name
    const categoryNames = {
        1: 'Food & Dining', 2: 'Transportation', 3: 'Shopping', 4: 'Entertainment',
        5: 'Bills & Utilities', 6: 'Housing', 7: 'Healthcare', 8: 'Education',
        9: 'Cash Withdrawal', 10: 'Other'
    };

    return {
        success: true,
        transaction: {
            amount: amount,
            type: isDebit ? 'debit' : 'credit',
            description: merchant || `${bank} ${isDebit ? 'Debit' : 'Credit'}`,
            date: transactionDate,
            category_id: categoryId,
            category_name: categoryNames[categoryId],
            bank: bank,
            isExpense: isDebit
        }
    };
}

// GET all published blog posts (public)
app.get('/api/blog', (req, res) => {
    try {
        const posts = queryAll(`
      SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.cover_image, bp.created_at, bp.updated_at,
             u.name as author_name
      FROM blog_posts bp
      LEFT JOIN users u ON bp.author_id = u.id
      WHERE bp.published = 1
      ORDER BY bp.created_at DESC
    `);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single blog post by slug (public)
app.get('/api/blog/:slug', (req, res) => {
    try {
        const post = queryOne(`
      SELECT bp.*, u.name as author_name
      FROM blog_posts bp
      LEFT JOIN users u ON bp.author_id = u.id
      WHERE bp.slug = ? AND bp.published = 1
    `, [req.params.slug]);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE blog post (auth required)
app.post('/api/blog', authMiddleware, (req, res) => {
    try {
        const { title, content, excerpt, cover_image, published } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        // Generate slug from title
        const slug = title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Check if slug exists
        const existing = queryOne('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
        const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

        runQuery(`
      INSERT INTO blog_posts (title, slug, content, excerpt, cover_image, author_id, published)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [title, finalSlug, content, excerpt || '', cover_image || '', req.user.id, published ? 1 : 0]);

        const newPost = queryOne('SELECT * FROM blog_posts WHERE slug = ?', [finalSlug]);
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE blog post (auth required)
app.put('/api/blog/:id', authMiddleware, (req, res) => {
    try {
        const { title, content, excerpt, cover_image, published } = req.body;
        const id = parseInt(req.params.id);

        const existing = queryOne('SELECT * FROM blog_posts WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Post not found' });
        }

        runQuery(`
      UPDATE blog_posts 
      SET title = ?, content = ?, excerpt = ?, cover_image = ?, published = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
            title ?? existing.title,
            content ?? existing.content,
            excerpt ?? existing.excerpt,
            cover_image ?? existing.cover_image,
            published !== undefined ? (published ? 1 : 0) : existing.published,
            id
        ]);

        const updated = queryOne('SELECT * FROM blog_posts WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE blog post (auth required)
app.delete('/api/blog/:id', authMiddleware, (req, res) => {
    try {
        const existing = queryOne('SELECT * FROM blog_posts WHERE id = ?', [parseInt(req.params.id)]);
        if (!existing) {
            return res.status(404).json({ error: 'Post not found' });
        }

        runQuery('DELETE FROM blog_posts WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============== GROUP EXPENSE SPLITTING (SPLITWISE-STYLE) ==============

// Create a new group
app.post('/api/groups', authMiddleware, (req, res) => {
    try {
        const { name, icon, members } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }
        if (!members || members.length < 2) {
            return res.status(400).json({ error: 'At least 2 members are required' });
        }

        runQuery(
            'INSERT INTO expense_groups (name, icon, created_by) VALUES (?, ?, ?)',
            [name, icon || '👥', req.user.id]
        );

        const group = queryOne('SELECT * FROM expense_groups WHERE created_by = ? ORDER BY id DESC LIMIT 1', [req.user.id]);

        // Add members
        for (const member of members) {
            runQuery(
                'INSERT INTO group_members (group_id, name, user_id, upi_id) VALUES (?, ?, ?, ?)',
                [group.id, member.name, member.user_id || null, member.upi_id || null]
            );
        }

        res.status(201).json({ id: group.id, name: group.name, icon: group.icon, members });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List user's groups
app.get('/api/groups', authMiddleware, (req, res) => {
    try {
        const groups = queryAll(
            'SELECT DISTINCT g.* FROM expense_groups g LEFT JOIN group_members gm ON g.id = gm.group_id WHERE g.created_by = ? OR gm.user_id = ? ORDER BY g.created_at DESC',
            [req.user.id, req.user.id]
        );

        const groupsWithDetails = groups.map(g => {
            const members = queryAll('SELECT * FROM group_members WHERE group_id = ?', [g.id]);
            const expenses = queryAll('SELECT * FROM group_expenses WHERE group_id = ?', [g.id]);
            const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
            return {
                ...g,
                members,
                memberCount: members.length,
                totalSpent,
                expenseCount: expenses.length
            };
        });

        res.json(groupsWithDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get group details
app.get('/api/groups/:id', authMiddleware, (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const group = queryOne('SELECT * FROM expense_groups WHERE id = ?', [groupId]);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const members = queryAll('SELECT * FROM group_members WHERE group_id = ?', [groupId]);
        const expenses = queryAll('SELECT ge.*, GROUP_CONCAT(gs.member_name || ":" || gs.amount_owed) as splits FROM group_expenses ge LEFT JOIN group_splits gs ON ge.id = gs.expense_id WHERE ge.group_id = ? GROUP BY ge.id ORDER BY ge.date DESC', [groupId]);
        const settlements = queryAll('SELECT * FROM settlements WHERE group_id = ? ORDER BY date DESC', [groupId]);

        res.json({ ...group, members, expenses, settlements });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add expense to group
app.post('/api/groups/:id/expenses', authMiddleware, (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const { paid_by, amount, description, date, split_type, custom_splits } = req.body;

        if (!paid_by || !amount || !description) {
            return res.status(400).json({ error: 'Paid by, amount, and description are required' });
        }

        const group = queryOne('SELECT * FROM expense_groups WHERE id = ?', [groupId]);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const members = queryAll('SELECT * FROM group_members WHERE group_id = ?', [groupId]);

        runQuery(
            'INSERT INTO group_expenses (group_id, paid_by, amount, description, date, split_type) VALUES (?, ?, ?, ?, ?, ?)',
            [groupId, paid_by, parseFloat(amount), description, date || new Date().toISOString().split('T')[0], split_type || 'equal']
        );

        const expense = queryOne('SELECT * FROM group_expenses WHERE group_id = ? ORDER BY id DESC LIMIT 1', [groupId]);

        // Calculate splits
        if (split_type === 'custom' && custom_splits) {
            for (const split of custom_splits) {
                runQuery(
                    'INSERT INTO group_splits (expense_id, member_name, amount_owed) VALUES (?, ?, ?)',
                    [expense.id, split.name, parseFloat(split.amount)]
                );
            }
        } else {
            // Equal split — use selected_members if provided, else all members
            const { selected_members } = req.body;
            const splitMembers = selected_members && selected_members.length > 0
                ? members.filter(m => selected_members.includes(m.name))
                : members;
            const splitAmount = parseFloat(amount) / splitMembers.length;
            for (const member of splitMembers) {
                runQuery(
                    'INSERT INTO group_splits (expense_id, member_name, amount_owed) VALUES (?, ?, ?)',
                    [expense.id, member.name, Math.round(splitAmount * 100) / 100]
                );
            }
        }

        res.status(201).json({ id: expense.id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get group balances — who owes whom
app.get('/api/groups/:id/balances', authMiddleware, (req, res) => {
    try {
        const groupId = parseInt(req.params.id);

        const members = queryAll('SELECT * FROM group_members WHERE group_id = ?', [groupId]);
        const expenses = queryAll('SELECT * FROM group_expenses WHERE group_id = ?', [groupId]);
        const settlements = queryAll('SELECT * FROM settlements WHERE group_id = ?', [groupId]);

        // Calculate net balances
        const balances = {};
        members.forEach(m => { balances[m.name] = 0; });

        // Process expenses
        for (const expense of expenses) {
            const splits = queryAll('SELECT * FROM group_splits WHERE expense_id = ?', [expense.id]);

            // The person who paid gets credited
            if (balances[expense.paid_by] !== undefined) {
                balances[expense.paid_by] += expense.amount;
            }

            // Each person's share gets debited
            for (const split of splits) {
                if (balances[split.member_name] !== undefined) {
                    balances[split.member_name] -= split.amount_owed;
                }
            }
        }

        // Process settlements
        for (const s of settlements) {
            if (balances[s.from_member] !== undefined) {
                balances[s.from_member] += s.amount;
            }
            if (balances[s.to_member] !== undefined) {
                balances[s.to_member] -= s.amount;
            }
        }

        // Simplify debts — calculate who pays whom
        const debtors = []; // people who owe money (negative balance)
        const creditors = []; // people who are owed money (positive balance)

        for (const [name, balance] of Object.entries(balances)) {
            const rounded = Math.round(balance * 100) / 100;
            if (rounded < -0.01) {
                debtors.push({ name, amount: Math.abs(rounded) });
            } else if (rounded > 0.01) {
                creditors.push({ name, amount: rounded });
            }
        }

        // Sort to optimize settlement
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        const transactions = [];
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const amount = Math.min(debtors[i].amount, creditors[j].amount);
            transactions.push({
                from: debtors[i].name,
                to: creditors[j].name,
                amount: Math.round(amount * 100) / 100
            });
            debtors[i].amount -= amount;
            creditors[j].amount -= amount;
            if (debtors[i].amount < 0.01) i++;
            if (creditors[j].amount < 0.01) j++;
        }

        res.json({
            balances: Object.entries(balances).map(([name, amount]) => ({
                name,
                balance: Math.round(amount * 100) / 100
            })),
            transactions,
            totalSpent: expenses.reduce((sum, e) => sum + e.amount, 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Record a settlement
app.post('/api/groups/:id/settle', authMiddleware, (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const { from_member, to_member, amount } = req.body;

        if (!from_member || !to_member || !amount) {
            return res.status(400).json({ error: 'From, to, and amount are required' });
        }

        runQuery(
            'INSERT INTO settlements (group_id, from_member, to_member, amount) VALUES (?, ?, ?, ?)',
            [groupId, from_member, to_member, parseFloat(amount)]
        );

        res.status(201).json({ message: 'Settlement recorded', from_member, to_member, amount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a group
app.delete('/api/groups/:id', authMiddleware, (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const group = queryOne('SELECT * FROM expense_groups WHERE id = ? AND created_by = ?', [groupId, req.user.id]);
        if (!group) {
            return res.status(404).json({ error: 'Group not found or not authorized' });
        }

        // Delete all related data
        const expenses = queryAll('SELECT id FROM group_expenses WHERE group_id = ?', [groupId]);
        for (const exp of expenses) {
            runQuery('DELETE FROM group_splits WHERE expense_id = ?', [exp.id]);
        }
        runQuery('DELETE FROM group_expenses WHERE group_id = ?', [groupId]);
        runQuery('DELETE FROM settlements WHERE group_id = ?', [groupId]);
        runQuery('DELETE FROM group_members WHERE group_id = ?', [groupId]);
        runQuery('DELETE FROM expense_groups WHERE id = ?', [groupId]);

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update member UPI ID
app.put('/api/groups/:id/members/:memberId/upi', authMiddleware, (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);
        const { upi_id } = req.body;

        const member = queryOne('SELECT * FROM group_members WHERE id = ? AND group_id = ?', [memberId, groupId]);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        runQuery('UPDATE group_members SET upi_id = ? WHERE id = ?', [upi_id || null, memberId]);
        res.json({ message: 'UPI ID updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve static frontend files (production build)
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA fallback — serve index.html for all non-API routes
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(join(distPath, 'index.html'));
        }
    });
}

// Initialize database and start server
initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Expense Tracker running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
