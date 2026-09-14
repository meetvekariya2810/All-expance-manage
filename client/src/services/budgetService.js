import api from './api';

export const budgetService = {
  async getBudgets(month, targetUser) {
    const res = await api.get('/budgets', { params: { month, targetUser } });
    return res.data;
  },

  async setBudget(budgetData) {
    const res = await api.post('/budgets', budgetData);
    return res.data;
  }
};
