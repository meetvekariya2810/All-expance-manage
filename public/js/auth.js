/* ==========================================================================
   AUTHENTICATION & SESSION MANAGEMENT SCRIPT
   ========================================================================== */

const Auth = {
  getToken() {
    return localStorage.getItem('expense_jwt_token');
  },

  getUser() {
    const userStr = localStorage.getItem('expense_user_info');
    return userStr ? JSON.parse(userStr) : null;
  },

  saveSession(token, user) {
    localStorage.setItem('expense_jwt_token', token);
    localStorage.setItem('expense_user_info', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('expense_jwt_token');
    localStorage.removeItem('expense_user_info');
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  async login(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        this.saveSession(data.token, data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: 'Server connection error.' };
    }
  },

  logout() {
    this.clearSession();
    window.location.reload();
  },

  applyRoleRestrictions() {
    const user = this.getUser();
    if (!user) return;

    // Update UI headers
    document.querySelectorAll('.current-user-name').forEach(el => el.textContent = user.name);
    document.querySelectorAll('.current-user-role').forEach(el => {
      el.textContent = user.role === 'admin' ? 'Main Admin' : 'Sub-Account (User)';
    });

    const adminElements = document.querySelectorAll('.admin-only');
    if (user.role === 'admin') {
      adminElements.forEach(el => el.style.display = '');
    } else {
      adminElements.forEach(el => el.style.display = 'none');
    }

    // Update Dashboard Title and Subtitle dynamically based on role
    const dbTitle = document.querySelector('#view-dashboard .page-title-box h3');
    const dbSub = document.querySelector('#view-dashboard .page-title-box p');
    if (dbTitle && dbSub) {
      if (user.role === 'admin') {
        dbTitle.textContent = `Admin Dashboard Overview - ${user.name}`;
        dbSub.textContent = 'Global summary and expense insights';
      } else {
        dbTitle.textContent = `Personal Dashboard Overview - ${user.name}`;
        dbSub.textContent = 'Individual expense tracking & budget status';
      }
    }
  }
};
