import api from './api';

export const authService = {
  async login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    return res.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem('expense_jwt_token');
    localStorage.removeItem('expense_user_info');
  },

  async getMe() {
    const res = await api.get('/auth/me');
    return res.data;
  },

  async updateProfile(profileData) {
    const res = await api.put('/auth/profile', profileData);
    return res.data;
  },

  async changePassword(passwordData) {
    const res = await api.post('/auth/change-password', passwordData);
    return res.data;
  }
};
