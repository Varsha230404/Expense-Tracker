// =====================================================
// EXPENSE TRACKER - MAIN APPLICATION
// With Authentication and Blog Features
// =====================================================

const API_BASE = window.location.port === '5174' ? 'http://localhost:3001/api' : '/api';

// =====================================================
// STATE MANAGEMENT
// =====================================================
const state = {
  user: null,
  token: null,
  expenses: [],
  categories: [],
  blogPosts: [],
  currentPage: 'login',
  editingExpense: null,
  charts: {}
};

// =====================================================
// AUTH HELPERS
// =====================================================
function loadAuthState() {
  // Check localStorage first (Remember Me), then sessionStorage (session only)
  let token = localStorage.getItem('token') || sessionStorage.getItem('token');
  let user = localStorage.getItem('user') || sessionStorage.getItem('user');

  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    updateAuthUI();
  }
}

function saveAuthState(user, token, rememberMe = true) {
  state.user = user;
  state.token = token;

  if (rememberMe) {
    // Persistent storage - survives browser close
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Clear sessionStorage if it had temporary data
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  } else {
    // Session storage - cleared when browser closes
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    // Clear localStorage for this session
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  updateAuthUI();
}

function clearAuthState() {
  state.user = null;
  state.token = null;
  // Clear both storage types
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  updateAuthUI();
}

function updateAuthUI() {
  const isLoggedIn = !!state.user;

  // Toggle auth-required elements
  document.querySelectorAll('.auth-required').forEach(el => {
    el.style.display = isLoggedIn ? '' : 'none';
  });

  // Toggle guest-only elements
  document.querySelectorAll('.guest-only').forEach(el => {
    el.style.display = isLoggedIn ? 'none' : '';
  });

  // Update nav auth section
  const navAuthSection = document.getElementById('navAuthSection');
  if (navAuthSection) {
    navAuthSection.style.display = isLoggedIn ? '' : 'none';
  }

  // Update user name
  const userName = document.getElementById('userName');
  if (userName && state.user) {
    userName.textContent = state.user.name || 'User';
  }
}

function isAuthenticated() {
  return !!state.token;
}

// =====================================================
// API CLIENT
// =====================================================
const api = {
  async get(endpoint, requireAuth = false) {
    const headers = {};
    if (requireAuth || state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, { headers });

    if (response.status === 401) {
      clearAuthState();
      window.location.hash = '#/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    return response.json();
  },

  async post(endpoint, data, requireAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (requireAuth || state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (response.status === 401) {
      clearAuthState();
      window.location.hash = '#/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    return response.json();
  },

  async put(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    return response.json();
  },

  async delete(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    return response.json();
  }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

// Currency settings (will be updated by geolocation)
let userCurrency = localStorage.getItem('userCurrency') || 'USD';
let userLocale = navigator.language || 'en-US';
let userCountry = localStorage.getItem('userCountry') || '';

// Country to currency mapping
const countryCurrencyMap = {
  'IN': { currency: 'INR', locale: 'en-IN' },
  'US': { currency: 'USD', locale: 'en-US' },
  'GB': { currency: 'GBP', locale: 'en-GB' },
  'AU': { currency: 'AUD', locale: 'en-AU' },
  'CA': { currency: 'CAD', locale: 'en-CA' },
  'DE': { currency: 'EUR', locale: 'de-DE' },
  'FR': { currency: 'EUR', locale: 'fr-FR' },
  'ES': { currency: 'EUR', locale: 'es-ES' },
  'IT': { currency: 'EUR', locale: 'it-IT' },
  'JP': { currency: 'JPY', locale: 'ja-JP' },
  'CN': { currency: 'CNY', locale: 'zh-CN' },
  'KR': { currency: 'KRW', locale: 'ko-KR' },
  'BR': { currency: 'BRL', locale: 'pt-BR' },
  'RU': { currency: 'RUB', locale: 'ru-RU' },
  'SA': { currency: 'SAR', locale: 'ar-SA' },
  'AE': { currency: 'AED', locale: 'ar-AE' },
  'SG': { currency: 'SGD', locale: 'en-SG' },
  'NZ': { currency: 'NZD', locale: 'en-NZ' },
  'ZA': { currency: 'ZAR', locale: 'en-ZA' },
  'MX': { currency: 'MXN', locale: 'es-MX' },
  'PH': { currency: 'PHP', locale: 'en-PH' },
  'ID': { currency: 'IDR', locale: 'id-ID' },
  'MY': { currency: 'MYR', locale: 'ms-MY' },
  'TH': { currency: 'THB', locale: 'th-TH' }
};

// Detect location using IP geolocation API
async function detectLocation() {
  // Skip if already detected
  if (localStorage.getItem('userCountry')) {
    const country = localStorage.getItem('userCountry');
    if (countryCurrencyMap[country]) {
      userCurrency = countryCurrencyMap[country].currency;
      userLocale = countryCurrencyMap[country].locale;
    }
    console.log(`Using cached location: ${country}, Currency: ${userCurrency}`);
    return;
  }

  try {
    // Using free IP geolocation API
    const response = await fetch('https://ipapi.co/json/', { timeout: 5000 });
    if (response.ok) {
      const data = await response.json();
      const country = data.country_code;

      if (country && countryCurrencyMap[country]) {
        userCountry = country;
        userCurrency = countryCurrencyMap[country].currency;
        userLocale = countryCurrencyMap[country].locale;

        // Cache for future visits
        localStorage.setItem('userCountry', country);
        localStorage.setItem('userCurrency', userCurrency);

        console.log(`Detected location: ${data.country_name} (${country}), Currency: ${userCurrency}`);

        // Refresh the current page to show updated currency
        if (state.currentPage) {
          renderPage(state.currentPage);
        }
      }
    }
  } catch (error) {
    console.log('Could not detect location, using default currency:', userCurrency);
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat(userLocale, {
    style: 'currency',
    currency: userCurrency
  }).format(amount);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(userLocale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================
function showToast(type, title, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================================================
// MODAL FUNCTIONS
// =====================================================
function openModal(title, content) {
  const overlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  overlay.classList.add('active');
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('active');
}

// =====================================================
// ROUTER
// =====================================================
function navigate(page) {
  state.currentPage = page;

  // Protected routes - require login
  const protectedRoutes = ['dashboard', 'expenses', 'add', 'analytics'];
  if (protectedRoutes.includes(page) && !isAuthenticated()) {
    window.location.hash = '#/login';
    return;
  }

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Close mobile menu
  document.getElementById('sidebar').classList.remove('open');

  // Render page
  renderPage(page);
}

function initRouter() {
  const defaultPage = isAuthenticated() ? 'dashboard' : 'login';

  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(2) || defaultPage;
    const page = hash.split('/')[0] || defaultPage;
    navigate(page);
  });

  // Initial route
  const hash = window.location.hash.slice(2) || defaultPage;
  const page = hash.split('/')[0] || defaultPage;
  navigate(page);
}

// =====================================================
// PAGE RENDERERS
// =====================================================
async function renderPage(page) {
  const mainContent = document.getElementById('mainContent');

  // Destroy existing charts
  Object.values(state.charts).forEach(chart => chart.destroy());
  state.charts = {};

  switch (page) {
    case 'blog':
      await renderBlogList(mainContent);
      break;
    case 'blog-post':
      const slug = window.location.hash.split('/')[2];
      await renderBlogPost(mainContent, slug);
      break;
    case 'login':
      renderLogin(mainContent);
      break;
    case 'register':
      renderRegister(mainContent);
      break;
    case 'dashboard':
      await renderDashboard(mainContent);
      break;
    case 'expenses':
      await renderExpenses(mainContent);
      break;
    case 'add':
      await renderAddExpense(mainContent);
      break;
    case 'analytics':
      await renderAnalytics(mainContent);
      break;
    case 'groups':
      await renderGroupsPage(mainContent);
      break;
    case 'group-detail':
      const groupId = window.location.hash.split('/')[2];
      await renderGroupDetail(mainContent, groupId);
      break;
    default:
      if (isAuthenticated()) {
        await renderDashboard(mainContent);
      } else {
        renderLogin(mainContent);
      }
  }
}

// =====================================================
// LOGIN PAGE
// =====================================================
function renderLogin(container) {
  // Check for saved email
  const savedEmail = localStorage.getItem('rememberedEmail') || '';
  const isRemembered = !!savedEmail;

  container.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo">💸</span>
          <h1 class="auth-title">Welcome Back</h1>
          <p class="auth-subtitle">Sign in to access your expense tracker</p>
        </div>
        
        <!-- Google Sign-In Button -->
        <div id="googleSignInBtn" style="display: flex; justify-content: center; margin-bottom: 1.5rem;"></div>
        
        <div class="auth-divider">
          <span>or sign in with email</span>
        </div>
        
        <form id="loginForm">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input 
              type="email" 
              class="form-input" 
              id="loginEmail" 
              placeholder="Enter your email"
              value="${savedEmail}"
              required
            >
          </div>
          
          <div class="form-group">
            <label class="form-label">Password</label>
            <input 
              type="password" 
              class="form-input" 
              id="loginPassword" 
              placeholder="Enter your password"
              required
            >
          </div>
          
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input 
                type="checkbox" 
                id="rememberMe" 
                ${isRemembered ? 'checked' : ''}
                style="width: 18px; height: 18px; accent-color: var(--accent-primary);"
              >
              <span style="color: var(--text-secondary); font-size: 0.9rem;">Remember me</span>
            </label>
          </div>
          
          <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">
            Sign In
          </button>
        </form>
        
        <div class="auth-footer">
          <p>Don't have an account? <a href="#/register">Create one</a></p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Initialize Google Sign-In
  initGoogleSignIn();
}

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('rememberMe').checked;

  try {
    const { user, token } = await api.post('/auth/login', { email, password, rememberMe });

    // Save or clear remembered email based on checkbox
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }

    saveAuthState(user, token, rememberMe);
    showToast('success', 'Welcome back!', `Signed in as ${user.name}`);
    window.location.hash = '#/dashboard';
  } catch (error) {
    showToast('error', 'Login Failed', error.message);
  }
}

// Google Sign-In Configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // Replace with your Client ID

function initGoogleSignIn() {
  const googleBtnContainer = document.getElementById('googleSignInBtn');
  if (!googleBtnContainer) return;

  // Check if Google library is loaded
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    google.accounts.id.renderButton(googleBtnContainer, {
      theme: 'filled_black',
      size: 'large',
      width: 300,
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left'
    });
  } else {
    // Fallback button if Google library not loaded
    googleBtnContainer.innerHTML = `
      <button class="google-signin-btn" onclick="showToast('error', 'Google Sign-In', 'Please configure your Google Client ID')">
        <svg viewBox="0 0 24 24" width="20" height="20" style="margin-right: 10px;">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    `;
  }
}

async function handleGoogleSignIn(response) {
  try {
    // Send the Google credential to our backend
    const { user, token } = await api.post('/auth/google', {
      credential: response.credential
    });

    saveAuthState(user, token, true);
    showToast('success', 'Welcome!', `Signed in as ${user.name}`);
    window.location.hash = '#/dashboard';
  } catch (error) {
    showToast('error', 'Google Sign-In Failed', error.message);
  }
}

// =====================================================
// REGISTER PAGE
// =====================================================
function renderRegister(container) {
  container.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo">💸</span>
          <h1 class="auth-title">Create Account</h1>
          <p class="auth-subtitle">Start tracking your expenses today</p>
        </div>
        
        <form id="registerForm">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input 
              type="text" 
              class="form-input" 
              id="registerName" 
              placeholder="Enter your name"
              required
            >
          </div>
          
          <div class="form-group">
            <label class="form-label">Email</label>
            <input 
              type="email" 
              class="form-input" 
              id="registerEmail" 
              placeholder="Enter your email"
              required
            >
          </div>
          
          <div class="form-group">
            <label class="form-label">Password</label>
            <input 
              type="password" 
              class="form-input" 
              id="registerPassword" 
              placeholder="Min 8 chars, uppercase, lowercase, number, special"
              minlength="8"
              required
            >
            <small style="color: var(--text-muted); font-size: 11px; margin-top: 4px; display: block;">
              Must include: 8+ characters, uppercase, lowercase, number, special character (!@#$%^&*)
            </small>
          </div>
          
          <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">
            Create Account
          </button>
        </form>
        
        <div class="auth-footer">
          <p>Already have an account? <a href="#/login">Sign in</a></p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('registerForm').addEventListener('submit', handleRegister);
}

async function handleRegister(e) {
  e.preventDefault();

  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;

  // Client-side validation
  const errors = [];

  // Name validation
  if (name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  // Email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
  }

  // Password strength validation
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain a special character');

  if (errors.length > 0) {
    showToast('error', 'Validation Error', errors[0]);
    return;
  }

  try {
    const { user, token } = await api.post('/auth/register', { name, email, password });
    saveAuthState(user, token);
    showToast('success', 'Account Created!', `Welcome, ${user.name}!`);
    window.location.hash = '#/dashboard';
  } catch (error) {
    // Check for detailed errors from server
    if (error.details && Array.isArray(error.details)) {
      showToast('error', 'Registration Failed', error.details[0]);
    } else {
      showToast('error', 'Registration Failed', error.message);
    }
  }
}

// =====================================================
// BLOG LIST PAGE
// =====================================================
async function renderBlogList(container) {
  container.innerHTML = `
    <div class="blog-hero">
      <h1 class="blog-hero-title">📚 Financial Tips & Insights</h1>
      <p class="blog-hero-subtitle">Learn how to manage your money smarter</p>
    </div>
    
    <div class="blog-grid" id="blogGrid">
      <div class="blog-card skeleton" style="height: 350px;"></div>
      <div class="blog-card skeleton" style="height: 350px;"></div>
      <div class="blog-card skeleton" style="height: 350px;"></div>
    </div>
  `;

  try {
    const posts = await api.get('/blog');
    state.blogPosts = posts;

    const blogGrid = document.getElementById('blogGrid');

    if (posts.length === 0) {
      blogGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📝</div>
          <h3 class="empty-title">No blog posts yet</h3>
          <p class="empty-description">Check back later for financial tips and insights.</p>
        </div>
      `;
      return;
    }

    blogGrid.innerHTML = posts.map(post => `
      <article class="blog-card">
        <div class="blog-card-image">📄</div>
        <div class="blog-card-content">
          <h2 class="blog-card-title">
            <a href="#/blog-post/${post.slug}">${post.title}</a>
          </h2>
          <p class="blog-card-excerpt">${post.excerpt || ''}</p>
          <div class="blog-card-meta">
            <div class="blog-card-author">
              <span class="blog-card-author-avatar">👤</span>
              <span>${post.author_name || 'Admin'}</span>
            </div>
            <span>${formatDate(post.created_at)}</span>
          </div>
        </div>
      </article>
    `).join('');

  } catch (error) {
    showToast('error', 'Error', 'Failed to load blog posts');
    console.error(error);
  }
}

// =====================================================
// SINGLE BLOG POST PAGE
// =====================================================
async function renderBlogPost(container, slug) {
  container.innerHTML = `
    <div class="blog-post">
      <div class="skeleton" style="height: 60px; margin-bottom: 20px;"></div>
      <div class="skeleton" style="height: 200px;"></div>
    </div>
  `;

  try {
    const post = await api.get(`/blog/${slug}`);

    container.innerHTML = `
      <article class="blog-post">
        <header class="blog-post-header">
          <a href="#/blog" class="btn btn-secondary mb-lg">← Back to Blog</a>
          <h1 class="blog-post-title">${post.title}</h1>
          <div class="blog-post-meta">
            <span>👤 ${post.author_name || 'Admin'}</span>
            <span>📅 ${formatDate(post.created_at)}</span>
          </div>
        </header>
        
        <div class="blog-post-content">
          ${post.content}
        </div>
      </article>
    `;

  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😕</div>
        <h3 class="empty-title">Post not found</h3>
        <p class="empty-description">The blog post you're looking for doesn't exist.</p>
        <a href="#/blog" class="btn btn-primary">Back to Blog</a>
      </div>
    `;
  }
}

// =====================================================
// DASHBOARD PAGE
// =====================================================
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Welcome back, ${state.user?.name || 'User'}! Here's your spending overview.</p>
    </div>
    
    <!-- Financial Health Score & Streaks Row -->
    <div class="grid-2 mb-lg">
      <div class="card health-score-card" id="healthScoreCard">
        <div class="skeleton" style="height: 150px;"></div>
      </div>
      <div class="card achievements-card" id="achievementsCard">
        <div class="skeleton" style="height: 150px;"></div>
      </div>
    </div>
    
    <!-- AI Insights -->
    <div class="card mb-lg" id="insightsCard">
      <div class="card-header">
        <h3 class="card-title">🤖 AI Insights</h3>
      </div>
      <div class="insights-container" id="insightsContainer">
        <div class="skeleton" style="height: 80px;"></div>
      </div>
    </div>
    
    <!-- Smart Alerts -->
    <div class="card mb-lg" id="alertsCard" style="display: none;">
      <div class="card-header">
        <h3 class="card-title">🔔 Smart Alerts</h3>
      </div>
      <div class="alerts-container" id="alertsContainer"></div>
    </div>
    
    <div class="stats-grid" id="statsGrid">
      <div class="card stat-card skeleton" style="height: 140px;"></div>
      <div class="card stat-card skeleton" style="height: 140px;"></div>
      <div class="card stat-card skeleton" style="height: 140px;"></div>
      <div class="card stat-card skeleton" style="height: 140px;"></div>
    </div>
    
    <!-- Savings Goals -->
    <div class="card mt-lg mb-lg" id="goalsCard">
      <div class="card-header">
        <h3 class="card-title">🎯 Savings Goals</h3>
        <button class="btn btn-secondary btn-sm" onclick="openAddGoalModal()">+ Add Goal</button>
      </div>
      <div class="goals-container" id="goalsContainer">
        <div class="skeleton" style="height: 100px;"></div>
      </div>
    </div>
    
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Spending Trend</h3>
        </div>
        <div class="chart-container">
          <canvas id="trendChart"></canvas>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">By Category</h3>
        </div>
        <div class="chart-container">
          <canvas id="categoryChart"></canvas>
        </div>
      </div>
    </div>
    
    <div class="card mt-xl">
      <div class="card-header">
        <h3 class="card-title">Recent Transactions</h3>
        <a href="#/expenses" class="btn btn-secondary">View All</a>
      </div>
      <div class="expense-list" id="recentExpenses">
        <div class="skeleton" style="height: 72px;"></div>
        <div class="skeleton" style="height: 72px;"></div>
        <div class="skeleton" style="height: 72px;"></div>
      </div>
    </div>
  `;

  try {
    const [summary, byCategory, daily, expenses, insights, healthScore, alerts, achievements, goals] = await Promise.all([
      api.get('/analytics/summary', true),
      api.get('/analytics/by-category', true),
      api.get('/analytics/daily', true),
      api.get('/expenses?limit=5', true),
      api.get('/insights', true).catch(() => []),
      api.get('/health-score', true).catch(() => ({ score: 50, grade: 'C', factors: [] })),
      api.get('/alerts', true).catch(() => []),
      api.get('/achievements', true).catch(() => ({ achievements: [], stats: {} })),
      api.get('/goals', true).catch(() => [])
    ]);

    renderStats(summary);
    renderTrendChart(daily);
    renderCategoryChart(byCategory);
    renderExpenseList(document.getElementById('recentExpenses'), expenses);
    renderInsights(insights);
    renderHealthScore(healthScore);
    renderAlerts(alerts);
    renderAchievements(achievements);
    renderGoals(goals);

    // Add footer to dashboard
    container.insertAdjacentHTML('beforeend', `
      <footer class="app-footer">
        <div class="footer-links">
          <a href="#/dashboard" class="footer-link">Dashboard</a>
          <span class="footer-divider">|</span>
          <a href="#/groups" class="footer-link">Groups</a>
          <span class="footer-divider">|</span>
          <a href="#/analytics" class="footer-link">Analytics</a>
          <span class="footer-divider">|</span>
          <a href="#/expenses" class="footer-link">Expenses</a>
          <span class="footer-divider">|</span>
          <a href="#/add" class="footer-link">Add Expense</a>
        </div>
        <div class="footer-links">
          <a href="#" class="footer-link">SMS Parser</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">Receipt Scanner</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">CSV Import</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">Savings Goals</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">Achievements</a>
        </div>
        <div class="footer-links">
          <a href="#" class="footer-link">Budget Planner</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">Split Expenses</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">Financial Health</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">Smart Alerts</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">FAQs</a>
          <span class="footer-divider">|</span>
          <a href="#" class="footer-link">Terms & Privacy</a>
        </div>
        <div class="footer-contact">
          📧 support@expenseflow.app &nbsp;&nbsp; | &nbsp;&nbsp; 📞 +91-1234-567890
        </div>
        <div class="footer-copyright">
          © 2026 ExpenseFlow. All Rights Reserved. Built for smart personal finance management.
        </div>
      </footer>
    `);

  } catch (error) {
    showToast('error', 'Error', 'Failed to load dashboard data');
    console.error(error);
  }
}

// Render AI Insights
function renderInsights(insights) {
  const container = document.getElementById('insightsContainer');
  if (!container) return;

  if (!insights || insights.length === 0) {
    container.innerHTML = '<p class="text-muted">No insights available yet. Add more expenses to get personalized recommendations.</p>';
    return;
  }

  container.innerHTML = insights.map(insight => `
    <div class="insight-item insight-${insight.type}">
      <span class="insight-icon">${insight.icon}</span>
      <div class="insight-content">
        <strong>${insight.title}</strong>
        <p>${insight.message}</p>
      </div>
    </div>
  `).join('');
}

// Render Financial Health Score
function renderHealthScore(data) {
  const container = document.getElementById('healthScoreCard');
  if (!container) return;

  const scoreColor = data.score >= 80 ? '#10b981' : data.score >= 60 ? '#6366f1' : data.score >= 40 ? '#f59e0b' : '#ef4444';

  container.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">💪 Financial Health</h3>
      <span class="health-grade" style="background: ${scoreColor};">${data.grade}</span>
    </div>
    <div class="health-score-display">
      <div class="score-circle" style="--score: ${data.score}; --color: ${scoreColor};">
        <span class="score-value">${data.score}</span>
        <span class="score-label">/ 100</span>
      </div>
      <div class="score-factors">
        ${data.factors.slice(0, 3).map(f => `
          <div class="factor-row">
            <span class="factor-name">${f.name}</span>
            <div class="factor-bar">
              <div class="factor-fill" style="width: ${(f.score / f.maxScore) * 100}%; background: ${f.status === 'excellent' ? '#10b981' : f.status === 'good' ? '#6366f1' : '#ef4444'};"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Render Smart Alerts
function renderAlerts(alerts) {
  const container = document.getElementById('alertsContainer');
  const card = document.getElementById('alertsCard');
  if (!container || !card) return;

  if (!alerts || alerts.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  container.innerHTML = alerts.map(alert => `
    <div class="alert-item alert-${alert.type}">
      <span class="alert-icon">${alert.icon}</span>
      <div class="alert-content">
        <strong>${alert.title}</strong>
        <p>${alert.message}</p>
      </div>
    </div>
  `).join('');
}

// Render Achievements & Streaks
function renderAchievements(data) {
  const container = document.getElementById('achievementsCard');
  if (!container) return;

  const { achievements = [], stats = {} } = data;
  const unlockedAchievements = achievements.filter(a => a.unlocked).slice(0, 4);

  container.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">🏆 Achievements</h3>
      <div class="streak-badge">
        <span class="streak-fire">🔥</span>
        <span class="streak-count">${stats.currentStreak || 0}</span>
        <span class="streak-label">day streak</span>
      </div>
    </div>
    <div class="achievements-grid">
      ${unlockedAchievements.length > 0 ? unlockedAchievements.map(a => `
        <div class="achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}" title="${a.description}">
          <span class="badge-icon">${a.icon}</span>
          <span class="badge-name">${a.name}</span>
        </div>
      `).join('') : '<p class="text-muted">Start tracking to earn achievements!</p>'}
    </div>
    <div class="achievement-stats">
      <span>📝 ${stats.totalExpenses || 0} expenses tracked</span>
      <span>💰 ${formatCurrency(stats.totalTracked || 0)} total</span>
    </div>
  `;
}

// Render Savings Goals
function renderGoals(goals) {
  const container = document.getElementById('goalsContainer');
  if (!container) return;

  if (!goals || goals.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">No savings goals yet. Create one to start tracking!</p>';
    return;
  }

  container.innerHTML = `
    <div class="goals-grid">
      ${goals.map(goal => `
        <div class="goal-card" style="--goal-color: ${goal.color};">
          <div class="goal-header">
            <span class="goal-icon">${goal.icon}</span>
            <span class="goal-name">${goal.name}</span>
          </div>
          <div class="goal-progress-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="progress-bg"/>
              <circle cx="50" cy="50" r="45" class="progress-fill" 
                style="stroke-dasharray: ${goal.progress * 2.83} 283; stroke: ${goal.color};"/>
            </svg>
            <span class="goal-percent">${goal.progress}%</span>
          </div>
          <div class="goal-details">
            <span>${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)}</span>
            <span class="goal-days">${goal.daysLeft > 0 ? `${goal.daysLeft} days left` : 'Overdue'}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Add Goal Modal
function openAddGoalModal() {
  openModal('Create Savings Goal', `
    <form id="addGoalForm">
      <div class="form-group">
        <label class="form-label">Goal Name</label>
        <input type="text" class="form-input" id="goalName" placeholder="e.g., New iPhone" required>
      </div>
      <div class="form-group">
        <label class="form-label">Target Amount</label>
        <input type="number" class="form-input" id="goalAmount" placeholder="50000" required>
      </div>
      <div class="form-group">
        <label class="form-label">Target Date</label>
        <input type="date" class="form-input" id="goalDeadline">
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div class="icon-picker">
          ${['🎯', '💰', '🏠', '🚗', '✈️', '💻', '📱', '🎮', '👗', '🎓'].map(icon =>
    `<button type="button" class="icon-option" data-icon="${icon}">${icon}</button>`
  ).join('')}
        </div>
        <input type="hidden" id="goalIcon" value="🎯">
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%;">Create Goal</button>
    </form>
  `);

  // Icon picker logic
  document.querySelectorAll('.icon-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('goalIcon').value = btn.dataset.icon;
    });
  });

  document.getElementById('addGoalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.post('/goals', {
        name: document.getElementById('goalName').value,
        targetAmount: parseFloat(document.getElementById('goalAmount').value),
        deadline: document.getElementById('goalDeadline').value,
        icon: document.getElementById('goalIcon').value
      }, true);
      closeModal();
      showToast('success', 'Goal Created', 'Your savings goal has been created!');
      navigate('dashboard');
    } catch (error) {
      showToast('error', 'Error', error.message);
    }
  });
}

function renderStats(summary) {
  const percentChange = summary.previous_period_spent > 0
    ? ((summary.total_spent - summary.previous_period_spent) / summary.previous_period_spent * 100).toFixed(1)
    : 0;

  const isIncrease = percentChange > 0;

  document.getElementById('statsGrid').innerHTML = `
    <div class="card stat-card">
      <div class="stat-value">${formatCurrency(summary.total_spent)}</div>
      <div class="stat-label">Total Spent This Month</div>
      <div class="stat-change ${isIncrease ? 'negative' : 'positive'}">
        ${isIncrease ? '↑' : '↓'} ${Math.abs(percentChange)}% vs last period
      </div>
    </div>
    
    <div class="card stat-card">
      <div class="stat-value">${summary.total_transactions}</div>
      <div class="stat-label">Total Transactions</div>
    </div>
    
    <div class="card stat-card">
      <div class="stat-value">${formatCurrency(summary.average_expense)}</div>
      <div class="stat-label">Average Expense</div>
    </div>
    
    <div class="card stat-card">
      <div class="stat-value">${formatCurrency(summary.highest_expense)}</div>
      <div class="stat-label">Highest Expense</div>
    </div>
  `;
}

function renderTrendChart(daily) {
  const ctx = document.getElementById('trendChart').getContext('2d');

  const startDate = new Date(getMonthStart());
  const endDate = new Date();
  const dateMap = new Map(daily.map(d => [d.date, d.total_amount]));

  const labels = [];
  const data = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    labels.push(new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    data.push(dateMap.get(dateStr) || 0);
  }

  state.charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Spending',
        data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#64748b',
            callback: value => '$' + value
          }
        }
      }
    }
  });
}

function renderCategoryChart(byCategory) {
  const ctx = document.getElementById('categoryChart').getContext('2d');

  const filteredCategories = byCategory.filter(c => c.total_amount > 0);

  if (filteredCategories.length === 0) {
    ctx.canvas.parentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p class="text-muted">No expenses yet this month</p>
      </div>
    `;
    return;
  }

  state.charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: filteredCategories.map(c => `${c.icon} ${c.name}`),
      datasets: [{
        data: filteredCategories.map(c => c.total_amount),
        backgroundColor: filteredCategories.map(c => c.color),
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        }
      }
    }
  });
}

// =====================================================
// EXPENSES PAGE
// =====================================================
async function renderExpenses(container) {
  container.innerHTML = `
    <div class="page-header flex justify-between items-center">
      <div>
        <h1 class="page-title">Expenses</h1>
        <p class="page-subtitle">Manage all your transactions</p>
      </div>
      <a href="#/add" class="btn btn-primary btn-lg">
        <span>➕</span> Add Expense
      </a>
    </div>
    
    <div class="card mb-xl">
      <div class="flex gap-md" style="flex-wrap: wrap;">
        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 200px;">
          <label class="form-label">Start Date</label>
          <input type="date" class="form-input" id="filterStartDate" value="${getMonthStart()}">
        </div>
        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 200px;">
          <label class="form-label">End Date</label>
          <input type="date" class="form-input" id="filterEndDate" value="${getToday()}">
        </div>
        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 200px;">
          <label class="form-label">Category</label>
          <select class="form-select" id="filterCategory">
            <option value="">All Categories</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0; display: flex; align-items: flex-end;">
          <button class="btn btn-secondary" id="applyFilters">Apply Filters</button>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="expense-list" id="expensesList">
        <div class="skeleton" style="height: 72px;"></div>
        <div class="skeleton" style="height: 72px;"></div>
        <div class="skeleton" style="height: 72px;"></div>
      </div>
    </div>
  `;

  try {
    if (state.categories.length === 0) {
      state.categories = await api.get('/categories');
    }

    const filterCategory = document.getElementById('filterCategory');
    state.categories.forEach(cat => {
      filterCategory.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });

    await loadExpenses();
    document.getElementById('applyFilters').addEventListener('click', loadExpenses);

  } catch (error) {
    showToast('error', 'Error', 'Failed to load expenses');
    console.error(error);
  }
}

async function loadExpenses() {
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;
  const category = document.getElementById('filterCategory').value;

  let url = `/expenses?startDate=${startDate}&endDate=${endDate}`;
  if (category) url += `&category_id=${category}`;

  try {
    const expenses = await api.get(url, true);
    state.expenses = expenses;
    renderExpenseList(document.getElementById('expensesList'), expenses);
  } catch (error) {
    showToast('error', 'Error', 'Failed to load expenses');
  }
}

function renderExpenseList(container, expenses) {
  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💳</div>
        <h3 class="empty-title">No expenses found</h3>
        <p class="empty-description">Start tracking your spending by adding your first expense.</p>
        <a href="#/add" class="btn btn-primary">Add Expense</a>
      </div>
    `;
    return;
  }

  container.innerHTML = expenses.map(expense => `
    <div class="expense-item" data-id="${expense.id}">
      <div class="expense-icon" style="background: ${expense.category_color}20;">
        ${expense.category_icon || '📦'}
      </div>
      <div class="expense-details">
        <div class="expense-description">${expense.description || expense.category_name || 'Expense'}</div>
        <div class="expense-meta">
          <span class="badge badge-category">
            ${expense.category_icon || '📦'} ${expense.category_name || 'Other'}
          </span>
          <span>📅 ${formatDate(expense.date)}</span>
        </div>
      </div>
      <div class="expense-amount">-${formatCurrency(expense.amount)}</div>
      <div class="expense-actions">
        <button class="btn btn-icon btn-secondary" onclick="editExpense(${expense.id})" title="Edit">✏️</button>
        <button class="btn btn-icon btn-danger" onclick="deleteExpense(${expense.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

// =====================================================
// ADD/EDIT EXPENSE PAGE
// =====================================================
async function renderAddExpense(container, expenseToEdit = null) {
  if (state.categories.length === 0) {
    try {
      state.categories = await api.get('/categories');
    } catch (error) {
      showToast('error', 'Error', 'Failed to load categories');
      return;
    }
  }

  const isEdit = expenseToEdit !== null;
  const title = isEdit ? 'Edit Expense' : 'Add New Expense';
  const submitText = isEdit ? 'Update Expense' : 'Add Expense';

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">${title}</h1>
      <p class="page-subtitle">${isEdit ? 'Update your expense details' : 'Track a new expense'}</p>
    </div>
    
    <div class="card" style="max-width: 800px;">
      <form id="expenseForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Amount *</label>
            <input 
              type="number" 
              class="form-input" 
              id="expenseAmount" 
              placeholder="0.00" 
              step="0.01" 
              min="0.01"
              value="${expenseToEdit?.amount || ''}"
              required
            >
          </div>
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input 
              type="date" 
              class="form-input" 
              id="expenseDate" 
              value="${expenseToEdit?.date || getToday()}"
              required
            >
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Description</label>
          <input 
            type="text" 
            class="form-input" 
            id="expenseDescription" 
            placeholder="e.g., Lunch at restaurant"
            value="${expenseToEdit?.description || ''}"
          >
        </div>
        
        <div class="form-group">
          <label class="form-label">Category</label>
          <div class="category-grid" id="categoryGrid">
            ${state.categories.map(cat => `
              <div 
                class="category-item ${expenseToEdit?.category_id === cat.id ? 'selected' : ''}" 
                data-id="${cat.id}"
              >
                <div class="category-icon-wrapper" style="background: ${cat.color}20;">
                  ${cat.icon}
                </div>
                <span class="category-name">${cat.name}</span>
              </div>
            `).join('')}
          </div>
          <input type="hidden" id="expenseCategory" value="${expenseToEdit?.category_id || ''}">
        </div>
        
        <div class="flex gap-md mt-xl">
          <button type="submit" class="btn btn-primary btn-lg">
            ${submitText}
          </button>
          <a href="#/expenses" class="btn btn-secondary btn-lg">Cancel</a>
        </div>
        
        ${isEdit ? `<input type="hidden" id="expenseId" value="${expenseToEdit.id}">` : ''}
      </form>
    </div>
  `;

  document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      document.getElementById('expenseCategory').value = item.dataset.id;
    });
  });

  document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
}

async function handleExpenseSubmit(e) {
  e.preventDefault();

  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const date = document.getElementById('expenseDate').value;
  const description = document.getElementById('expenseDescription').value;
  const category_id = document.getElementById('expenseCategory').value || null;
  const expenseId = document.getElementById('expenseId')?.value;

  if (!amount || amount <= 0) {
    showToast('error', 'Validation Error', 'Please enter a valid amount');
    return;
  }

  if (!date) {
    showToast('error', 'Validation Error', 'Please select a date');
    return;
  }

  const data = { amount, date, description, category_id: category_id ? parseInt(category_id) : null };

  try {
    if (expenseId) {
      await api.put(`/expenses/${expenseId}`, data);
      showToast('success', 'Success', 'Expense updated successfully');
    } else {
      await api.post('/expenses', data, true);
      showToast('success', 'Success', 'Expense added successfully');
    }

    window.location.hash = '#/expenses';
  } catch (error) {
    showToast('error', 'Error', 'Failed to save expense');
    console.error(error);
  }
}

// =====================================================
// ANALYTICS PAGE
// =====================================================
async function renderAnalytics(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Analytics</h1>
      <p class="page-subtitle">Dive deep into your spending patterns</p>
    </div>
    
    <div class="card mb-xl">
      <div class="flex gap-md" style="flex-wrap: wrap;">
        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 200px;">
          <label class="form-label">Start Date</label>
          <input type="date" class="form-input" id="analyticsStartDate" value="${getMonthStart()}">
        </div>
        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 200px;">
          <label class="form-label">End Date</label>
          <input type="date" class="form-input" id="analyticsEndDate" value="${getToday()}">
        </div>
        <div class="form-group" style="margin-bottom: 0; display: flex; align-items: flex-end;">
          <button class="btn btn-primary" id="updateAnalytics">Update</button>
        </div>
      </div>
    </div>
    
    <div class="stats-grid" id="analyticsStats">
      <div class="card stat-card skeleton" style="height: 140px;"></div>
      <div class="card stat-card skeleton" style="height: 140px;"></div>
      <div class="card stat-card skeleton" style="height: 140px;"></div>
    </div>
    
    <div class="grid-2 mb-xl">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Spending by Category</h3>
        </div>
        <div class="chart-container" style="height: 350px;">
          <canvas id="analyticsCategoryChart"></canvas>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Daily Spending</h3>
        </div>
        <div class="chart-container" style="height: 350px;">
          <canvas id="analyticsDailyChart"></canvas>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Category Breakdown</h3>
      </div>
      <div class="table-container">
        <table class="table" id="categoryTable">
          <thead>
            <tr>
              <th>Category</th>
              <th>Transactions</th>
              <th>Total Amount</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody id="categoryTableBody">
            <tr><td colspan="4"><div class="skeleton" style="height: 40px;"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('updateAnalytics').addEventListener('click', loadAnalytics);
  await loadAnalytics();
}

async function loadAnalytics() {
  const startDateEl = document.getElementById('analyticsStartDate');
  const endDateEl = document.getElementById('analyticsEndDate');

  if (!startDateEl || !endDateEl) {
    console.error('Date elements not found');
    return;
  }

  const startDate = startDateEl.value;
  const endDate = endDateEl.value;

  try {
    const [summary, byCategory, daily] = await Promise.all([
      api.get(`/analytics/summary?startDate=${startDate}&endDate=${endDate}`, true),
      api.get(`/analytics/by-category?startDate=${startDate}&endDate=${endDate}`, true),
      api.get(`/analytics/daily?startDate=${startDate}&endDate=${endDate}`, true)
    ]);

    const statsEl = document.getElementById('analyticsStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="card stat-card">
          <div class="stat-value">${formatCurrency(summary.total_spent)}</div>
          <div class="stat-label">Total Spent</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">${summary.total_transactions}</div>
          <div class="stat-label">Transactions</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">${formatCurrency(summary.average_expense)}</div>
          <div class="stat-label">Average per Transaction</div>
        </div>
      `;
    }

    // Destroy existing charts
    if (state.charts.analyticsCategory) {
      state.charts.analyticsCategory.destroy();
      state.charts.analyticsCategory = null;
    }
    if (state.charts.analyticsDaily) {
      state.charts.analyticsDaily.destroy();
      state.charts.analyticsDaily = null;
    }

    // Category chart
    const filteredCategories = byCategory.filter(c => c.total_amount > 0);
    const categoryCanvas = document.getElementById('analyticsCategoryChart');
    if (filteredCategories.length > 0 && categoryCanvas) {
      const ctx = categoryCanvas.getContext('2d');
      state.charts.analyticsCategory = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: filteredCategories.map(c => c.name),
          datasets: [{
            label: 'Amount',
            data: filteredCategories.map(c => c.total_amount),
            backgroundColor: filteredCategories.map(c => c.color),
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: {
                color: '#64748b',
                callback: value => formatCurrency(value)
              }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    }

    // Daily chart
    const dailyCanvas = document.getElementById('analyticsDailyChart');
    if (daily.length > 0 && dailyCanvas) {
      const ctx = dailyCanvas.getContext('2d');
      state.charts.analyticsDaily = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: daily.map(d => formatDate(d.date)),
          datasets: [{
            label: 'Daily Spending',
            data: daily.map(d => d.total_amount),
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#64748b', maxRotation: 45 }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: {
                color: '#64748b',
                callback: value => formatCurrency(value)
              }
            }
          }
        }
      });
    }

    const total = byCategory.reduce((sum, c) => sum + c.total_amount, 0);
    document.getElementById('categoryTableBody').innerHTML = byCategory.map(cat => `
      <tr>
        <td>
          <div class="flex items-center gap-md">
            <span style="font-size: 1.25rem;">${cat.icon}</span>
            <span>${cat.name}</span>
          </div>
        </td>
        <td>${cat.transaction_count}</td>
        <td>${formatCurrency(cat.total_amount)}</td>
        <td>
          <div class="flex items-center gap-sm">
            <div style="width: 100px; height: 8px; background: var(--bg-glass); border-radius: 4px; overflow: hidden;">
              <div style="width: ${total > 0 ? (cat.total_amount / total * 100) : 0}%; height: 100%; background: ${cat.color};"></div>
            </div>
            <span>${total > 0 ? (cat.total_amount / total * 100).toFixed(1) : 0}%</span>
          </div>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    showToast('error', 'Error', 'Failed to load analytics');
    console.error(error);
  }
}

// =====================================================
// EXPENSE ACTIONS (Global)
// =====================================================
window.editExpense = async function (id) {
  try {
    const expense = await api.get(`/expenses/${id}`, true);
    state.editingExpense = expense;
    window.location.hash = '#/add';

    setTimeout(() => {
      renderAddExpense(document.getElementById('mainContent'), expense);
    }, 50);
  } catch (error) {
    showToast('error', 'Error', 'Failed to load expense');
  }
};

window.deleteExpense = async function (id) {
  openModal('Delete Expense', `
    <p style="margin-bottom: var(--spacing-xl);">Are you sure you want to delete this expense? This action cannot be undone.</p>
    <div class="flex gap-md justify-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmDelete(${id})">Delete</button>
    </div>
  `);
};

window.confirmDelete = async function (id) {
  try {
    await api.delete(`/expenses/${id}`);
    closeModal();
    showToast('success', 'Deleted', 'Expense deleted successfully');
    renderPage(state.currentPage);
  } catch (error) {
    showToast('error', 'Error', 'Failed to delete expense');
  }
};

// =====================================================
// FLOATING ACTION BUTTON & QUICK ADD FEATURES
// =====================================================

// Toggle FAB menu
function toggleFabMenu() {
  const fabMain = document.getElementById('fabMain');
  const fabMenu = document.getElementById('fabMenu');
  fabMain.classList.toggle('active');
  fabMenu.classList.toggle('active');
}

// Close FAB menu
function closeFabMenu() {
  const fabMain = document.getElementById('fabMain');
  const fabMenu = document.getElementById('fabMenu');
  fabMain?.classList.remove('active');
  fabMenu?.classList.remove('active');
}

// Handle FAB action clicks
function handleFabAction(action) {
  closeFabMenu();

  switch (action) {
    case 'quick-add':
      openQuickAddModal();
      break;
    case 'import-csv':
      openImportModal();
      break;
    case 'scan-receipt':
      openReceiptScanner();
      break;
    case 'parse-text':
      openTextParser();
      break;
  }
}

// =====================================================
// QUICK ADD MODAL
// =====================================================
async function openQuickAddModal() {
  // Ensure categories are loaded
  if (state.categories.length === 0) {
    try {
      state.categories = await api.get('/categories');
    } catch (error) {
      showToast('error', 'Error', 'Failed to load categories');
      return;
    }
  }

  const content = `
    <form class="quick-add-form" id="quickAddForm">
      <div class="form-group">
        <label class="form-label">Amount</label>
        <input type="number" step="0.01" class="form-input quick-add-amount" 
               id="quickAmount" placeholder="0.00" required autofocus>
      </div>
      
      <div class="form-group">
        <label class="form-label">Category</label>
        <div class="quick-categories" id="quickCategories">
          ${state.categories.map(cat => `
            <button type="button" class="quick-category" data-id="${cat.id}">
              <span class="quick-category-icon">${cat.icon}</span>
              <span class="quick-category-name">${cat.name}</span>
            </button>
          `).join('')}
        </div>
        <input type="hidden" id="quickCategoryId" required>
      </div>
      
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <input type="text" class="form-input" id="quickDescription" placeholder="What was this for?">
      </div>
      
      <button type="submit" class="btn btn-primary btn-block">
        ⚡ Add Expense
      </button>
    </form>
  `;

  openModal('⚡ Quick Add Expense', content);

  // Category selection
  document.querySelectorAll('.quick-category').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quick-category').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('quickCategoryId').value = btn.dataset.id;
    });
  });

  // Form submission
  document.getElementById('quickAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('quickAmount').value);
    const categoryId = document.getElementById('quickCategoryId').value;
    const description = document.getElementById('quickDescription').value;

    if (!categoryId) {
      showToast('warning', 'Select Category', 'Please select a category');
      return;
    }

    try {
      await api.post('/expenses', {
        amount,
        category_id: parseInt(categoryId),
        description,
        date: getToday()
      }, true);

      closeModal();
      showToast('success', 'Added!', `${formatCurrency(amount)} expense added`);

      // Refresh if on expenses or dashboard
      if (['expenses', 'dashboard'].includes(state.currentPage)) {
        renderPage(state.currentPage);
      }
    } catch (error) {
      showToast('error', 'Error', 'Failed to add expense');
    }
  });
}

// =====================================================
// CSV IMPORT
// =====================================================
function openImportModal() {
  const content = `
    <div class="import-container">
      <div class="import-dropzone" id="importDropzone">
        <div class="import-dropzone-icon">📤</div>
        <div class="import-dropzone-text">Drop CSV file here or click to browse</div>
        <div class="import-dropzone-hint">Supports bank statements with Date, Amount, Description columns</div>
        <input type="file" id="csvFileInput" accept=".csv" style="display: none;">
      </div>
      
      <div id="importPreview" style="display: none;">
        <div class="import-preview-header">
          <h4>📋 Preview</h4>
          <span class="import-preview-count" id="importCount"></span>
        </div>
        <div class="table-container">
          <table class="table import-preview-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody id="importTableBody"></tbody>
          </table>
        </div>
        <div class="flex gap-md mt-lg">
          <button class="btn btn-secondary" onclick="document.getElementById('importPreview').style.display='none'; document.getElementById('importDropzone').style.display='block';">
            ← Back
          </button>
          <button class="btn btn-primary" id="importAllBtn">
            ✅ Import All
          </button>
        </div>
      </div>
    </div>
  `;

  openModal('📤 Import from CSV', content);

  const dropzone = document.getElementById('importDropzone');
  const fileInput = document.getElementById('csvFileInput');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processCSVFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processCSVFile(file);
  });
}

let importedExpenses = [];

function processCSVFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      showToast('error', 'Error', 'CSV file is empty or invalid');
      return;
    }

    // Parse header
    const header = lines[0].toLowerCase();
    const rows = lines.slice(1);

    // Ensure categories are loaded
    if (state.categories.length === 0) {
      state.categories = await api.get('/categories');
    }

    // Parse rows
    importedExpenses = rows.map((row, index) => {
      const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

      // Try to detect columns
      let date = cols[0];
      let amount = parseFloat(cols[1]?.replace(/[^0-9.-]/g, '')) || 0;
      let description = cols[2] || '';

      // If amount is negative (debit), make it positive
      if (amount < 0) amount = Math.abs(amount);

      // Auto-categorize based on description
      const category = autoCategize(description);

      return { date, amount, description, category_id: category?.id || 10, category_name: category?.name || 'Other' };
    }).filter(exp => exp.amount > 0);

    // Show preview
    document.getElementById('importDropzone').style.display = 'none';
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('importCount').textContent = `${importedExpenses.length} transactions`;

    document.getElementById('importTableBody').innerHTML = importedExpenses.slice(0, 20).map(exp => `
      <tr>
        <td>${exp.date}</td>
        <td>${formatCurrency(exp.amount)}</td>
        <td>${exp.description}</td>
        <td>${exp.category_name}</td>
      </tr>
    `).join('') + (importedExpenses.length > 20 ? `<tr><td colspan="4">...and ${importedExpenses.length - 20} more</td></tr>` : '');

    document.getElementById('importAllBtn').onclick = importAllExpenses;
  };
  reader.readAsText(file);
}

// Auto-categorize based on keywords
function autoCategize(description) {
  const desc = description.toLowerCase();
  const keywords = {
    1: ['food', 'restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'swiggy', 'zomato', 'uber eats'],
    2: ['uber', 'lyft', 'ola', 'bus', 'metro', 'train', 'fuel', 'petrol', 'gas'],
    3: ['amazon', 'flipkart', 'shopping', 'mall', 'store', 'mart'],
    4: ['netflix', 'spotify', 'movie', 'cinema', 'game', 'entertainment'],
    5: ['electric', 'water', 'internet', 'phone', 'bill', 'utility'],
    6: ['hospital', 'pharmacy', 'medicine', 'doctor', 'health'],
    7: ['hotel', 'flight', 'travel', 'booking', 'airbnb']
  };

  for (const [catId, words] of Object.entries(keywords)) {
    if (words.some(w => desc.includes(w))) {
      return state.categories.find(c => c.id === parseInt(catId));
    }
  }
  return null;
}

async function importAllExpenses() {
  if (importedExpenses.length === 0) return;

  try {
    let imported = 0;
    for (const exp of importedExpenses) {
      try {
        await api.post('/expenses', {
          amount: exp.amount,
          description: exp.description,
          category_id: exp.category_id,
          date: formatDateForAPI(exp.date)
        }, true);
        imported++;
      } catch (e) {
        console.error('Failed to import:', exp);
      }
    }

    closeModal();
    showToast('success', 'Imported!', `${imported} expenses imported successfully`);
    importedExpenses = [];

    if (['expenses', 'dashboard'].includes(state.currentPage)) {
      renderPage(state.currentPage);
    }
  } catch (error) {
    showToast('error', 'Error', 'Import failed');
  }
}

function formatDateForAPI(dateStr) {
  // Try to parse various date formats
  const parsed = new Date(dateStr);
  if (!isNaN(parsed)) {
    return parsed.toISOString().split('T')[0];
  }
  return getToday();
}

// =====================================================
// RECEIPT SCANNER (OCR)
// =====================================================
function openReceiptScanner() {
  const content = `
    <div class="scanner-container">
      <div class="import-dropzone" id="receiptDropzone">
        <div class="import-dropzone-icon">📸</div>
        <div class="import-dropzone-text">Upload or take a photo of your receipt</div>
        <div class="import-dropzone-hint">We'll extract the amount automatically</div>
        <input type="file" id="receiptInput" accept="image/*" capture="environment" style="display: none;">
      </div>
      
      <img id="receiptPreview" class="scanner-preview" style="display: none;">
      
      <div id="scannerProcessing" class="scanner-processing" style="display: none;">
        <div class="scanner-spinner"></div>
        <p>Scanning receipt...</p>
      </div>
      
      <div id="scannerResults" class="scanner-results" style="display: none;">
        <div class="scanner-result-item">
          <span class="scanner-result-label">Amount Detected:</span>
          <span class="scanner-result-value" id="detectedAmount">--</span>
        </div>
        <div class="scanner-result-item">
          <span class="scanner-result-label">Merchant:</span>
          <span class="scanner-result-value" id="detectedMerchant">--</span>
        </div>
        <button class="btn btn-primary btn-block mt-lg" id="useDetectedBtn">
          ✅ Use These Values
        </button>
      </div>
    </div>
  `;

  openModal('📸 Scan Receipt', content);

  const dropzone = document.getElementById('receiptDropzone');
  const fileInput = document.getElementById('receiptInput');

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processReceiptImage(file);
  });
}

async function processReceiptImage(file) {
  // Show preview
  const reader = new FileReader();
  const imageDataUrl = await new Promise((resolve) => {
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });

  const preview = document.getElementById('receiptPreview');
  preview.src = imageDataUrl;
  preview.style.display = 'block';
  document.getElementById('receiptDropzone').style.display = 'none';

  // Show processing
  const processingEl = document.getElementById('scannerProcessing');
  processingEl.style.display = 'block';
  processingEl.innerHTML = `
    <div class="scanner-spinner"></div>
    <p>Scanning receipt with OCR...</p>
    <p style="font-size: 12px; color: var(--text-muted);">This may take a few seconds</p>
  `;

  try {
    // Use Tesseract.js for real OCR
    const result = await Tesseract.recognize(imageDataUrl, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const percent = Math.round(m.progress * 100);
          processingEl.innerHTML = `
            <div class="scanner-spinner"></div>
            <p>Scanning... ${percent}%</p>
          `;
        }
      }
    });

    const extractedText = result.data.text;
    console.log('OCR Result:', extractedText);

    // Validate that this looks like a receipt (must contain monetary values)
    const receiptPatterns = [
      /(?:Rs\.?|₹|INR|\$|€|£)\s*[\d,]+(?:\.\d{2})?/i,  // Currency amounts
      /(?:total|subtotal|amount|price|cost|bill|payment)/i,  // Receipt keywords
      /\d+\.\d{2}/,  // Decimal amounts like 99.99
    ];

    const isReceipt = receiptPatterns.some(pattern => pattern.test(extractedText));

    if (!isReceipt) {
      processingEl.style.display = 'none';
      showToast('error', 'Not a Receipt', 'This doesn\'t appear to be a receipt. Please upload an image containing prices or amounts.');

      // Reset the scanner
      document.getElementById('receiptPreview').style.display = 'none';
      document.getElementById('receiptDropzone').style.display = 'block';
      return;
    }

    // Extract amount from text
    const amountPatterns = [
      /(?:total|grand\s*total|amount|bill|net)\s*(?::|=|Rs\.?|₹|INR|\$)?\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d{2})?)/gi,
      /\$\s*([\d,]+(?:\.\d{2})?)/gi,
      /([\d,]+\.\d{2})/g
    ];

    let amount = null;
    let allAmounts = [];

    // Try to find total first
    const totalMatch = extractedText.match(/(?:total|grand\s*total|amount|bill)\s*(?::|=|Rs\.?|₹|INR|\$)?\s*([\d,]+(?:\.\d{2})?)/i);
    if (totalMatch) {
      amount = parseFloat(totalMatch[1].replace(/,/g, ''));
    }

    // If no total found, get the largest amount
    if (!amount) {
      const amountMatches = extractedText.match(/[\d,]+\.\d{2}/g) || [];
      allAmounts = amountMatches.map(a => parseFloat(a.replace(/,/g, ''))).filter(a => a > 0);
      if (allAmounts.length > 0) {
        amount = Math.max(...allAmounts);
      }
    }

    // Extract merchant/store name (usually first line or after "from")
    const lines = extractedText.split('\n').filter(l => l.trim());
    let merchant = lines[0]?.trim() || 'Unknown Store';

    // Clean up merchant name
    merchant = merchant.replace(/[^a-zA-Z\s]/g, '').trim().slice(0, 30) || 'Store';

    processingEl.style.display = 'none';

    if (!amount || amount < 1) {
      showToast('warning', 'Amount Not Found', 'Could not extract a clear amount. Please enter manually.');
      amount = 0;
    }

    // Show results
    document.getElementById('scannerResults').style.display = 'block';
    document.getElementById('detectedAmount').textContent = amount > 0 ? formatCurrency(amount) : 'Not detected';
    document.getElementById('detectedMerchant').textContent = merchant;

    document.getElementById('useDetectedBtn').onclick = () => {
      closeModal();
      openQuickAddModal();
      setTimeout(() => {
        if (amount > 0) {
          document.getElementById('quickAmount').value = amount;
        }
        document.getElementById('quickDescription').value = merchant;
      }, 100);
    };

  } catch (error) {
    console.error('OCR Error:', error);
    processingEl.style.display = 'none';
    showToast('error', 'Scan Failed', 'Could not process the image. Please try again or use manual entry.');

    // Reset
    document.getElementById('receiptPreview').style.display = 'none';
    document.getElementById('receiptDropzone').style.display = 'block';
  }
}

// =====================================================
// TEXT/SMS PARSER
// =====================================================
function openTextParser() {
  const content = `
    <div class="text-parser-container">
      <div class="form-group">
        <label class="form-label">Paste your bank SMS or payment notification</label>
        <textarea class="text-parser-textarea" id="smsText" 
          placeholder="Example: Rs.245.00 debited from A/c XX1234 on 03-02-26. Info: SWIGGY. Avl Bal: Rs.5,432.10"></textarea>
      </div>
      
      <div class="text-parser-examples">
        <strong>📱 Supported formats:</strong>
        <code>Rs.500 debited from A/c... Info: AMAZON</code>
        <code>You've paid Rs 199 to NETFLIX</code>
        <code>INR 1,234.56 spent at SWIGGY</code>
      </div>
      
      <button class="btn btn-primary btn-block" id="parseTextBtn">
        🔍 Parse & Extract
      </button>
      
      <div id="parsedResult" class="parsed-result" style="display: none;">
        <div class="parsed-result-title">✅ Extracted Details</div>
        <div class="scanner-result-item">
          <span class="scanner-result-label">Amount:</span>
          <span class="scanner-result-value" id="parsedAmount">--</span>
        </div>
        <div class="scanner-result-item">
          <span class="scanner-result-label">Merchant:</span>
          <span class="scanner-result-value" id="parsedMerchant">--</span>
        </div>
        <button class="btn btn-primary btn-block mt-lg" id="useParsedBtn">
          ➕ Create Expense
        </button>
      </div>
    </div>
  `;

  openModal('📝 Parse Text/SMS', content);

  document.getElementById('parseTextBtn').onclick = parseSMSText;
}

function parseSMSText() {
  const text = document.getElementById('smsText').value;

  if (!text.trim()) {
    showToast('warning', 'Empty', 'Please paste some text to parse');
    return;
  }

  // Parse amount - multiple patterns
  const amountPatterns = [
    /Rs\.?\s*([\d,]+(?:\.\d{2})?)/i,
    /INR\s*([\d,]+(?:\.\d{2})?)/i,
    /₹\s*([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)/i,
    /([\d,]+(?:\.\d{2})?)\s*(?:debited|spent|paid)/i
  ];

  let amount = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  // Parse merchant
  const merchantPatterns = [
    /(?:Info:|to|at|for)\s*([A-Z][A-Z0-9\s]+)/i,
    /paid\s+(?:to\s+)?([A-Z][A-Z0-9\s]+)/i
  ];

  let merchant = 'Unknown';
  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match) {
      merchant = match[1].trim().split(/\s+/).slice(0, 3).join(' ');
      break;
    }
  }

  if (!amount) {
    showToast('error', 'Not Found', 'Could not extract amount from text');
    return;
  }

  // Show results
  document.getElementById('parsedResult').style.display = 'block';
  document.getElementById('parsedAmount').textContent = formatCurrency(amount);
  document.getElementById('parsedMerchant').textContent = merchant;

  document.getElementById('useParsedBtn').onclick = () => {
    closeModal();
    openQuickAddModal();
    setTimeout(() => {
      document.getElementById('quickAmount').value = amount;
      document.getElementById('quickDescription').value = merchant;
    }, 100);
  };
}

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Load saved auth state
  loadAuthState();

  // Detect user location for currency
  detectLocation();

  // Initialize router
  initRouter();

  // Mobile menu toggle
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Modal close handlers
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Close sidebar when clicking outside on mobile
  document.getElementById('mainContent').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    closeFabMenu();
  });

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearAuthState();
    showToast('success', 'Logged Out', 'You have been signed out');
    window.location.hash = '#/login';
  });

  // FAB button handlers
  const fabMain = document.getElementById('fabMain');
  if (fabMain) {
    fabMain.addEventListener('click', toggleFabMenu);
  }

  // FAB action handlers
  document.querySelectorAll('.fab-action').forEach(btn => {
    btn.addEventListener('click', () => {
      handleFabAction(btn.dataset.action);
    });
  });

  // Make openAddGoalModal globally accessible for onclick handler
  window.openAddGoalModal = openAddGoalModal;
});

// =====================================================
// GROUP EXPENSE SPLITTING PAGES
// =====================================================

async function renderGroupsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>👥 Groups</h1>
      <p class="page-subtitle">Split expenses with friends and track who owes whom</p>
    </div>
    <div style="margin-bottom: var(--spacing-lg);">
      <button class="btn btn-primary" id="createGroupBtn" style="
        background: var(--accent-primary); color: white; border: none;
        padding: 12px 24px; border-radius: var(--radius-md); cursor: pointer;
        font-size: var(--font-size-base); font-weight: 600;
      ">+ Create Group</button>
    </div>
    <div id="groupsList" class="groups-list">
      <div class="loading">Loading groups...</div>
    </div>
  `;

  document.getElementById('createGroupBtn').onclick = openCreateGroupModal;

  try {
    const groups = await api.get('/groups', true);
    const listEl = document.getElementById('groupsList');

    if (groups.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 4rem; margin-bottom: 16px;">👥</div>
          <h3 style="color: var(--text-primary); margin-bottom: 8px;">No groups yet</h3>
          <p>Create a group to start splitting expenses with friends!</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = groups.map(g => `
      <div class="group-card" onclick="window.location.hash='#/group-detail/${g.id}'" style="
        background: var(--bg-card); border: 1px solid var(--border-color);
        border-radius: var(--radius-lg); padding: 20px; cursor: pointer;
        transition: all var(--transition-fast); margin-bottom: 12px;
        display: flex; align-items: center; gap: 16px;
      " onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
        <div style="font-size: 2.5rem;">${g.icon}</div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 4px 0; color: var(--text-primary);">${g.name}</h3>
          <p style="margin: 0; color: var(--text-muted); font-size: var(--font-size-sm);">
            ${g.memberCount} members · ${g.expenseCount} expenses
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: var(--accent-primary); font-size: var(--font-size-lg);">
            ₹${g.totalSpent.toLocaleString()}
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--text-muted);">total spent</div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    document.getElementById('groupsList').innerHTML = '<p style="color: var(--danger);">Failed to load groups</p>';
  }
}

async function renderGroupDetail(container, groupId) {
  container.innerHTML = '<div class="loading">Loading group...</div>';

  try {
    const [group, balanceData] = await Promise.all([
      api.get(`/groups/${groupId}`, true),
      api.get(`/groups/${groupId}/balances`, true)
    ]);

    container.innerHTML = `
      <div class="page-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <a href="#/groups" style="color: var(--text-muted); text-decoration: none; font-size: 1.5rem;">←</a>
          <span style="font-size: 2rem;">${group.icon}</span>
          <div>
            <h1 style="margin: 0;">${group.name}</h1>
            <p style="margin: 0; color: var(--text-muted); font-size: var(--font-size-sm);">
              ${group.members.length} members · Total: ₹${balanceData.totalSpent.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 12px; margin-bottom: var(--spacing-xl);">
        <button class="btn" id="addGroupExpenseBtn" style="
          background: var(--accent-primary); color: white; border: none;
          padding: 10px 20px; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;
        ">+ Add Expense</button>
        <button class="btn" id="settleUpBtn" style="
          background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);
          padding: 10px 20px; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;
        ">💰 Settle Up</button>
        <button class="btn" id="manageUpiBtn" style="
          background: linear-gradient(135deg, #5f3dc4, #7c3aed); color: white; border: none;
          padding: 10px 20px; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;
        ">📱 Manage UPI</button>
      </div>

      <!-- Balances Section -->
      <div style="
        background: var(--bg-card); border: 1px solid var(--border-color);
        border-radius: var(--radius-lg); padding: 20px; margin-bottom: var(--spacing-xl);
      ">
        <h3 style="margin: 0 0 16px 0;">💳 Who Owes Whom</h3>
        ${balanceData.transactions.length === 0 ?
        '<p style="color: var(--text-muted);">✅ All settled up!</p>' :
        balanceData.transactions.map(t => `
            <div style="
              display: flex; align-items: center; justify-content: space-between;
              padding: 12px 0; border-bottom: 1px solid var(--border-color-light);
            ">
              <div>
                <span style="font-weight: 600; color: var(--danger);">${t.from}</span>
                <span style="color: var(--text-muted);"> owes </span>
                <span style="font-weight: 600; color: var(--success);">${t.to}</span>
              </div>
              <div style="font-weight: 700; font-size: var(--font-size-lg);">₹${t.amount.toLocaleString()}</div>
            </div>
          `).join('')
      }
      </div>

      <!-- Member Balances -->
      <div style="
        background: var(--bg-card); border: 1px solid var(--border-color);
        border-radius: var(--radius-lg); padding: 20px; margin-bottom: var(--spacing-xl);
      ">
        <h3 style="margin: 0 0 16px 0;">👤 Member Balances</h3>
        ${balanceData.balances.map(b => `
          <div style="
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 0; border-bottom: 1px solid var(--border-color-light);
          ">
            <span style="font-weight: 500;">${b.name}</span>
            <span style="
              font-weight: 700;
              color: ${b.balance > 0 ? 'var(--success)' : b.balance < 0 ? 'var(--danger)' : 'var(--text-muted)'};
            ">
              ${b.balance > 0 ? '+' : ''}₹${b.balance.toLocaleString()}
            </span>
          </div>
        `).join('')}
      </div>

      <!-- Expenses List -->
      <div style="
        background: var(--bg-card); border: 1px solid var(--border-color);
        border-radius: var(--radius-lg); padding: 20px;
      ">
        <h3 style="margin: 0 0 16px 0;">📝 Expenses</h3>
        ${group.expenses.length === 0 ?
        '<p style="color: var(--text-muted);">No expenses yet. Add one!</p>' :
        group.expenses.map(e => `
            <div style="
              display: flex; align-items: center; justify-content: space-between;
              padding: 12px 0; border-bottom: 1px solid var(--border-color-light);
            ">
              <div>
                <div style="font-weight: 600;">${e.description}</div>
                <div style="font-size: var(--font-size-sm); color: var(--text-muted);">
                  Paid by <strong>${e.paid_by}</strong> · ${e.date}
                </div>
              </div>
              <div style="font-weight: 700; font-size: var(--font-size-lg);">₹${e.amount.toLocaleString()}</div>
            </div>
          `).join('')
      }
      </div>

      ${group.settlements.length > 0 ? `
        <div style="
          background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: var(--radius-lg); padding: 20px; margin-top: var(--spacing-xl);
        ">
          <h3 style="margin: 0 0 16px 0;">✅ Settlements</h3>
          ${group.settlements.map(s => `
            <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color-light); color: var(--text-secondary);">
              <strong>${s.from_member}</strong> paid <strong>${s.to_member}</strong> ₹${s.amount.toLocaleString()}
              <span style="font-size: var(--font-size-xs); color: var(--text-muted);"> · ${s.date}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    document.getElementById('addGroupExpenseBtn').onclick = () => openAddGroupExpenseModal(groupId, group.members);
    document.getElementById('settleUpBtn').onclick = () => openSettleUpModal(groupId, group.members, balanceData.transactions);
    document.getElementById('manageUpiBtn').onclick = () => openManageUpiModal(groupId, group.members);

  } catch (error) {
    container.innerHTML = '<p style="color: var(--danger);">Failed to load group details</p>';
    console.error(error);
  }
}

function openManageUpiModal(groupId, members) {
  openModal('📱 Manage UPI IDs', `
    <p style="color: var(--text-secondary); margin: 0 0 16px 0;">
      Add or update UPI IDs for group members to enable direct payments.
    </p>
    <div id="upiMemberList">
      ${members.map(m => `
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;" data-member-id="${m.id}">
          <div style="flex: 0 0 100px; font-weight: 600; font-size: 0.95rem;">${m.name}</div>
          <input type="text" class="upi-input" value="${m.upi_id || ''}" placeholder="e.g. name@upi"
            style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <span class="upi-status" style="font-size: 0.85rem; min-width: 20px;">${m.upi_id ? '✅' : '—'}</span>
        </div>
      `).join('')}
    </div>
    <button id="saveUpiBtn" style="
      width: 100%; padding: 12px; border: none; border-radius: var(--radius-md);
      background: linear-gradient(135deg, #5f3dc4, #7c3aed); color: white;
      cursor: pointer; font-weight: 600; font-size: 1rem; margin-top: 8px;
    ">💾 Save UPI IDs</button>
    <small style="color: var(--text-muted); display: block; margin-top: 8px; text-align: center;">
      🔒 UPI IDs are only used to generate payment links — never shared externally
    </small>
  `);

  document.getElementById('saveUpiBtn').onclick = async () => {
    const rows = document.querySelectorAll('[data-member-id]');
    let saved = 0;
    for (const row of rows) {
      const memberId = row.dataset.memberId;
      const upiId = row.querySelector('.upi-input').value.trim();
      const status = row.querySelector('.upi-status');
      try {
        await api.put(`/groups/${groupId}/members/${memberId}/upi`, { upi_id: upiId }, true);
        status.textContent = upiId ? '✅' : '—';
        saved++;
      } catch (err) {
        status.textContent = '❌';
      }
    }
    showToast('success', 'Saved', `Updated UPI IDs for ${saved} member${saved > 1 ? 's' : ''}`);
    closeModal();
    renderGroupDetail(document.getElementById('mainContent'), groupId);
  };
}

function openCreateGroupModal() {
  openModal('👥 Create Group', `
    <form id="createGroupForm">
      <div class="form-group">
        <label class="form-label">Group Name</label>
        <input type="text" class="form-input" id="groupName" placeholder="e.g. Beach Trip, Roommates" required
          style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="groupIconPicker">
          ${['👥', '✈️', '🏠', '🍕', '🎉', '🏖️', '🎮', '🚗', '💼', '🎓'].map(icon => `
            <button type="button" class="icon-option" data-icon="${icon}" style="
              font-size: 1.5rem; padding: 8px; border: 2px solid var(--border-color);
              border-radius: var(--radius-md); cursor: pointer; background: var(--bg-secondary);
            " onclick="document.querySelectorAll('.icon-option').forEach(b=>b.style.borderColor='var(--border-color)'); this.style.borderColor='var(--accent-primary)'; document.getElementById('selectedGroupIcon').value=this.dataset.icon;">${icon}</button>
          `).join('')}
          <input type="hidden" id="selectedGroupIcon" value="👥">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Members</label>
        <div id="memberEntries">
          <div class="member-entry" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
            <input type="text" class="member-name" placeholder="Name" required
              style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <input type="text" class="member-upi" placeholder="UPI ID (optional)"
              style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          </div>
          <div class="member-entry" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
            <input type="text" class="member-name" placeholder="Name" required
              style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <input type="text" class="member-upi" placeholder="UPI ID (optional)"
              style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          </div>
        </div>
        <button type="button" id="addMemberBtn" style="
          background: none; border: 1px dashed var(--border-color); color: var(--accent-primary);
          padding: 8px; width: 100%; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;
        ">+ Add Member</button>
        <small style="color: var(--text-muted); display: block; margin-top: 6px;">💡 Add UPI IDs to enable direct payment via GPay/PhonePe/Paytm</small>
      </div>
      <button type="submit" class="btn btn-primary" style="
        width: 100%; background: var(--accent-primary); color: white; border: none;
        padding: 12px; border-radius: var(--radius-md); cursor: pointer;
        font-weight: 600; font-size: var(--font-size-base);
      ">Create Group</button>
    </form>
  `);

  document.getElementById('addMemberBtn').onclick = () => {
    const entry = document.createElement('div');
    entry.className = 'member-entry';
    entry.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
    entry.innerHTML = '<input type="text" class="member-name" placeholder="Name" required style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md);"><input type="text" class="member-upi" placeholder="UPI ID (optional)" style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md);"><button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1.2rem; padding: 4px;">✕</button>';
    document.getElementById('memberEntries').appendChild(entry);
  };

  document.getElementById('createGroupForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('groupName').value.trim();
    const icon = document.getElementById('selectedGroupIcon').value;
    const nameInputs = document.querySelectorAll('.member-name');
    const upiInputs = document.querySelectorAll('.member-upi');
    const members = [];
    nameInputs.forEach((input, i) => {
      const mName = input.value.trim();
      if (mName) members.push({ name: mName, upi_id: upiInputs[i] ? upiInputs[i].value.trim() || null : null });
    });

    if (members.length < 2) {
      showToast('warning', 'Not Enough', 'Add at least 2 members');
      return;
    }

    try {
      await api.post('/groups', { name, icon, members }, true);
      closeModal();
      showToast('success', 'Group Created', `"${name}" has been created!`);
      navigate('groups');
    } catch (error) {
      showToast('error', 'Error', error.message);
    }
  };
}

function openAddGroupExpenseModal(groupId, members) {
  openModal('💸 Add Group Expense', `
    <form id="addGroupExpenseForm">
      <div class="form-group">
        <label class="form-label">Description</label>
        <input type="text" class="form-input" id="geDescription" placeholder="e.g. Dinner, Uber, Hotel" required
          style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
      </div>
      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input type="number" class="form-input" id="geAmount" placeholder="0.00" step="0.01" required
          style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
      </div>
      <div class="form-group">
        <label class="form-label">Paid by</label>
        <select id="gePaidBy" class="form-input" required
          style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          ${members.map(m => `<option value="${m.name}">${m.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Split among (select members involved)</label>
        <div id="memberCheckboxes" style="
          border: 1px solid var(--border-color); border-radius: var(--radius-md);
          padding: 8px 12px; max-height: 200px; overflow-y: auto;
        ">
          ${members.map(m => `
            <label style="display: flex; align-items: center; gap: 10px; padding: 8px 4px; cursor: pointer; border-bottom: 1px solid var(--border-color-light);">
              <input type="checkbox" class="member-check" value="${m.name}" checked
                style="width: 18px; height: 18px; accent-color: var(--accent-primary); cursor: pointer;">
              <span style="font-weight: 500;">${m.name}</span>
            </label>
          `).join('')}
        </div>
        <div id="splitInfo" style="
          margin-top: 8px; padding: 10px; background: var(--bg-secondary); 
          border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--font-size-sm);
        ">
          💡 Split equally among ${members.length} members
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" class="form-input" id="geDate" value="${new Date().toISOString().split('T')[0]}"
          style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
      </div>
      <button type="submit" class="btn btn-primary" style="
        width: 100%; background: var(--accent-primary); color: white; border: none;
        padding: 12px; border-radius: var(--radius-md); cursor: pointer;
        font-weight: 600; font-size: var(--font-size-base);
      ">Add Expense</button>
    </form>
  `);

  // Update split info when checkboxes or amount changes
  const updateSplitInfo = () => {
    const checked = document.querySelectorAll('.member-check:checked');
    const amount = parseFloat(document.getElementById('geAmount').value) || 0;
    const count = checked.length;
    const splitAmount = count > 0 ? (amount / count).toFixed(2) : 0;
    const names = Array.from(checked).map(c => c.value).join(', ');
    document.getElementById('splitInfo').innerHTML = count === 0
      ? '⚠️ Select at least one member'
      : amount > 0
        ? `💡 ₹${splitAmount} each → <strong>${names}</strong>`
        : `💡 Split among <strong>${count}</strong> member${count > 1 ? 's' : ''}: ${names}`;
  };

  document.querySelectorAll('.member-check').forEach(cb => cb.addEventListener('change', updateSplitInfo));
  document.getElementById('geAmount').addEventListener('input', updateSplitInfo);

  document.getElementById('addGroupExpenseForm').onsubmit = async (e) => {
    e.preventDefault();
    const selectedMembers = Array.from(document.querySelectorAll('.member-check:checked')).map(c => c.value);

    if (selectedMembers.length === 0) {
      showToast('warning', 'No Members', 'Select at least one member to split with');
      return;
    }

    try {
      await api.post(`/groups/${groupId}/expenses`, {
        description: document.getElementById('geDescription').value,
        amount: parseFloat(document.getElementById('geAmount').value),
        paid_by: document.getElementById('gePaidBy').value,
        date: document.getElementById('geDate').value,
        split_type: 'equal',
        selected_members: selectedMembers
      }, true);
      closeModal();
      showToast('success', 'Expense Added', `Split among ${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''}`);
      window.location.hash = `#/group-detail/${groupId}`;
      renderGroupDetail(document.getElementById('mainContent'), groupId);
    } catch (error) {
      showToast('error', 'Error', error.message);
    }
  };
}

function openSettleUpModal(groupId, members, transactions) {
  if (transactions.length === 0) {
    showToast('success', 'All Clear', 'Everyone is settled up! 🎉');
    return;
  }

  // Build a map of member name -> upi_id
  const upiMap = {};
  members.forEach(m => { if (m.upi_id) upiMap[m.name] = m.upi_id; });

  openModal('💰 Settle Up', `
    <div style="margin-bottom: 16px;">
      <p style="color: var(--text-secondary); margin: 0 0 16px 0;">Select a payment to record or pay directly via UPI:</p>
      ${transactions.map((t, i) => {
    const payeeUpi = upiMap[t.to] || '';
    const isCurrentUserPayer = state.user && t.from.toLowerCase() === state.user.name.toLowerCase();
    const upiLink = payeeUpi
      ? `upi://pay?pa=${encodeURIComponent(payeeUpi)}&pn=${encodeURIComponent(t.to)}&am=${t.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Settlement - ExpenseFlow')}`
      : '';
    return `
        <div class="settle-option" style="
          border: 1px solid var(--border-color); border-radius: var(--radius-md);
          padding: 16px; margin-bottom: 10px;
          transition: all var(--transition-fast);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <span style="font-weight: 600; color: var(--danger);">${t.from}</span>
              <span style="color: var(--text-muted);"> pays </span>
              <span style="font-weight: 600; color: var(--success);">${t.to}</span>
            </div>
            <div style="font-weight: 700; font-size: var(--font-size-lg);">₹${t.amount.toLocaleString()}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="settleTransaction(${groupId}, '${t.from}', '${t.to}', ${t.amount})" style="
              flex: 1; padding: 8px; border: 1px solid var(--accent-primary); border-radius: var(--radius-md);
              background: white; color: var(--accent-primary); cursor: pointer; font-weight: 600; font-size: 0.85rem;
            ">✅ Mark as Settled</button>
            ${payeeUpi && isCurrentUserPayer ? `
              <a href="${upiLink}" style="
                flex: 1; padding: 8px; border: none; border-radius: var(--radius-md);
                background: linear-gradient(135deg, #5f3dc4, #7c3aed); color: white; cursor: pointer;
                font-weight: 600; font-size: 0.85rem; text-align: center; text-decoration: none;
                display: flex; align-items: center; justify-content: center; gap: 6px;
              " onclick="event.stopPropagation();">
                📱 Pay via UPI
              </a>
            ` : `
              <button disabled style="
                flex: 1; padding: 8px; border: 1px solid var(--border-color-light); border-radius: var(--radius-md);
                background: var(--bg-secondary); color: var(--text-muted); cursor: not-allowed;
                font-weight: 500; font-size: 0.85rem;
              " title="No UPI ID set for ${t.to}">📱 No UPI ID</button>
            `}
          </div>
          ${payeeUpi && isCurrentUserPayer ? `<div style="margin-top: 6px; font-size: 0.75rem; color: var(--text-muted); text-align: center;">
            🔒 Secure — opens your UPI app (GPay/PhonePe/Paytm)
          </div>` : `<div style="margin-top: 6px; font-size: 0.75rem; color: var(--text-muted); text-align: center;">
            Add ${t.to}'s UPI ID when creating the group to enable UPI pay
          </div>`}
        </div>
      `}).join('')}
    </div>
  `);
}

window.settleTransaction = async function (groupId, from, to, amount) {
  try {
    await api.post(`/groups/${groupId}/settle`, {
      from_member: from,
      to_member: to,
      amount: amount
    }, true);
    closeModal();
    showToast('success', 'Settled!', `${from} paid ${to} ₹${amount}`);
    renderGroupDetail(document.getElementById('mainContent'), groupId);
  } catch (error) {
    showToast('error', 'Error', error.message);
  }
};
