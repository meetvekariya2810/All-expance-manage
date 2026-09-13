/* ==========================================================================
   SMART PERSONAL EXPENSE SYSTEM - CORE FRONTEND ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  currentView: 'dashboard',
  currentPage: 1,
  pageSize: 10,
  currentExpenseId: null,
  selectedExpenseIds: [],

  async init() {
    this.bindEvents();
    
    // Check if user is logged in
    if (!Auth.isAuthenticated()) {
      this.showLoginModal();
    } else {
      Auth.applyRoleRestrictions();
      this.loadCategories();
      this.loadDashboardData();
      this.loadExpenses();
      if (Auth.isAdmin()) {
        this.loadUsers();
      }
    }
  },

  showLoginModal() {
    const modalEl = document.getElementById('loginModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    modal.show();
  },

  openMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.add('show');
    if (overlay) overlay.classList.add('show');
  },

  closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
  },

  toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('show')) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  },

  bindEvents() {
    // Navigation link clicks
    document.querySelectorAll('.nav-link-custom').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        if (targetView) this.switchView(targetView);
        this.closeMobileMenu();
      });
    });

    // Close mobile menu on ESC or window resize
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeMobileMenu();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 992) this.closeMobileMenu();
    });

    // Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        errorEl.classList.add('d-none');
        const res = await Auth.login(username, password);
        if (res.success) {
          bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
          window.location.reload();
        } else {
          errorEl.textContent = res.message || 'Login failed.';
          errorEl.classList.remove('d-none');
        }
      });
    }

    // Quick Login Demo Buttons
    document.querySelectorAll('.btn-quick-login').forEach(btn => {
      btn.addEventListener('click', async () => {
        const username = btn.getAttribute('data-username');
        const password = username + '123';
        document.getElementById('loginUsername').value = username;
        document.getElementById('loginPassword').value = password;
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
      });
    });

    // Theme Switcher
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('expense_theme', newTheme);
        themeBtn.querySelector('i').className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      });

      // Restore saved theme
      const savedTheme = localStorage.getItem('expense_theme') || 'light';
      document.body.setAttribute('data-theme', savedTheme);
      themeBtn.querySelector('i').className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    // Expense Entry Form Submit
    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) {
      expenseForm.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
    }

    // Receipt Image Preview
    const receiptInput = document.getElementById('receiptInput');
    if (receiptInput) {
      receiptInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('receiptPreviewContainer');
        if (file) {
          const reader = new FileReader();
          reader.onload = function(evt) {
            preview.innerHTML = `<img src="${evt.target.result}" class="receipt-preview-img mt-2" alt="Receipt Preview">`;
          };
          reader.readAsDataURL(file);
        } else {
          preview.innerHTML = '';
        }
      });
    }

    // Search & Filter Listeners for Expense List
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.loadExpenses());
    }
    ['filterCategory', 'filterPayment', 'filterPerson', 'filterStartDate', 'filterEndDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.loadExpenses());
    });

    // Select All Checkbox
    const selectAllCheck = document.getElementById('selectAllExpenses');
    if (selectAllCheck) {
      selectAllCheck.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.expense-checkbox').forEach(cb => {
          cb.checked = isChecked;
        });
        this.updateBulkDeleteVisibility();
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
      });
    }
  },

  switchView(viewId) {
    this.currentView = viewId;
    document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));

    const targetContainer = document.getElementById(`view-${viewId}`);
    const targetLink = document.querySelector(`.nav-link-custom[data-view="${viewId}"]`);

    if (targetContainer) targetContainer.classList.add('active');
    if (targetLink) targetLink.classList.add('active');

    if (viewId === 'dashboard') this.loadDashboardData();
    if (viewId === 'expense-list') this.loadExpenses();
    if (viewId === 'reports') this.loadDashboardData();
    if (viewId === 'users' && Auth.isAdmin()) this.loadUsers();
    if (viewId === 'budget') this.loadBudgetData();
  },

  async apiRequest(url, method = 'GET', body = null, isFormData = false) {
    const token = Auth.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(url, opts);
    return await res.json();
  },

  async loadCategories() {
    const res = await this.apiRequest('/api/categories');
    if (res.success) {
      const catSelect = document.getElementById('expenseCategory');
      const filterCatSelect = document.getElementById('filterCategory');
      if (catSelect) {
        catSelect.innerHTML = '<option value="">Select Category</option>';
        res.data.forEach(c => {
          catSelect.innerHTML += `<option value="${c.category_name}">${c.category_name}</option>`;
        });
      }
      if (filterCatSelect) {
        filterCatSelect.innerHTML = '<option value="all">All Categories</option>';
        res.data.forEach(c => {
          filterCatSelect.innerHTML += `<option value="${c.category_name}">${c.category_name}</option>`;
        });
      }
    }
  },

  async loadDashboardData() {
    const res = await this.apiRequest('/api/reports/metrics');
    if (res.success) {
      const s = res.summary;
      document.getElementById('statTotalExpense').textContent = `₹${s.totalExpense.toLocaleString()}`;
      document.getElementById('statTodayExpense').textContent = `₹${s.todayExpense.toLocaleString()}`;
      document.getElementById('statMonthlyExpense').textContent = `₹${s.monthlyExpense.toLocaleString()}`;
      document.getElementById('statRemainingBudget').textContent = `₹${s.remainingBudget.toLocaleString()}`;

      // Budget Progress Bar
      const bgtBar = document.getElementById('budgetProgressBar');
      if (bgtBar) {
        bgtBar.style.width = `${s.budgetUsagePercent}%`;
        if (s.budgetUsagePercent > 100) {
          bgtBar.className = 'progress-glass-bar bg-danger';
          this.showBudgetWarning(true, '⚠️ Monthly budget has been EXCEEDED!');
        } else if (s.budgetUsagePercent >= 80) {
          bgtBar.className = 'progress-glass-bar bg-warning';
          this.showBudgetWarning(true, '⚡ Warning: 80% of monthly budget reached!');
        } else {
          bgtBar.className = 'progress-glass-bar bg-primary';
          this.showBudgetWarning(false);
        }
      }

      // Render Chart.js graphs
      const catCanvas = document.getElementById('categoryChartCanvas');
      if (catCanvas) ChartManager.initCategoryChart(catCanvas, s.categoryTotals);

      const trendCanvas = document.getElementById('monthlyTrendCanvas');
      if (trendCanvas) ChartManager.initTrendChart(trendCanvas, s.monthlyTrend);

      const compCanvas = document.getElementById('userComparisonCanvas');
      if (compCanvas && Auth.isAdmin()) ChartManager.initComparisonChart(compCanvas, s.userTotals);

      // Load Recent Transactions on Dashboard
      this.loadRecentTransactions();
    }
  },

  showBudgetWarning(show, msg = '') {
    const banner = document.getElementById('budgetWarningBanner');
    if (banner) {
      if (show) {
        banner.classList.remove('d-none');
        banner.querySelector('.warning-text').textContent = msg;
      } else {
        banner.classList.add('d-none');
      }
    }
  },

  async loadRecentTransactions() {
    const res = await this.apiRequest('/api/expenses?limit=5');
    if (res.success) {
      const tbody = document.getElementById('recentTransactionsTable');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No recent transactions found.</td></tr>';
        return;
      }

      res.data.forEach(e => {
        tbody.innerHTML += `
          <tr>
            <td>
              <div class="fw-bold">${e.title}</div>
              <small class="text-muted">${e.expense_date} ${e.expense_time || ''}</small>
            </td>
            <td><span class="badge bg-light text-dark">${e.category}</span></td>
            <td>${e.user_name}</td>
            <td><span class="badge-custom badge-${(e.payment_method || 'UPI').toLowerCase().replace(' ', '')}">${e.payment_method}</span></td>
            <td class="fw-bold text-end">₹${parseFloat(e.amount).toLocaleString()}</td>
          </tr>
        `;
      });
    }
  },

  async loadExpenses() {
    const search = document.getElementById('filterSearch')?.value || '';
    const category = document.getElementById('filterCategory')?.value || 'all';
    const payment = document.getElementById('filterPayment')?.value || 'all';
    const person = document.getElementById('filterPerson')?.value || 'all';
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';

    const query = `search=${encodeURIComponent(search)}&category=${category}&payment_method=${payment}&person=${person}&startDate=${startDate}&endDate=${endDate}&page=${this.currentPage}&limit=${this.pageSize}`;

    const res = await this.apiRequest(`/api/expenses?${query}`);
    if (res.success) {
      this.renderExpenseTable(res.data);
      this.renderPagination(res.pagination);
    }
  },

  renderExpenseTable(expenses) {
    const tbody = document.getElementById('expenseListTable');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (expenses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No expense records matched your query.</td></tr>';
      return;
    }

    const currUser = Auth.getUser();

    expenses.forEach(e => {
      const canEdit = Auth.isAdmin() || e.user_id === (currUser ? currUser.id : '');

      const receiptBtn = e.receipt 
        ? `<button class="btn btn-sm btn-outline-primary me-1" onclick="App.viewReceipt('${e.receipt}')"><i class="fa-solid fa-receipt"></i> View</button>` 
        : '<span class="text-muted small">No Receipt</span>';

      const actions = canEdit ? `
        <button class="btn btn-sm btn-outline-secondary me-1" onclick="App.editExpense('${e._id || e.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="App.deleteExpense('${e._id || e.id}')"><i class="fa-solid fa-trash"></i></button>
      ` : '<span class="text-muted small">Read Only</span>';

      tbody.innerHTML += `
        <tr>
          <td><input type="checkbox" class="form-check-input expense-checkbox" value="${e._id || e.id}" onchange="App.updateBulkDeleteVisibility()"></td>
          <td class="fw-bold text-primary">${e.expense_id}</td>
          <td>${e.expense_date}<br><small class="text-muted">${e.expense_time || ''}</small></td>
          <td>
            <div class="fw-bold">${e.title}</div>
            <small class="text-muted">${e.vendor ? e.vendor : ''}</small>
          </td>
          <td>${e.user_name}</td>
          <td><span class="badge bg-light text-dark">${e.category}</span></td>
          <td class="fw-bold">₹${parseFloat(e.amount).toLocaleString()}</td>
          <td><span class="badge-custom badge-${(e.payment_method || 'UPI').toLowerCase().replace(' ', '')}">${e.payment_method}</span></td>
          <td>${receiptBtn}</td>
          <td>${actions}</td>
        </tr>
      `;
    });
  },

  renderPagination(pagination) {
    const container = document.getElementById('expensePagination');
    if (!container) return;
    container.innerHTML = '';

    if (pagination.pages <= 1) return;

    for (let i = 1; i <= pagination.pages; i++) {
      const activeClass = i === pagination.page ? 'active' : '';
      container.innerHTML += `
        <li class="page-item ${activeClass}">
          <button class="page-link" onclick="App.goToPage(${i})">${i}</button>
        </li>
      `;
    }
  },

  goToPage(page) {
    this.currentPage = page;
    this.loadExpenses();
  },

  async handleExpenseSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('expenseForm');
    const formData = new FormData(form);

    let url = '/api/expenses';
    let method = 'POST';

    if (this.currentExpenseId) {
      url = `/api/expenses/${this.currentExpenseId}`;
      method = 'PUT';
    }

    const res = await this.apiRequest(url, method, formData, true);
    if (res.success) {
      alert(res.message);
      this.resetExpenseForm();
      this.switchView('expense-list');
    } else {
      alert('Error saving expense: ' + res.message);
    }
  },

  resetExpenseForm() {
    this.currentExpenseId = null;
    const form = document.getElementById('expenseForm');
    if (form) form.reset();
    document.getElementById('expenseFormTitle').textContent = 'Add New Expense Entry';
    document.getElementById('receiptPreviewContainer').innerHTML = '';
  },

  async editExpense(id) {
    const res = await this.apiRequest(`/api/expenses/${id}`);
    if (res.success) {
      const e = res.data;
      this.currentExpenseId = id;
      document.getElementById('expenseFormTitle').textContent = `Edit Expense (${e.expense_id})`;
      document.getElementById('expenseTitle').value = e.title;
      document.getElementById('expenseAmount').value = e.amount;
      document.getElementById('expenseCategory').value = e.category;
      document.getElementById('expensePaymentMethod').value = e.payment_method;
      document.getElementById('expenseDate').value = e.expense_date;
      document.getElementById('expenseTime').value = e.expense_time || '';
      document.getElementById('expenseVendor').value = e.vendor || '';
      document.getElementById('expenseLocation').value = e.location || '';
      document.getElementById('expenseDescription').value = e.description || '';
      document.getElementById('expenseNotes').value = e.notes || '';

      this.switchView('expense-entry');
    }
  },

  async deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense record?')) {
      const res = await this.apiRequest(`/api/expenses/${id}`, 'DELETE');
      if (res.success) {
        alert(res.message);
        this.loadExpenses();
        this.loadDashboardData();
      } else {
        alert(res.message);
      }
    }
  },

  updateBulkDeleteVisibility() {
    const selected = Array.from(document.querySelectorAll('.expense-checkbox:checked')).map(cb => cb.value);
    const btn = document.getElementById('btnBulkDelete');
    if (btn) {
      btn.style.display = selected.length > 0 ? '' : 'none';
      btn.textContent = `Delete Selected (${selected.length})`;
    }
  },

  async executeBulkDelete() {
    const selected = Array.from(document.querySelectorAll('.expense-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0) return;

    if (confirm(`Are you sure you want to delete ${selected.length} expense record(s)?`)) {
      const res = await this.apiRequest('/api/expenses/bulk', 'DELETE', { ids: selected });
      if (res.success) {
        alert(res.message);
        this.loadExpenses();
        this.loadDashboardData();
      } else {
        alert(res.message);
      }
    }
  },

  async eraseAllExpenses() {
    if (confirm('⚠️ Are you sure you want to ERASE ALL expense records? This action cannot be undone.')) {
      const res = await this.apiRequest('/api/expenses/clear-all', 'DELETE');
      if (res.success) {
        alert(res.message);
        this.loadExpenses();
        this.loadDashboardData();
      } else {
        alert(res.message);
      }
    }
  },

  viewReceipt(receiptUrl) {
    const modalEl = document.getElementById('receiptModal');
    const imgEl = document.getElementById('modalReceiptImg');
    imgEl.src = receiptUrl;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },

  async loadUsers() {
    const res = await this.apiRequest('/api/users');
    if (res.success) {
      const tbody = document.getElementById('userManagementTable');
      if (tbody) {
        tbody.innerHTML = '';
        res.data.forEach(u => {
          const roleBadge = u.role === 'admin' ? '<span class="badge-custom badge-admin">Admin</span>' : '<span class="badge-custom badge-user">User</span>';
          const statusBadge = u.status === 'active' ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Disabled</span>';
          const toggleBtnText = u.status === 'active' ? 'Disable' : 'Enable';
          const nextStatus = u.status === 'active' ? 'disabled' : 'active';

          tbody.innerHTML += `
            <tr>
              <td>
                <div class="fw-bold">${u.name}</div>
                <small class="text-muted">@${u.username}</small>
              </td>
              <td>${u.email}</td>
              <td>${u.mobile || '-'}</td>
              <td>${roleBadge}</td>
              <td>${statusBadge}</td>
              <td>
                <button class="btn btn-sm btn-outline-warning me-1" onclick="App.toggleUserStatus('${u._id || u.id}', '${nextStatus}')">${toggleBtnText}</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="App.openResetPasswordModal('${u._id || u.id}')">Reset Password</button>
              </td>
            </tr>
          `;
        });
      }

      // Populate filter dropdown dynamically for Admin
      const filterPerson = document.getElementById('filterPerson');
      if (filterPerson) {
        const currentValue = filterPerson.value;
        filterPerson.innerHTML = '<option value="all">All Persons</option>';
        res.data.forEach(u => {
          filterPerson.innerHTML += `<option value="${u._id || u.id}">${u.name}</option>`;
        });
        filterPerson.value = currentValue || 'all';
      }
    }
  },

  async toggleUserStatus(userId, status) {
    const res = await this.apiRequest(`/api/users/${userId}/status`, 'PATCH', { status });
    if (res.success) {
      alert(res.message);
      this.loadUsers();
    }
  },

  openResetPasswordModal(userId) {
    document.getElementById('resetUserId').value = userId;
    const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
    modal.show();
  },

  async submitResetPassword() {
    const userId = document.getElementById('resetUserId').value;
    const newPassword = document.getElementById('resetNewPassword').value;

    const res = await this.apiRequest(`/api/users/${userId}/reset-password`, 'POST', { newPassword });
    if (res.success) {
      alert(res.message);
      bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal')).hide();
    } else {
      alert(res.message);
    }
  },

  async submitNewUser() {
    const name = document.getElementById('newUserName').value;
    const email = document.getElementById('newUserEmail').value;
    const username = document.getElementById('newUserUsername').value;
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;

    const res = await this.apiRequest('/api/users', 'POST', { name, email, username, password, role });
    if (res.success) {
      alert(res.message);
      bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
      document.getElementById('addUserForm').reset();
      this.loadUsers();
    } else {
      alert(res.message);
    }
  },

  async loadBudgetData() {
    const res = await this.apiRequest('/api/budgets');
    if (res.success && res.data.length > 0) {
      document.getElementById('budgetAmountInput').value = res.data[0].budget_amount;
    }
  },

  async saveBudget() {
    const amount = document.getElementById('budgetAmountInput').value;
    const user = Auth.getUser();
    const res = await this.apiRequest('/api/budgets', 'POST', {
      user_id: user ? user.id : '',
      budget_amount: amount
    });
    if (res.success) {
      alert(res.message);
      this.loadDashboardData();
    }
  },

  async saveNewCategory() {
    const name = document.getElementById('newCategoryName').value;
    if (!name) return alert('Enter category name.');
    const res = await this.apiRequest('/api/categories', 'POST', { category_name: name });
    if (res.success) {
      alert(res.message);
      document.getElementById('newCategoryName').value = '';
      this.loadCategories();
    } else {
      alert(res.message);
    }
  }
};
