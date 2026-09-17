import api from './api';

export const fundService = {
  async getFunds(params = {}) {
    const res = await api.get('/funds', { params });
    return res.data;
  },

  async getFundById(id) {
    const res = await api.get(`/funds/${id}`);
    return res.data;
  },

  async createFund(data) {
    const res = await api.post('/funds', data);
    return res.data;
  },

  async updateFund(id, data) {
    const res = await api.put(`/funds/${id}`, data);
    return res.data;
  },

  async deleteFund(id) {
    const res = await api.delete(`/funds/${id}`);
    return res.data;
  }
};
