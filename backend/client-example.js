// AgroLink360 — minimal front-end API client.
//
// Drop this into the prototype and replace the localStorage logic with these
// calls. Works in the browser or Node 18+. The token is kept in localStorage.

const API = 'http://localhost:4000/api';

function authHeader() {
  const t = localStorage.getItem('agrolink_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

export const api = {
  // ── Auth ──
  async login(phone, password) {
    const { user, token } = await request('/auth/login', { method: 'POST', body: { phone, password } });
    localStorage.setItem('agrolink_token', token);
    return user;
  },
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  me: () => request('/auth/me'),

  // ── Marketplace ──
  // GET /produce?q=tomato&category=Tomatoes&lat=6.68&lng=-1.62
  marketplace: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/produce${qs ? `?${qs}` : ''}`);
  },
  myListings: () => request('/produce/mine'),
  createListing: (listing) => request('/produce', { method: 'POST', body: listing }),

  // ── Orders ──
  placeOrder: (listing_id, quantity) => request('/orders', { method: 'POST', body: { listing_id, quantity } }),
  myOrders: () => request('/orders'),

  // ── Logistics ──
  deliveryRequests: () => request('/logistics/requests'),
  acceptDelivery: (id) => request(`/logistics/requests/${id}/accept`, { method: 'POST' }),
  track: (id) => request(`/logistics/deliveries/${id}/track`),

  // ── AI ──
  predictPrice: (produce) => request(`/ai/price?produce=${encodeURIComponent(produce)}`),
  predictHarvest: (produce, planted) =>
    request(`/ai/harvest?produce=${encodeURIComponent(produce)}${planted ? `&planted=${planted}` : ''}`),

  // ── Payments ──
  payMomo: (order_id, msisdn) => request('/payments/momo', { method: 'POST', body: { order_id, msisdn } }),
  paymentStatus: (ref) => request(`/payments/${ref}/status`),
};

// Example:
//   await api.login('+233241000010', 'password123');
//   const { listings } = await api.marketplace({ q: 'tomato' });
//   const { order } = await api.placeOrder(listings[0].id, 8);
//   await api.payMomo(order.id, '+233241000010');
