import api from './api';

export const searchService = {
  globalSearch: async (query) => {
    if (!query || !query.trim()) {
      return {
        success: true,
        query: '',
        totalMatches: 0,
        results: {
          expenses: [],
          funds: [],
          settlements: [],
          categories: [],
          users: []
        }
      };
    }
    const res = await api.get('/search', { params: { q: query.trim() } });
    return res.data;
  }
};
