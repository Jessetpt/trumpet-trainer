// API client for Trumpet Trainer backend
class TrumpetTrainerAPI {
  constructor() {
    // Use configuration to get the correct API base URL
    this.baseURL = window.appConfig ? window.appConfig.apiBaseUrl : 'http://localhost:3000/api';
    this.token = localStorage.getItem('authToken');
  }

  // Set auth token
  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  // Clear auth token
  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Get auth headers
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // Make API request
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // User registration
  async register(userData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  // User login
  async login(credentials) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  // Get user profile
  async getProfile() {
    return this.request('/user/profile');
  }

  // Save score
  async saveScore(scoreData) {
    return this.request('/scores', {
      method: 'POST',
      body: JSON.stringify(scoreData)
    });
  }

  // Get user's best score
  async getBestScore() {
    return this.request('/scores/best');
  }

  // Get leaderboard
  async getLeaderboard() {
    return this.request('/scores/leaderboard');
  }

  // Logout
  logout() {
    this.clearToken();
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token;
  }
}

// Global API instance
window.trumpetAPI = new TrumpetTrainerAPI(); 