/* ==========================================================================
   SMART PERSONAL EXPENSE SYSTEM - CORE FRONTEND ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  currentView: 'dashboard',
  currentPage: 1,
  pageSize: 15,
  currentExpenseId: null,
  dashboardUserFilter: 'all',
  searchDebounceTimer: null,
  allCategories: [],

  // ==========================================================================
  // 1. INITIALIZATION & SESSION MANAGEMENT
  // ==========================================================================
  async init() {
    this.bindEvents();
    this.initTheme();

    const loginScreen = document.getElementById('loginScreen');
    const appLayout = document.getElementById('app-layout');

    if (!Auth.isAuthenticated()) {
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
      return;
    } else {
      const isValid = await Auth.validateSession();
      if (!isValid) {
        this.showToast('Session expired. Please log in again.', 'warning');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appLayout) appLayout.style.display = 'none';
        return;
      }

      if (loginScreen) loginScreen.style.display = 'none';
      if (appLayout) appLayout.style.display = 'flex';

      Auth.applyRoleRestrictions();
      await this.loadCategories();
      this.initDateDefaults();
      this.loadDashboardData();
      this.loadExpenses();
      this.loadBudgetData();
      this.loadProfile();

      if (Auth.isAdmin()) {
        this.loadUsers();
        this.loadCategoriesManager();
      }
    }
  },

  async submitStandaloneLogin() {
    const u = document.getElementById('loginScreenUsername')?.value?.trim();
    const p = document.getElementById('loginScreenPassword')?.value;
    const errEl = document.getElementById('loginScreenError');
    const errText = document.getElementById('loginScreenErrorText');
    const submitBtn = document.getElementById('loginScreenSubmitBtn');

    if (!u || !p) {
      if (errEl && errText) {
        errText.textContent = 'Please enter both username and password.';
        errEl.classList.remove('d-none');
        errEl.classList.add('d-flex');
      }
      return;
    }

    if (errEl) {
      errEl.classList.add('d-none');
      errEl.classList.remove('d-flex');
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Logging in...';
    }

    const res = await Auth.login(u, p);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> <span>Login</span>';
    }

    if (res.success) {
      const loginScreen = document.getElementById('loginScreen');
      const appLayout = document.getElementById('app-layout');
      if (loginScreen) loginScreen.style.display = 'none';
      if (appLayout) appLayout.style.display = 'flex';
      this.showToast(`Welcome back, ${res.user.name}!`, 'success');
      Auth.applyRoleRestrictions();
      await this.loadCategories();
      this.initDateDefaults();
      this.loadDashboardData();
      this.loadExpenses();
      this.loadBudgetData();
      this.loadProfile();
      if (Auth.isAdmin()) {
        this.loadUsers();
        this.loadCategoriesManager();
      }
    } else {
      if (errEl && errText) {
        errText.textContent = res.message || 'Invalid username or password. Please check your credentials and try again.';
        errEl.classList.remove('d-none');
        errEl.classList.add('d-flex');
      }
    }
  },

  toggleStandalonePassword() {
    const passInput = document.getElementById('loginScreenPassword');
    const eyeIcon = document.getElementById('loginScreenPassEye');
    if (!passInput || !eyeIcon) return;
    if (passInput.type === 'password') {
      passInput.type = 'text';
      eyeIcon.className = 'fa-solid fa-eye-slash';
    } else {
      passInput.type = 'password';
      eyeIcon.className = 'fa-solid fa-eye';
    }
  },

  initTheme() {
    const savedTheme = localStorage.getItem('expense_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const icon = document.querySelector('#themeToggleBtn i');
    if (icon) {
      icon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  },

  initDateDefaults() {
    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Set budget month picker default
    const bgtPicker = document.getElementById('budgetMonthPicker');
    if (bgtPicker) bgtPicker.value = currentMonthStr;

    // Set expense date default in form
    const expDate = document.getElementById('expenseDate');
    if (expDate && !expDate.value) expDate.value = todayStr;

    const expTime = document.getElementById('expenseTime');
    if (expTime && !expTime.value) {
      expTime.value = now.toTimeString().slice(0, 5);
    }
  },

  showLoginModal() {
    const modalEl = document.getElementById('loginModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
      modal.show();
    }
  },

  // ==========================================================================
  // 2. TOAST NOTIFICATIONS & HELPERS
  // ==========================================================================
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastId = 'toast-' + Date.now();
    const iconMap = {
      success: 'fa-circle-check text-success',
      error: 'fa-circle-xmark text-danger',
      warning: 'fa-triangle-exclamation text-warning',
      info: 'fa-circle-info text-primary'
    };
    const icon = iconMap[type] || iconMap.info;

    const html = `
      <div id="${toastId}" class="toast align-items-center show glass-card border-0 mb-2 shadow" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex p-2">
          <div class="toast-body d-flex align-items-center gap-2">
            <i class="fa-solid ${icon} fs-5"></i>
            <span class="fw-semibold">${message}</span>
          </div>
          <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close" onclick="document.getElementById('${toastId}').remove()"></button>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
    setTimeout(() => {
      const el = document.getElementById(toastId);
      if (el) el.remove();
    }, 3500);
  },

  formatINR(num) {
    const val = parseFloat(num) || 0;
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // ==========================================================================
  // 3. API REQUEST CLIENT
  // ==========================================================================
  async apiRequest(url, method = 'GET', body = null, isFormData = false) {
    const token = Auth.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    try {
      const res = await fetch(url, opts);
      if (res.status === 401) {
        Auth.clearSession();
        this.showToast('Session expired. Please log in.', 'warning');
        this.showLoginModal();
        return { success: false, message: 'Unauthorized' };
      }
      return await res.json();
    } catch (err) {
      console.error('API request error:', err);
      return { success: false, message: 'Network connection error.' };
    }
  },

  // ==========================================================================
  // 4. NAVIGATION & VIEW SWITCHING
  // ==========================================================================
  switchView(viewId) {
    this.currentView = viewId;
    document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));

    const targetContainer = document.getElementById(`view-${viewId}`);
    const targetLink = document.getElementById(`nav-${viewId}`);

    if (targetContainer) targetContainer.classList.add('active');
    if (targetLink) targetLink.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewId === 'dashboard') this.loadDashboardData();
    if (viewId === 'expense-list') this.loadExpenses();
    if (viewId === 'reports') this.loadReportsData();
    if (viewId === 'budget') this.loadBudgetData();
    if (viewId === 'categories' && Auth.isAdmin()) this.loadCategoriesManager();
    if (viewId === 'users' && Auth.isAdmin()) this.loadUsers();
    if (viewId === 'profile') this.loadProfile();

    this.closeMobileMenu();
  },

  openMobileMenu() {
    document.getElementById('sidebar')?.classList.add('show');
    document.getElementById('sidebarOverlay')?.classList.add('show');
  },

  closeMobileMenu() {
    document.getElementById('sidebar')?.classList.remove('show');
    document.getElementById('sidebarOverlay')?.classList.remove('show');
  },

  toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('show')) this.closeMobileMenu();
    else this.openMobileMenu();
  },

  // ==========================================================================
  // 5. EVENT BINDINGS
  // ==========================================================================
  bindEvents() {
    // Navigation links
    document.querySelectorAll('.nav-link-custom[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        if (view) this.switchView(view);
      });
    });

    // Theme Switcher
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const curr = document.body.getAttribute('data-theme');
        const next = curr === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('expense_theme', next);
        const icon = themeBtn.querySelector('i');
        if (icon) icon.className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      });
    }

    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUsername').value.trim();
        const p = document.getElementById('loginPassword').value;
        const errEl = document.getElementById('loginError');

        errEl.classList.add('d-none');
        const res = await Auth.login(u, p);
        if (res.success) {
          const modalInstance = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
          if (modalInstance) modalInstance.hide();
          this.showToast(`Welcome back, ${res.user.name}!`, 'success');
          setTimeout(() => window.location.reload(), 300);
        } else {
          errEl.textContent = res.message || 'Invalid credentials.';
          errEl.classList.remove('d-none');
        }
      });
    }



    // Logout Buttons
    ['logoutBtn', 'sidebarLogoutBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          Auth.logout();
        });
      }
    });

    // Expense Form Submit
    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) {
      expenseForm.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
    }

    // Receipt File Preview
    const receiptInput = document.getElementById('receiptInput');
    if (receiptInput) {
      receiptInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('receiptPreviewContainer');
        if (file) {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
              preview.innerHTML = `<img src="${evt.target.result}" class="receipt-preview-img" alt="Preview">`;
            };
            reader.readAsDataURL(file);
          } else if (file.type === 'application/pdf') {
            preview.innerHTML = `<div class="p-2 border rounded text-primary"><i class="fa-solid fa-file-pdf me-2 fs-4"></i> PDF Document Selected (${(file.size / 1024).toFixed(1)} KB)</div>`;
          }
        } else {
          preview.innerHTML = '';
        }
      });
    }

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
  },

  handleGlobalSearch(val) {
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) searchInput.value = val;
    if (this.currentView !== 'expense-list') {
      this.switchView('expense-list');
    }
    this.debouncedLoadExpenses();
  },

  // ==========================================================================
  // 6. CATEGORIES ENGINE
  // ==========================================================================
  async loadCategories() {
    const res = await this.apiRequest('/api/categories');
    if (res.success && Array.isArray(res.data)) {
      this.allCategories = res.data;

      const expenseCat = document.getElementById('expenseCategory');
      const filterCat = document.getElementById('filterCategory');

      if (expenseCat) {
        expenseCat.innerHTML = '<option value="">Select Category *</option>';
        res.data.forEach(c => {
          expenseCat.innerHTML += `<option value="${c.category_name}">${c.category_name}</option>`;
        });
      }

      if (filterCat) {
        const cur = filterCat.value;
        filterCat.innerHTML = '<option value="all">All Categories</option>';
        res.data.forEach(c => {
          filterCat.innerHTML += `<option value="${c.category_name}">${c.category_name}</option>`;
        });
        filterCat.value = cur || 'all';
      }
    }
  },

  async loadCategoriesManager() {
    const res = await this.apiRequest('/api/categories?includeInactive=true');
    if (res.success && Array.isArray(res.data)) {
      const tbody = document.getElementById('categoryManagementTable');
      if (!tbody) return;
      tbody.innerHTML = '';

      res.data.forEach(c => {
        const statusBadge = c.status === 'active' 
          ? '<span class="badge bg-success">Active</span>' 
          : '<span class="badge bg-secondary">Disabled</span>';

        const toggleBtn = c.status === 'active'
          ? `<button class="btn btn-sm btn-outline-warning me-1" onclick="App.toggleCategoryStatus('${c._id || c.id}', 'inactive')">Disable</button>`
          : `<button class="btn btn-sm btn-outline-success me-1" onclick="App.toggleCategoryStatus('${c._id || c.id}', 'active')">Enable</button>`;

        tbody.innerHTML += `
          <tr>
            <td><i class="fa-solid ${c.icon || 'fa-tag'} text-primary fs-5"></i></td>
            <td class="fw-bold">${c.category_name}</td>
            <td>${statusBadge}</td>
            <td><small class="text-muted">${c.is_default ? 'System Default' : 'Custom'}</small></td>
            <td class="text-center">
              <button class="btn btn-sm btn-outline-secondary me-1" onclick="App.openEditCategoryModal('${c._id || c.id}', '${c.category_name}', '${c.icon || ''}')">
                <i class="fa-solid fa-pen"></i> Edit
              </button>
              ${toggleBtn}
            </td>
          </tr>
        `;
      });
    }
  },

  openAddCategoryModal() {
    document.getElementById('categoryEditId').value = '';
    document.getElementById('categoryModalTitle').textContent = 'Add New Category';
    document.getElementById('categoryModalName').value = '';
    document.getElementById('categoryModalIcon').value = 'fa-tag';
    new bootstrap.Modal(document.getElementById('categoryModal')).show();
  },

  openEditCategoryModal(id, name, icon) {
    document.getElementById('categoryEditId').value = id;
    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
    document.getElementById('categoryModalName').value = name;
    document.getElementById('categoryModalIcon').value = icon || 'fa-tag';
    new bootstrap.Modal(document.getElementById('categoryModal')).show();
  },

  async saveCategoryModal() {
    const id = document.getElementById('categoryEditId').value;
    const category_name = document.getElementById('categoryModalName').value.trim();
    const icon = document.getElementById('categoryModalIcon').value.trim();

    if (!category_name) {
      this.showToast('Please enter category name.', 'warning');
      return;
    }

    const url = id ? `/api/categories/${id}` : '/api/categories';
    const method = id ? 'PUT' : 'POST';

    const res = await this.apiRequest(url, method, { category_name, icon });
    if (res.success) {
      this.showToast(res.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('categoryModal'))?.hide();
      this.loadCategories();
      this.loadCategoriesManager();
    } else {
      this.showToast(res.message, 'error');
    }
  },

  async toggleCategoryStatus(id, newStatus) {
    const res = await this.apiRequest(`/api/categories/${id}/status`, 'PATCH', { status: newStatus });
    if (res.success) {
      this.showToast(res.message, 'success');
      this.loadCategories();
      this.loadCategoriesManager();
    } else {
      this.showToast(res.message, 'error');
    }
  },

  // ==========================================================================
  // 7. DASHBOARD DATA & KPIS
  // ==========================================================================
  setDashboardUserFilter(userKey) {
    this.dashboardUserFilter = userKey;
    document.querySelectorAll('#adminUserFilterGroup button').forEach(b => {
      b.classList.remove('active', 'btn-primary-custom');
      b.classList.add('btn-secondary-custom');
      if (b.getAttribute('data-user') === userKey) {
        b.classList.add('active', 'btn-primary-custom');
        b.classList.remove('btn-secondary-custom');
      }
    });
    this.loadDashboardData();
  },

  async loadDashboardData() {
    let url = '/api/reports/metrics';
    if (Auth.isAdmin() && this.dashboardUserFilter !== 'all') {
      url += `?person=${encodeURIComponent(this.dashboardUserFilter)}`;
    }

    const res = await this.apiRequest(url);
    if (res.success && res.summary) {
      const s = res.summary;

      // 10 KPI Overview Stats
      const totalExpEl = document.getElementById('statTotalExpense');
      if (totalExpEl) totalExpEl.textContent = this.formatINR(s.totalExpense);

      const txEl = document.getElementById('statTotalTransactions') || document.getElementById('statTotalCount');
      if (txEl) txEl.textContent = (s.totalTransactions || 0).toLocaleString('en-IN');

      const monthlyExpEl = document.getElementById('statMonthlyExpense');
      if (monthlyExpEl) monthlyExpEl.textContent = this.formatINR(s.monthlyExpense);

      const monthlyBgtEl = document.getElementById('statMonthlyBudget');
      if (monthlyBgtEl) monthlyBgtEl.textContent = this.formatINR(s.budgetAmount);

      const remBgtEl = document.getElementById('statRemainingBudget');
      if (remBgtEl) remBgtEl.textContent = this.formatINR(s.remainingBudget);

      const todayExpEl = document.getElementById('statTodayExpense');
      if (todayExpEl) todayExpEl.textContent = this.formatINR(s.todayExpense);

      const avgExpEl = document.getElementById('statAvgExpense');
      if (avgExpEl) avgExpEl.textContent = this.formatINR(s.averageExpense);

      const highExpEl = document.getElementById('statHighestExpense');
      if (highExpEl) highExpEl.textContent = this.formatINR(s.highestExpense);

      // Budget Progress & Warning
      const bgtBar = document.getElementById('budgetProgressBar');
      const bgtText = document.getElementById('statBudgetPercent');
      if (bgtBar && bgtText) {
        const pct = Math.min(100, s.budgetUsagePercent || 0);
        bgtBar.style.width = `${pct}%`;
        bgtText.textContent = `${s.budgetUsagePercent}% Used • Status: ${s.budgetStatus}`;

        if (s.budgetStatus === 'Over Budget') {
          bgtBar.className = 'progress-glass-bar bg-danger';
          this.showBudgetWarning(true, `⚠️ Budget Alert: Monthly limit of ${this.formatINR(s.budgetAmount)} has been EXCEEDED!`);
        } else if (s.budgetStatus === 'Near Limit' || s.budgetStatus === 'Warning') {
          bgtBar.className = 'progress-glass-bar bg-warning';
          this.showBudgetWarning(true, `⚡ Budget Notice: ${s.budgetUsagePercent}% of monthly limit used (${this.formatINR(s.monthlyExpense)} / ${this.formatINR(s.budgetAmount)}).`);
        } else {
          bgtBar.className = 'progress-glass-bar bg-primary';
          this.showBudgetWarning(false);
        }
      }

      // Admin User Spending Summary Table
      if (Auth.isAdmin() && Array.isArray(s.userSummaries)) {
        const uTable = document.getElementById('userSummaryTableBody');
        if (uTable) {
          uTable.innerHTML = '';
          s.userSummaries.forEach(u => {
            const roleBadge = u.username === 'bhavik' || u.username === 'admin' 
              ? '<span class="badge-custom badge-admin">Admin</span>' 
              : '<span class="badge-custom badge-user">User</span>';

            uTable.innerHTML += `
              <tr>
                <td>
                  <div class="fw-bold">${u.name}</div>
                  <small class="text-muted">@${u.username}</small>
                </td>
                <td>${roleBadge}</td>
                <td class="text-center fw-semibold">${u.totalTransactions}</td>
                <td class="text-end fw-bold text-primary">${this.formatINR(u.currentMonthAmount)}</td>
                <td class="text-end fw-bold">${this.formatINR(u.totalAmount)}</td>
                <td class="text-end text-muted">${this.formatINR(u.averageExpense)}</td>
                <td class="text-end text-danger fw-semibold">${this.formatINR(u.highestExpense)}</td>
                <td><small class="text-muted">${u.lastExpenseDate}</small></td>
                <td>
                  <button class="btn btn-sm btn-outline-primary" onclick="App.filterByUserFromSummary('${u.user_id}')">
                    <i class="fa-solid fa-filter me-1"></i> Filter
                  </button>
                </td>
              </tr>
            `;
          });
        }
      }

      // Charts Render
      const catCanvas = document.getElementById('categoryChartCanvas');
      if (catCanvas) ChartManager.initCategoryChart(catCanvas, s.categoryTotals);

      const trendCanvas = document.getElementById('monthlyTrendCanvas');
      if (trendCanvas) ChartManager.initTrendChart(trendCanvas, s.monthlyTrend);

      const payCanvas = document.getElementById('paymentMethodCanvas');
      if (payCanvas) ChartManager.initPaymentChart(payCanvas, s.paymentTotals);

      const dailyCanvas = document.getElementById('dailySpendingCanvas');
      if (dailyCanvas) ChartManager.initDailyChart(dailyCanvas, s.dailyTrend);

      const compCanvas = document.getElementById('userComparisonCanvas');
      if (compCanvas && Auth.isAdmin()) {
        ChartManager.initComparisonChart(compCanvas, s.userTotals);
      }

      this.loadRecentTransactions();
    }
  },

  filterByUserFromSummary(userId) {
    this.switchView('expense-list');
    const personSelect = document.getElementById('filterPerson');
    if (personSelect) {
      personSelect.value = userId;
      this.loadExpenses();
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
    let url = '/api/expenses?limit=6';
    if (Auth.isAdmin() && this.dashboardUserFilter !== 'all') {
      url += `&person=${encodeURIComponent(this.dashboardUserFilter)}`;
    }

    const res = await this.apiRequest(url);
    if (res.success) {
      const tbody = document.getElementById('recentTransactionsTable');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (!res.data || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No recent transactions found.</td></tr>';
        return;
      }

      res.data.forEach(e => {
        const pmClass = (e.payment_method || 'UPI').toLowerCase().replace(/\s+/g, '');
        tbody.innerHTML += `
          <tr>
            <td>
              <div class="fw-bold cursor-pointer text-primary" onclick="App.openExpenseDetails('${e._id || e.id}')">${e.title}</div>
              <small class="text-muted">${e.expense_date} ${e.expense_time || ''}</small>
            </td>
            <td><span class="badge bg-light text-dark">${e.category}</span></td>
            <td>${e.user_name}</td>
            <td><span class="badge-custom badge-${pmClass}">${e.payment_method}</span></td>
            <td class="fw-bold text-end">${this.formatINR(e.amount)}</td>
            <td class="text-center">
              <button class="btn btn-sm btn-outline-secondary" title="View Transaction" onclick="App.openExpenseDetails('${e._id || e.id}')">
                <i class="fa-solid fa-eye"></i>
              </button>
            </td>
          </tr>
        `;
      });
    }
  },

  // ==========================================================================
  // 8. EXPENSE LIST & FILTERING
  // ==========================================================================
  applyDatePreset(preset) {
    const now = new Date();
    const customRow = document.getElementById('customDateRangeRow');
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');

    if (preset === 'custom') {
      if (customRow) customRow.style.display = '';
      return;
    } else {
      if (customRow) customRow.style.display = 'none';
    }

    const formatDate = (d) => d.toISOString().slice(0, 10);

    if (preset === 'all') {
      startInput.value = '';
      endInput.value = '';
    } else if (preset === 'today') {
      startInput.value = formatDate(now);
      endInput.value = formatDate(now);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startInput.value = formatDate(y);
      endInput.value = formatDate(y);
    } else if (preset === 'this_week') {
      const first = new Date(now);
      first.setDate(first.getDate() - first.getDay());
      startInput.value = formatDate(first);
      endInput.value = formatDate(now);
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      startInput.value = formatDate(first);
      endInput.value = formatDate(now);
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      startInput.value = formatDate(first);
      endInput.value = formatDate(last);
    } else if (preset === 'this_year') {
      const first = new Date(now.getFullYear(), 0, 1);
      startInput.value = formatDate(first);
      endInput.value = formatDate(now);
    }

    this.currentPage = 1;
    this.loadExpenses();
  },

  debouncedLoadExpenses() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadExpenses();
    }, 280);
  },

  resetFilters() {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterCategory').value = 'all';
    document.getElementById('filterPayment').value = 'all';
    const person = document.getElementById('filterPerson');
    if (person) person.value = 'all';
    document.getElementById('filterDatePreset').value = 'this_month';
    this.applyDatePreset('this_month');
  },

  async loadExpenses() {
    const search = document.getElementById('filterSearch')?.value || '';
    const category = document.getElementById('filterCategory')?.value || 'all';
    const payment = document.getElementById('filterPayment')?.value || 'all';
    const person = document.getElementById('filterPerson')?.value || 'all';
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';
    const sortVal = document.getElementById('filterSort')?.value || 'date_desc';

    let sortBy = 'expense_date';
    let sortOrder = 'desc';
    if (sortVal === 'date_asc') { sortBy = 'expense_date'; sortOrder = 'asc'; }
    else if (sortVal === 'amount_desc') { sortBy = 'amount'; sortOrder = 'desc'; }
    else if (sortVal === 'amount_asc') { sortBy = 'amount'; sortOrder = 'asc'; }

    const query = new URLSearchParams({
      search,
      category,
      payment_method: payment,
      person,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page: this.currentPage,
      limit: this.pageSize
    });

    const res = await this.apiRequest(`/api/expenses?${query.toString()}`);
    if (res.success) {
      this.renderExpenseTable(res.data);
      this.renderPagination(res.pagination);

      // Update Filter Status Info
      const countEl = document.getElementById('expenseResultsCount');
      const sumEl = document.getElementById('expenseResultsSum');
      if (countEl) countEl.textContent = `Showing ${res.data.length} of ${res.pagination.total} expenses`;

      const sum = (res.data || []).reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
      if (sumEl) sumEl.textContent = `Page Total: ${this.formatINR(sum)}`;
    }
  },

  renderExpenseTable(expenses) {
    const tbody = document.getElementById('expenseListTable');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!expenses || expenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center text-muted py-5">
            <i class="fa-solid fa-receipt fs-1 mb-2 d-block text-secondary opacity-50"></i>
            <h6>No expense records found</h6>
            <p class="small text-muted mb-3">Adjust your filters or add a new expense to track spending.</p>
            <button class="btn btn-sm btn-primary-custom" onclick="App.switchView('expense-entry')">
              <i class="fa-solid fa-plus me-1"></i> Add Expense
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const currUser = Auth.getUser();

    expenses.forEach(e => {
      const canEdit = Auth.isAdmin() || e.user_id === (currUser ? currUser.id : '');

      const receiptBtn = e.receipt 
        ? `<button class="btn btn-sm btn-outline-primary" title="View Receipt" onclick="App.viewReceipt('${e.receipt}')"><i class="fa-solid fa-file-invoice"></i></button>` 
        : '<span class="text-muted small">-</span>';

      const actions = canEdit ? `
        <button class="btn btn-sm btn-outline-info me-1" title="View Details" onclick="App.openExpenseDetails('${e._id || e.id}')"><i class="fa-solid fa-circle-info"></i></button>
        <button class="btn btn-sm btn-outline-secondary me-1" title="Edit" onclick="App.editExpense('${e._id || e.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="btn btn-sm btn-outline-danger" title="Delete" onclick="App.deleteExpense('${e._id || e.id}')"><i class="fa-solid fa-trash"></i></button>
      ` : `
        <button class="btn btn-sm btn-outline-info" title="View Details" onclick="App.openExpenseDetails('${e._id || e.id}')"><i class="fa-solid fa-circle-info"></i></button>
      `;

      const pmClass = (e.payment_method || 'UPI').toLowerCase().replace(/\s+/g, '');

      tbody.innerHTML += `
        <tr>
          <td><input type="checkbox" class="form-check-input expense-checkbox" value="${e._id || e.id}" onchange="App.updateBulkDeleteVisibility()"></td>
          <td class="fw-semibold cursor-pointer text-primary" onclick="App.openExpenseDetails('${e._id || e.id}')">${e.expense_id}</td>
          <td>${e.expense_date}<br><small class="text-muted">${e.expense_time || ''}</small></td>
          <td><span class="fw-semibold">${e.user_name}</span></td>
          <td>
            <div class="fw-bold cursor-pointer" onclick="App.openExpenseDetails('${e._id || e.id}')">${e.title}</div>
            <small class="text-muted">${e.vendor || ''}</small>
          </td>
          <td><span class="badge bg-light text-dark">${e.category}</span></td>
          <td class="fw-bold text-end">${this.formatINR(e.amount)}</td>
          <td><span class="badge-custom badge-${pmClass}">${e.payment_method}</span></td>
          <td class="text-center">${receiptBtn}</td>
          <td class="text-center text-nowrap">${actions}</td>
        </tr>
      `;
    });
  },

  renderPagination(pagination) {
    const container = document.getElementById('expensePagination');
    const status = document.getElementById('paginationStatus');
    if (!container) return;
    container.innerHTML = '';

    if (status) status.textContent = `Page ${pagination.page} of ${pagination.pages || 1} (${pagination.total} total)`;

    if (pagination.pages <= 1) return;

    // Previous Button
    const prevDisabled = pagination.page <= 1 ? 'disabled' : '';
    container.innerHTML += `
      <li class="page-item ${prevDisabled}">
        <button class="page-link" onclick="App.goToPage(${pagination.page - 1})"><i class="fa-solid fa-chevron-left"></i></button>
      </li>
    `;

    for (let i = 1; i <= pagination.pages; i++) {
      if (i === 1 || i === pagination.pages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
        const activeClass = i === pagination.page ? 'active' : '';
        container.innerHTML += `
          <li class="page-item ${activeClass}">
            <button class="page-link" onclick="App.goToPage(${i})">${i}</button>
          </li>
        `;
      }
    }

    // Next Button
    const nextDisabled = pagination.page >= pagination.pages ? 'disabled' : '';
    container.innerHTML += `
      <li class="page-item ${nextDisabled}">
        <button class="page-link" onclick="App.goToPage(${pagination.page + 1})"><i class="fa-solid fa-chevron-right"></i></button>
      </li>
    `;
  },

  goToPage(page) {
    this.currentPage = page;
    this.loadExpenses();
  },

  // ==========================================================================
  // 9. EXPENSE DETAILS MODAL
  // ==========================================================================
  async openExpenseDetails(id) {
    const res = await this.apiRequest(`/api/expenses/${id}`);
    if (res.success && res.data) {
      const e = res.data;
      const currUser = Auth.getUser();
      const canEdit = Auth.isAdmin() || e.user_id === (currUser ? currUser.id : '');

      document.getElementById('detailModalTitle').innerHTML = `
        <span class="text-primary">${e.expense_id}</span> - ${e.title}
      `;

      let receiptHtml = '<p class="text-muted small">No receipt uploaded for this transaction.</p>';
      if (e.receipt) {
        if (e.receipt.endsWith('.pdf') || e.receipt.includes('application/pdf')) {
          receiptHtml = `
            <div class="mt-2">
              <a href="${e.receipt}" target="_blank" class="btn btn-sm btn-outline-primary">
                <i class="fa-solid fa-file-pdf me-1"></i> Open PDF Receipt
              </a>
            </div>
          `;
        } else {
          receiptHtml = `
            <div class="mt-2 text-center">
              <img src="${e.receipt}" class="img-fluid rounded border shadow-sm" style="max-height: 240px;" alt="Receipt">
              <div class="mt-2">
                <a href="${e.receipt}" target="_blank" class="btn btn-sm btn-outline-secondary">
                  <i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Open Full Image
                </a>
              </div>
            </div>
          `;
        }
      }

      const body = document.getElementById('expenseDetailsBody');
      body.innerHTML = `
        <div class="row g-3">
          <div class="col-md-6">
            <span class="text-muted small">Amount</span>
            <h4 class="fw-bold text-primary mb-0">${this.formatINR(e.amount)}</h4>
          </div>
          <div class="col-md-6">
            <span class="text-muted small">Category</span>
            <div><span class="badge bg-light text-dark fs-6">${e.category}</span></div>
          </div>
          <div class="col-md-4">
            <span class="text-muted small">Date & Time</span>
            <div class="fw-semibold">${e.expense_date} ${e.expense_time || ''}</div>
          </div>
          <div class="col-md-4">
            <span class="text-muted small">Payment Method</span>
            <div class="fw-semibold">${e.payment_method}</div>
          </div>
          <div class="col-md-4">
            <span class="text-muted small">Recorded By</span>
            <div class="fw-semibold">${e.user_name}</div>
          </div>
          <div class="col-md-6">
            <span class="text-muted small">Vendor / Payee</span>
            <div>${e.vendor || '-'}</div>
          </div>
          <div class="col-md-6">
            <span class="text-muted small">Location</span>
            <div>${e.location || '-'}</div>
          </div>
          <div class="col-12">
            <span class="text-muted small">Description</span>
            <div class="p-2 bg-light rounded">${e.description || 'No description provided.'}</div>
          </div>
          <div class="col-12">
            <span class="text-muted small">Notes</span>
            <div class="p-2 bg-light rounded">${e.notes || 'No extra notes.'}</div>
          </div>
          <div class="col-12">
            <span class="text-muted small">Receipt Document</span>
            ${receiptHtml}
          </div>
          <div class="col-12 text-muted small border-top pt-2">
            Created: ${new Date(e.created_at).toLocaleString()} | Updated: ${new Date(e.updated_at || e.created_at).toLocaleString()}
          </div>
        </div>
      `;

      const footer = document.getElementById('expenseDetailsFooter');
      if (footer) {
        footer.innerHTML = `
          ${canEdit ? `
            <button class="btn btn-primary-custom btn-sm" onclick="App.editExpense('${e._id || e.id}'); bootstrap.Modal.getInstance(document.getElementById('expenseDetailsModal')).hide();">
              <i class="fa-solid fa-pen-to-square me-1"></i> Edit
            </button>
            <button class="btn btn-danger-custom btn-sm" onclick="App.deleteExpense('${e._id || e.id}'); bootstrap.Modal.getInstance(document.getElementById('expenseDetailsModal')).hide();">
              <i class="fa-solid fa-trash me-1"></i> Delete
            </button>
          ` : ''}
          <button class="btn btn-secondary-custom btn-sm" data-bs-dismiss="modal">Close</button>
        `;
      }

      new bootstrap.Modal(document.getElementById('expenseDetailsModal')).show();
    }
  },

  // ==========================================================================
  // 10. ADD / EDIT / DELETE EXPENSE
  // ==========================================================================
  async handleExpenseSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveExpense') || document.getElementById('expenseSubmitBtn');
    const originalText = btn ? btn.innerHTML : 'Save';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Saving expense...';
    }

    const form = document.getElementById('expenseForm');
    const formData = new FormData(form);

    let url = '/api/expenses';
    let method = 'POST';

    if (this.currentExpenseId) {
      url = `/api/expenses/${this.currentExpenseId}`;
      method = 'PUT';
    }

    const res = await this.apiRequest(url, method, formData, true);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }

    if (res.success) {
      this.showToast(res.message, 'success');
      this.resetExpenseForm();
      this.switchView('expense-list');
      this.loadDashboardData();
    } else {
      this.showToast(res.message || 'Error saving expense.', 'error');
    }
  },

  resetExpenseForm() {
    this.currentExpenseId = null;
    const form = document.getElementById('expenseForm');
    if (form) form.reset();
    const titleEl = document.getElementById('expenseFormTitle');
    if (titleEl) titleEl.textContent = 'Add New Expense Entry';
    const preview = document.getElementById('receiptPreviewContainer');
    if (preview) preview.innerHTML = '';
    this.initDateDefaults();
  },

  async editExpense(id) {
    const res = await this.apiRequest(`/api/expenses/${id}`);
    if (res.success && res.data) {
      const e = res.data;
      this.currentExpenseId = id;
      const titleEl = document.getElementById('expenseFormTitle');
      if (titleEl) titleEl.textContent = `Edit Expense (${e.expense_id})`;

      if (document.getElementById('expenseTitle')) document.getElementById('expenseTitle').value = e.title;
      if (document.getElementById('expenseAmount')) document.getElementById('expenseAmount').value = e.amount;
      if (document.getElementById('expenseCategory')) document.getElementById('expenseCategory').value = e.category;
      
      const pmSelect = document.getElementById('expensePaymentMethod') || document.getElementById('expensePayment');
      if (pmSelect) pmSelect.value = e.payment_method || 'UPI';

      if (document.getElementById('expenseDate')) document.getElementById('expenseDate').value = e.expense_date;
      if (document.getElementById('expenseTime')) document.getElementById('expenseTime').value = e.expense_time || '';
      if (document.getElementById('expenseVendor')) document.getElementById('expenseVendor').value = e.vendor || '';
      if (document.getElementById('expenseLocation')) document.getElementById('expenseLocation').value = e.location || '';
      if (document.getElementById('expenseDescription')) document.getElementById('expenseDescription').value = e.description || '';
      if (document.getElementById('expenseNotes')) document.getElementById('expenseNotes').value = e.notes || '';

      const preview = document.getElementById('receiptPreviewContainer');
      if (preview) {
        if (e.receipt) {
          preview.innerHTML = `<div class="mt-2 text-muted small">Current receipt: <a href="${e.receipt}" target="_blank">View File</a> (Upload new file to replace)</div>`;
        } else {
          preview.innerHTML = '';
        }
      }

      this.switchView('expense-entry');
    }
  },

  async deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense record?')) {
      const res = await this.apiRequest(`/api/expenses/${id}`, 'DELETE');
      if (res.success) {
        this.showToast(res.message, 'success');
        this.loadExpenses();
        this.loadDashboardData();
      } else {
        this.showToast(res.message, 'error');
      }
    }
  },

  async eraseAllExpenses() {
    const confirmMsg = Auth.isAdmin() 
      ? '⚠️ DANGER: Are you sure you want to permanently erase ALL expense records in the system? This action cannot be undone!'
      : '⚠️ DANGER: Are you sure you want to permanently erase ALL of your expense records? This action cannot be undone!';

    if (confirm(confirmMsg)) {
      const res = await this.apiRequest('/api/expenses/clear-all', 'DELETE');
      if (res.success) {
        this.showToast(res.message || 'All expenses erased successfully.', 'success');
        this.loadExpenses();
        this.loadDashboardData();
      } else {
        this.showToast(res.message || 'Unable to erase records.', 'error');
      }
    }
  },

  updateBulkDeleteVisibility() {
    const selected = Array.from(document.querySelectorAll('.expense-checkbox:checked')).map(cb => cb.value);
    const btn = document.getElementById('btnBulkDelete');
    if (btn) {
      btn.style.display = selected.length > 0 ? '' : 'none';
      const countEl = document.getElementById('bulkDeleteCount');
      if (countEl) countEl.textContent = selected.length;
      btn.innerHTML = `<i class="fa-solid fa-trash me-1"></i> Bulk Delete (${selected.length})`;
    }
  },

  async executeBulkDelete() {
    const selected = Array.from(document.querySelectorAll('.expense-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0) return;

    if (confirm(`Are you sure you want to delete ${selected.length} expense record(s)?`)) {
      const res = await this.apiRequest('/api/expenses/bulk', 'DELETE', { ids: selected });
      if (res.success) {
        this.showToast(res.message, 'success');
        this.loadExpenses();
        this.loadDashboardData();
        const selectAll = document.getElementById('selectAllExpenses');
        if (selectAll) selectAll.checked = false;
        this.updateBulkDeleteVisibility();
      } else {
        this.showToast(res.message, 'error');
      }
    }
  },

  viewReceipt(receiptUrl) {
    const container = document.getElementById('receiptModalContent');
    if (receiptUrl.endsWith('.pdf') || receiptUrl.includes('application/pdf')) {
      container.innerHTML = `
        <div class="py-4">
          <i class="fa-solid fa-file-pdf fs-1 text-danger mb-3 d-block"></i>
          <h6>PDF Receipt Document</h6>
          <a href="${receiptUrl}" target="_blank" class="btn btn-primary-custom mt-2">
            <i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Open PDF in New Tab
          </a>
        </div>
      `;
    } else {
      container.innerHTML = `<img src="${receiptUrl}" class="img-fluid rounded border shadow-sm" style="max-height: 500px;" alt="Receipt">`;
    }
    new bootstrap.Modal(document.getElementById('receiptModal')).show();
  },

  // ==========================================================================
  // 11. BUDGET MANAGEMENT
  // ==========================================================================
  async loadBudgetData() {
    const monthPicker = document.getElementById('budgetMonthPicker');
    const selectedMonth = monthPicker ? monthPicker.value : new Date().toISOString().slice(0, 7);

    const res = await this.apiRequest(`/api/budgets?month=${encodeURIComponent(selectedMonth)}`);
    if (res.success) {
      document.getElementById('budgetAmountInput').value = res.budget_amount;
      document.getElementById('budgetViewTotal').textContent = this.formatINR(res.budget_amount);
      document.getElementById('budgetViewSpent').textContent = this.formatINR(res.total_spent);
      document.getElementById('budgetViewRemaining').textContent = this.formatINR(res.remaining_budget);

      const badge = document.getElementById('budgetViewStatusBadge');
      if (badge) {
        badge.textContent = res.status;
        badge.className = `badge ${res.status === 'Over Budget' ? 'bg-danger' : (res.status === 'Safe' ? 'bg-success' : 'bg-warning')}`;
      }

      const bar = document.getElementById('budgetViewProgressBar');
      if (bar) {
        bar.style.width = `${Math.min(100, res.budget_usage_percent)}%`;
        bar.className = `progress-glass-bar ${res.status === 'Over Budget' ? 'bg-danger' : (res.status === 'Safe' ? 'bg-primary' : 'bg-warning')}`;
      }

      document.getElementById('budgetViewPercentText').textContent = `${res.budget_usage_percent}% of budget spent for ${res.month}`;
    }
  },

  async saveBudget() {
    const monthPicker = document.getElementById('budgetMonthPicker');
    const month = monthPicker ? monthPicker.value : new Date().toISOString().slice(0, 7);
    const amount = document.getElementById('budgetAmountInput').value;
    const targetUser = document.getElementById('budgetTargetUser')?.value || 'global';

    if (!amount || parseFloat(amount) < 0) {
      this.showToast('Please enter a valid positive budget amount.', 'warning');
      return;
    }

    const res = await this.apiRequest('/api/budgets', 'POST', {
      month,
      budget_amount: amount,
      user_id: targetUser
    });

    if (res.success) {
      this.showToast(res.message, 'success');
      this.loadBudgetData();
      this.loadDashboardData();
    } else {
      this.showToast(res.message, 'error');
    }
  },

  // ==========================================================================
  // 12. REPORTS & SUMMARIES
  // ==========================================================================
  async loadReportsData() {
    const res = await this.apiRequest('/api/reports/metrics');
    if (res.success && res.summary) {
      const s = res.summary;
      document.getElementById('repTotalSpending').textContent = this.formatINR(s.totalExpense);
      document.getElementById('repTotalTx').textContent = `${s.totalTransactions} transactions`;
      document.getElementById('repAvgSpending').textContent = this.formatINR(s.averageExpense);
      document.getElementById('repHighestSpending').textContent = this.formatINR(s.highestExpense);
      document.getElementById('repLowestSpending').textContent = this.formatINR(s.lowestExpense);

      // Category breakdown table
      const catTable = document.getElementById('reportCategoryTable');
      if (catTable) {
        catTable.innerHTML = '';
        const total = s.totalExpense || 1;
        Object.entries(s.categoryTotals || {}).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
          const pct = Math.round((amt / total) * 100);
          catTable.innerHTML += `
            <tr>
              <td class="fw-bold">${cat}</td>
              <td class="text-end fw-semibold">${this.formatINR(amt)}</td>
              <td class="text-end">${pct}%</td>
            </tr>
          `;
        });
      }

      // Monthly breakdown table
      const monthTable = document.getElementById('reportMonthlyTable');
      if (monthTable) {
        monthTable.innerHTML = '';
        Object.entries(s.monthlyTrend || {}).sort().reverse().forEach(([m, amt]) => {
          monthTable.innerHTML += `
            <tr>
              <td class="fw-bold">${m}</td>
              <td class="text-end fw-semibold text-primary">${this.formatINR(amt)}</td>
            </tr>
          `;
        });
      }
    }
  },

  // ==========================================================================
  // 13. USER MANAGEMENT (ADMIN)
  // ==========================================================================
  async loadUsers() {
    const res = await this.apiRequest('/api/users');
    if (res.success && Array.isArray(res.data)) {
      const tbody = document.getElementById('userManagementTable');
      if (tbody) {
        tbody.innerHTML = '';
        res.data.forEach(u => {
          const roleBadge = u.role === 'admin' 
            ? '<span class="badge-custom badge-admin">Admin</span>' 
            : '<span class="badge-custom badge-user">User</span>';

          const statusBadge = u.status === 'active' 
            ? '<span class="badge bg-success">Active</span>' 
            : '<span class="badge bg-danger">Disabled</span>';

          const toggleBtn = u.status === 'active'
            ? `<button class="btn btn-sm btn-outline-warning me-1" onclick="App.toggleUserStatus('${u._id || u.id}', 'disabled')">Disable</button>`
            : `<button class="btn btn-sm btn-outline-success me-1" onclick="App.toggleUserStatus('${u._id || u.id}', 'active')">Enable</button>`;

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
              <td class="text-center">${u.totalExpenses || 0}</td>
              <td class="text-end fw-bold">${this.formatINR(u.totalSpending || 0)}</td>
              <td class="text-center text-nowrap">
                <button class="btn btn-sm btn-outline-secondary me-1" title="Edit Information" onclick="App.openEditUserModal('${u._id || u.id}', '${u.name}', '${u.email}', '${u.mobile || ''}', '${u.role}')">
                  <i class="fa-solid fa-pen"></i>
                </button>
                ${toggleBtn}
                <button class="btn btn-sm btn-outline-info" title="Reset Password" onclick="App.openResetPasswordModal('${u._id || u.id}')">
                  <i class="fa-solid fa-key"></i>
                </button>
              </td>
            </tr>
          `;
        });
      }

      // Populate filter person select for admin
      const filterPerson = document.getElementById('filterPerson');
      if (filterPerson) {
        const cur = filterPerson.value;
        filterPerson.innerHTML = '<option value="all">All Users</option>';
        res.data.forEach(u => {
          filterPerson.innerHTML += `<option value="${u._id || u.id}">${u.name} (@${u.username})</option>`;
        });
        filterPerson.value = cur || 'all';
      }
    }
  },

  openAddUserModal() {
    const form = document.getElementById('addUserForm');
    if (form) form.reset();
    const modalEl = document.getElementById('addUserModal');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  },

  async submitNewUser() {
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const mobile = document.getElementById('newUserMobile').value.trim();
    const username = document.getElementById('newUserUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;

    const res = await this.apiRequest('/api/users', 'POST', { name, email, mobile, username, password, role });
    if (res.success) {
      this.showToast(res.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('addUserModal'))?.hide();
      document.getElementById('addUserForm').reset();
      this.loadUsers();
    } else {
      this.showToast(res.message, 'error');
    }
  },

  openEditUserModal(id, name, email, mobile, role) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserName').value = name;
    document.getElementById('editUserEmail').value = email;
    document.getElementById('editUserMobile').value = mobile;
    document.getElementById('editUserRole').value = role;
    new bootstrap.Modal(document.getElementById('editUserModal')).show();
  },

  async submitEditUser() {
    const id = document.getElementById('editUserId').value;
    const name = document.getElementById('editUserName').value.trim();
    const email = document.getElementById('editUserEmail').value.trim();
    const mobile = document.getElementById('editUserMobile').value.trim();
    const role = document.getElementById('editUserRole').value;

    const res = await this.apiRequest(`/api/users/${id}`, 'PUT', { name, email, mobile, role });
    if (res.success) {
      this.showToast(res.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('editUserModal'))?.hide();
      this.loadUsers();
    } else {
      this.showToast(res.message, 'error');
    }
  },

  async toggleUserStatus(userId, status) {
    const res = await this.apiRequest(`/api/users/${userId}/status`, 'PATCH', { status });
    if (res.success) {
      this.showToast(res.message, 'success');
      this.loadUsers();
    } else {
      this.showToast(res.message, 'error');
    }
  },

  openResetPasswordModal(userId) {
    document.getElementById('resetUserId').value = userId;
    document.getElementById('resetNewPassword').value = '';
    new bootstrap.Modal(document.getElementById('resetPasswordModal')).show();
  },

  async submitResetPassword() {
    const id = document.getElementById('resetUserId').value;
    const newPassword = document.getElementById('resetNewPassword').value;

    if (!newPassword || newPassword.length < 4) {
      this.showToast('Password must be at least 4 characters long.', 'warning');
      return;
    }

    const res = await this.apiRequest(`/api/users/${id}/reset-password`, 'POST', { newPassword });
    if (res.success) {
      this.showToast(res.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'))?.hide();
    } else {
      this.showToast(res.message, 'error');
    }
  },

  // ==========================================================================
  // 14. PROFILE & SECURITY
  // ==========================================================================
  loadProfile() {
    const user = Auth.getUser();
    if (!user) return;
    document.getElementById('profileName').value = user.name || '';
    document.getElementById('profileUsername').value = user.username || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profileMobile').value = user.mobile || '';
    document.getElementById('profileRole').value = user.role === 'admin' ? 'Main Admin' : 'Sub-Account (User)';
  },

  async submitProfileUpdate() {
    const name = document.getElementById('profileName').value.trim();
    const email = document.getElementById('profileEmail').value.trim();
    const mobile = document.getElementById('profileMobile').value.trim();

    const res = await this.apiRequest('/api/auth/profile', 'PUT', { name, email, mobile });
    if (res.success && res.user) {
      this.showToast(res.message, 'success');
      Auth.updateLocalUser(res.user);
      this.loadProfile();
    } else {
      this.showToast(res.message, 'error');
    }
  },

  async submitChangePassword() {
    const oldPassword = document.getElementById('pwdCurrent').value;
    const newPassword = document.getElementById('pwdNew').value;
    const confirmPassword = document.getElementById('pwdConfirm').value;

    if (newPassword !== confirmPassword) {
      this.showToast('New passwords do not match.', 'warning');
      return;
    }

    const res = await this.apiRequest('/api/auth/change-password', 'POST', {
      oldPassword,
      newPassword,
      confirmPassword
    });

    if (res.success) {
      this.showToast(res.message, 'success');
      document.getElementById('changePasswordForm').reset();
    } else {
      this.showToast(res.message, 'error');
    }
  }
};
