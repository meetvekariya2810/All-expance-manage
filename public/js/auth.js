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

  updateLocalUser(user) {
    localStorage.setItem('expense_user_info', JSON.stringify(user));
    this.applyRoleRestrictions();
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

  async validateSession() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        this.clearSession();
        return false;
      }
      const data = await res.json();
      if (data.success && data.user) {
        this.updateLocalUser(data.user);
        return true;
      }
      return false;
    } catch (err) {
      return true; // network fallback: keep session
    }
  },

  logout() {
    this.clearSession();
    window.location.reload();
  },

  applyRoleRestrictions() {
    const user = this.getUser();
    if (!user) return;

    // Update UI headers & badges
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

    // Dynamic Title based on role
    const dbTitle = document.getElementById('dashboardTitle');
    const dbSub = document.getElementById('dashboardSubtitle');
    if (dbTitle && dbSub) {
      if (user.role === 'admin') {
        dbTitle.textContent = `Admin Dashboard Overview - ${user.name}`;
        dbSub.textContent = 'Global summary, family expense control & user insights';
      } else {
        dbTitle.textContent = `Personal Dashboard - ${user.name}`;
        dbSub.textContent = 'Individual expense tracking & personal budget status';
      }
    }
  }
};
