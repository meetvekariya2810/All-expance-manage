import api from './api';

export const userService = {
  async getUsers() {
    const res = await api.get('/users');
    return res.data;
  },

  async createUser(userData) {
    const res = await api.post('/users', userData);
    return res.data;
  },

  async updateUser(id, userData) {
    const res = await api.put(`/users/${id}`, userData);
    return res.data;
  },

  async updateStatus(id, status) {
    const res = await api.patch(`/users/${id}/status`, { status });
    return res.data;
  },

  async resetPassword(id, newPassword) {
    const res = await api.post(`/users/${id}/reset-password`, { newPassword });
    return res.data;
  }
};
