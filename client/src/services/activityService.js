import api from './api';

export const activityService = {
  getActivities: async (params = {}) => {
    const response = await api.get('/activity', { params });
    return response.data;
  }
};
