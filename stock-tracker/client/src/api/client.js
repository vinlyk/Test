import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const positions = {
  getAll:          ()       => api.get('/positions').then(r => r.data),
  getOne:          (id)     => api.get(`/positions/${id}`).then(r => r.data),
  create:          (body)   => api.post('/positions', body).then(r => r.data),
  createStrategy:  (legs)   => api.post('/positions/strategy', { legs }).then(r => r.data),
  update:          (id, b)  => api.put(`/positions/${id}`, b).then(r => r.data),
  remove:          (id)     => api.delete(`/positions/${id}`).then(r => r.data),
};

export const prices = {
  refreshAll:  () => api.get('/prices').then(r => r.data),
  getCache:    () => api.get('/prices/cache').then(r => r.data),
  getFx:       () => api.get('/prices/fx').then(r => r.data),
  getStock:    (sym) => api.get(`/prices/stock/${sym}`).then(r => r.data),
  getOption:   (sym) => api.get(`/prices/option/${sym}`).then(r => r.data),
};

export const account = {
  get:    ()    => api.get('/account').then(r => r.data),
  update: (b)   => api.put('/account', b).then(r => r.data),
};

export const trades = {
  getAll:  (params) => api.get('/trades', { params }).then(r => r.data),
  getOne:  (id)     => api.get(`/trades/${id}`).then(r => r.data),
  create:  (body)   => api.post('/trades', body).then(r => r.data),
  update:  (id, b)  => api.put(`/trades/${id}`, b).then(r => r.data),
  remove:  (id)     => api.delete(`/trades/${id}`).then(r => r.data),
};

export const ppTrades = {
  getAll:  (params) => api.get('/pp-trades', { params }).then(r => r.data),
  getOne:  (id)     => api.get(`/pp-trades/${id}`).then(r => r.data),
  create:  (body)   => api.post('/pp-trades', body).then(r => r.data),
  update:  (id, b)  => api.put(`/pp-trades/${id}`, b).then(r => r.data),
  remove:  (id)     => api.delete(`/pp-trades/${id}`).then(r => r.data),
};

export const watchlist = {
  getAll:  ()      => api.get('/watchlist').then(r => r.data),
  create:  (body)  => api.post('/watchlist', body).then(r => r.data),
  update:  (id, b) => api.put(`/watchlist/${id}`, b).then(r => r.data),
  remove:  (id)    => api.delete(`/watchlist/${id}`).then(r => r.data),
};

export default api;
