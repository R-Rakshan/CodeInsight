import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const MAX_REVIEW_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const parseApiError = (error) => {
  const status = error.response?.status;
  const data = error.response?.data;

  if (status === 429) {
    return 'Too many requests, please wait';
  }

  if (status === 500) {
    return data?.error?.message || 'Server error, please try again';
  }

  if (data?.error?.message) {
    if (data.error.details?.length) {
      return data.error.details.join('. ');
    }
    return data.error.message;
  }

  if (typeof data?.error === 'string') {
    return data.error;
  }

  if (data?.errors?.length) {
    return data.errors.join('. ');
  }

  if (error.message === 'Network Error') {
    return 'Network error. Please check your connection and try again.';
  }

  return 'Something went wrong. Please try again.';
};

const shouldRetryRequest = (error, config) => {
  if (!config || config.__retryCount >= MAX_REVIEW_RETRIES) {
    return false;
  }

  const status = error.response?.status;
  const isReviewPost = config.method === 'post' && config.url?.includes('/review');

  if (!isReviewPost) {
    return false;
  }

  if (!status) {
    return true;
  }

  return status >= 500 || status === 429;
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const isAuthMeRequest = config?.url?.includes('/auth/me');
    const isLoginRequest = config?.url?.includes('/auth/login');
    const isRegisterRequest = config?.url?.includes('/auth/register');

    error.userMessage = parseApiError(error);
    error.isRateLimited = status === 429;

    if (shouldRetryRequest(error, config)) {
      config.__retryCount = (config.__retryCount || 0) + 1;
      await sleep(RETRY_DELAY_MS * config.__retryCount);
      return api(config);
    }

    if (status === 401 && !isAuthMeRequest && !isLoginRequest && !isRegisterRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

const postReviewWithRetry = (data) => api.post('/review', data);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const reviewAPI = {
  createReview: (data) => postReviewWithRetry(data),
  getReviews: (params) => api.get('/review', { params }),
  getReviewById: (id) => api.get(`/review/${id}`),
  deleteReview: (id) => api.delete(`/review/${id}`),
};

export default api;
