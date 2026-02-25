// =====================================================
// EXPENSE TRACKER - MAIN APPLICATION
// =====================================================

const API_BASE = 'http://localhost:3001/api';

// =====================================================
// STATE MANAGEMENT
// =====================================================
const state = {
    expenses: [],
    categories: [],
    currentPage: 'dashboard',
    editingExpense: null,
    charts: {}
};

// =====================================================
// API CLIENT
// =====================================================
const api = {
    async get(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) throw new Error('API request failed');
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('API request failed');
        return response.json();
    },

    async put(endpoint, data) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('API request failed');
        return response.json();
    },

    async delete(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('API request failed');
        return response.json();
    }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
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
    // Handle hash changes
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(2) || 'dashboard';
        const page = hash.split('/')[0] || 'dashboard';
        navigate(page);
    });

    // Initial route
    const hash = window.location.hash.slice(2) || 'dashboard';
    const page = hash.split('/')[0] || 'dashboard';
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
        default:
            await renderDashboard(mainContent);
    }
}

// =====================================================
// DASHBOARD PAGE
// =====================================================
async function renderDashboard(container) {
    container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Welcome back! Here's your spending overview.</p>
    </div>
    
    <div class="stats-grid" id="statsGrid">
      <div class="card stat-card skeleton" style="height: 140px;"></div>
      <div class="card stat-card skeleton" style="height: 140px;"></div>
      <div class="card stat-card skeleton" style="height: 140px;"></div>
      <div class="card stat-card skeleton" style="height: 140px;"></div>
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
        // Fetch data
        const [summary, byCategory, daily, expenses] = await Promise.all([
            api.get('/analytics/summary'),
            api.get('/analytics/by-category'),
            api.get('/analytics/daily'),
            api.get('/expenses?limit=5')
        ]);

        // Render stats
        renderStats(summary);

        // Render charts
        renderTrendChart(daily);
        renderCategoryChart(byCategory);

        // Render recent expenses
        renderExpenseList(document.getElementById('recentExpenses'), expenses);

    } catch (error) {
        showToast('error', 'Error', 'Failed to load dashboard data. Make sure the server is running.');
        console.error(error);
    }
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

    // Fill in missing dates
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
        // Load categories for filter
        if (state.categories.length === 0) {
            state.categories = await api.get('/categories');
        }

        const filterCategory = document.getElementById('filterCategory');
        state.categories.forEach(cat => {
            filterCategory.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
        });

        // Load expenses
        await loadExpenses();

        // Setup filter listeners
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
        const expenses = await api.get(url);
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
    // Load categories if not loaded
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

    // Category selection
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            document.getElementById('expenseCategory').value = item.dataset.id;
        });
    });

    // Form submission
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
            await api.post('/expenses', data);
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
    const startDate = document.getElementById('analyticsStartDate').value;
    const endDate = document.getElementById('analyticsEndDate').value;

    try {
        const [summary, byCategory, daily] = await Promise.all([
            api.get(`/analytics/summary?startDate=${startDate}&endDate=${endDate}`),
            api.get(`/analytics/by-category?startDate=${startDate}&endDate=${endDate}`),
            api.get(`/analytics/daily?startDate=${startDate}&endDate=${endDate}`)
        ]);

        // Render stats
        document.getElementById('analyticsStats').innerHTML = `
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

        // Destroy existing charts
        if (state.charts.analyticsCategory) state.charts.analyticsCategory.destroy();
        if (state.charts.analyticsDaily) state.charts.analyticsDaily.destroy();

        // Category chart
        const filteredCategories = byCategory.filter(c => c.total_amount > 0);
        if (filteredCategories.length > 0) {
            const ctx = document.getElementById('analyticsCategoryChart').getContext('2d');
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
                                callback: value => '$' + value
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
        if (daily.length > 0) {
            const ctx = document.getElementById('analyticsDailyChart').getContext('2d');
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
                                callback: value => '$' + value
                            }
                        }
                    }
                }
            });
        }

        // Category table
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
        const expense = await api.get(`/expenses/${id}`);
        state.editingExpense = expense;
        window.location.hash = '#/add';

        // Wait for navigation and render with expense data
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

        // Reload current page
        renderPage(state.currentPage);
    } catch (error) {
        showToast('error', 'Error', 'Failed to delete expense');
    }
};

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
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
    });
});
