// common/api.js - Updated with your backend integration
// API communication module for Los Alamos Chess

// Browser-compatible environment detection
let API_BASE = 'http://localhost:3000/api';

/**
 * Set the API base URL
 * @param {string} baseUrl - The base URL for API requests
 */
export function setApiBase(baseUrl) {
    API_BASE = baseUrl;
}

/**
 * Get the current API base URL
 * @returns {string} The current API base URL
 */
export function getApiBase() {
    return API_BASE;
}

/**
 * Handle API response
 * @param {Response} response - Fetch response
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @returns {Promise<any>} Response data
 */
async function handleResponse(response, method, url) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    let data;
    if (isJson) {
        data = await response.json();
    } else {
        data = { message: await response.text() };
    }
    
    console.log(`📡 API Response: ${method} ${url} - ${response.status}`, data);
    
    if (!response.ok) {
        throw new APIError(
            data.message || `HTTP ${response.status}`,
            response.status,
            data
        );
    }
    
    return data;
}

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/auth/login')
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
export async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    // Default headers
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    // Add authentication token if available
    const token = localStorage.getItem('accessToken');
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    // Merge headers
    const headers = {
        ...defaultHeaders,
        ...(options.headers || {})
    };
    
    // Prepare fetch options
    const fetchOptions = {
        method: 'GET',
        credentials: 'include', // Include cookies for refresh tokens
        ...options,
        headers
    };
    
    try {
        console.log(`🌐 API Request: ${fetchOptions.method} ${url}`);
        
        const response = await fetch(url, fetchOptions);
        
        // Handle token expiration
        if (response.status === 401 && token) {
            console.log('Token expired, attempting refresh...');
            const refreshSuccess = await refreshAccessToken();
            if (refreshSuccess) {
                // Retry the original request with new token
                const newToken = localStorage.getItem('accessToken');
                fetchOptions.headers['Authorization'] = `Bearer ${newToken}`;
                const retryResponse = await fetch(url, fetchOptions);
                return handleResponse(retryResponse, fetchOptions.method, url);
            } else {
                // Refresh failed, redirect to login
                redirectToLogin();
                throw new APIError('Session expired', 401);
            }
        }
        
        return handleResponse(response, fetchOptions.method, url);
        
    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }
        
        console.error(`❌ API Request failed: ${fetchOptions.method} ${url}`, error);
        throw new APIError(
            error.message || 'Network error',
            0,
            { originalError: error }
        );
    }
}

/**
 * Refresh access token using refresh token
 * @returns {Promise<boolean>} Success status
 */
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
        console.log('❌ No refresh token available');
        return false;
    }
    
    try {
        console.log('🔄 Refreshing access token...');
        
        const response = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) {
            throw new Error('Refresh failed');
        }

        const data = await response.json();
        
        // Store new access token
        localStorage.setItem('accessToken', data.accessToken);
        
        console.log('✅ Token refreshed successfully');
        return true;

    } catch (error) {
        console.error('❌ Token refresh failed:', error);
        // Clear invalid tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return false;
    }
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
    // Clear tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Redirect to login
    if (window.location.pathname !== '/login_page.html') {
        window.location.href = '/login_page.html';
    }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
    constructor(message, status = 0, data = {}) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
    
    get isNetworkError() {
        return this.status === 0;
    }
    
    get isAuthError() {
        return this.status === 401 || this.status === 403;
    }
    
    get isServerError() {
        return this.status >= 500;
    }
    
    get isClientError() {
        return this.status >= 400 && this.status < 500;
    }
}

/**
 * Authentication API calls - Updated for your backend
 */
export const auth = {
    /**
     * Register new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Registration response
     */
    async register(userData) {
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        // Store tokens if provided
        if (response.accessToken) {
            localStorage.setItem('accessToken', response.accessToken);
        }
        if (response.refreshToken) {
            localStorage.setItem('refreshToken', response.refreshToken);
        }

        return response;
    },
    
    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Login response with token
     */
    async login(email, password) {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        // Store tokens
        localStorage.setItem('accessToken', response.accessToken);
        if (response.refreshToken) {
            localStorage.setItem('refreshToken', response.refreshToken);
        }

        return response;
    },
    
    /**
     * Logout user
     * @returns {Promise<void>}
     */
    async logout() {
        try {
            await apiRequest('/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.warn('Logout API call failed:', error.message);
        } finally {
            // Always clear local storage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
        }
    },
    
    /**
     * Get current user profile
     * @returns {Promise<Object>} User profile
     */
    async getProfile() {
        return apiRequest('/auth/me');
    },
    
    /**
     * Validate current token
     * @returns {Promise<Object>} Validation response
     */
    async validate() {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            throw new APIError('No access token', 401);
        }

        return apiRequest('/auth/validate', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    },
    
    /**
     * Request password reset
     * @param {string} email - User email
     * @returns {Promise<Object>} Reset response
     */
    async requestPasswordReset(email) {
        return apiRequest('/auth/password-reset', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }
};

/**
 * Game API calls
 */
export const game = {
    /**
     * Create new game
     * @param {Object} gameOptions - Game configuration
     * @returns {Promise<Object>} Game data
     */
    async create(gameOptions = {}) {
        return apiRequest('/games', {
            method: 'POST',
            body: JSON.stringify(gameOptions)
        });
    },
    
    /**
     * Get game by ID
     * @param {string} gameId - Game ID
     * @returns {Promise<Object>} Game data
     */
    async get(gameId) {
        return apiRequest(`/games/${gameId}`);
    },
    
    /**
     * Join game
     * @param {string} gameId - Game ID
     * @returns {Promise<Object>} Join response
     */
    async join(gameId) {
        return apiRequest(`/games/${gameId}/join`, {
            method: 'POST'
        });
    },
    
    /**
     * Make move
     * @param {string} gameId - Game ID
     * @param {Object} move - Move data
     * @returns {Promise<Object>} Move response
     */
    async makeMove(gameId, move) {
        return apiRequest(`/games/${gameId}/moves`, {
            method: 'POST',
            body: JSON.stringify({ move })
        });
    },
    
    /**
     * Get legal moves
     * @param {string} gameId - Game ID
     * @returns {Promise<Array>} Legal moves
     */
    async getLegalMoves(gameId) {
        return apiRequest(`/games/${gameId}/legal-moves`);
    },
    
    /**
     * Export game as PGN
     * @param {string} gameId - Game ID
     * @returns {Promise<string>} PGN string
     */
    async exportPGN(gameId) {
        return apiRequest(`/games/${gameId}/pgn`);
    }
};

/**
 * Check if user is authenticated
 * @returns {boolean} Authentication status
 */
export function isAuthenticated() {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;
    
    try {
        // Simple JWT expiration check
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
}

/**
 * Get current user from token
 * @returns {Object|null} User data or null
 */
export function getCurrentUser() {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
            id: payload.sub,
            username: payload.name,
            roles: payload.roles || ['player'],
            seat: payload.seat
        };
    } catch {
        return null;
    }
}

/**
 * Initialize API authentication check
 */
export async function initializeAuth() {
    const token = localStorage.getItem('accessToken');
    
    if (token && isAuthenticated()) {
        try {
            // Validate token with backend
            await auth.validate();
            console.log('✅ Authentication initialized');
            return true;
        } catch (error) {
            console.log('❌ Token validation failed, attempting refresh...');
            return await refreshAccessToken();
        }
    } else if (localStorage.getItem('refreshToken')) {
        console.log('🔄 No valid access token, attempting refresh...');
        return await refreshAccessToken();
    }
    
    console.log('❌ No valid authentication found');
    return false;
}

// Auto-initialize authentication when module loads
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        await initializeAuth();
    });
}

/**
 * Default export with all API methods
 */
export default {
    apiRequest,
    setApiBase,
    getApiBase,
    APIError,
    auth,
    game,
    isAuthenticated,
    getCurrentUser,
    initializeAuth
};