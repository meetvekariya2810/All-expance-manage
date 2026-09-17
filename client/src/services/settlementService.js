import api from './api';

export const settlementService = {
  async getSettlements(params = {}) {
    const res = await api.get('/settlements', { params });
    return res.data;
  },

  async getSettlementById(id) {
    const res = await api.get(`/settlements/${id}`);
    return res.data;
  },

  async createSettlement(data) {
    const res = await api.post('/settlements', data);
    return res.data;
  },

  async updateSettlement(id, data) {
    const res = await api.put(`/settlements/${id}`, data);
    return res.data;
  },

  async updateSettlementStatus(id, status) {
    const res = await api.patch(`/settlements/${id}/status`, { status });
    return res.data;
  },

  async deleteSettlement(id) {
    const res = await api.delete(`/settlements/${id}`);
    return res.data;
  }
};
