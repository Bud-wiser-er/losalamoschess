// common/api.js
// API communication module for Los Alamos Chess

let API_BASE = 'http://localhost:3000';

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
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
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
        ...options,
        headers
    };
    
    try {
        console.log(`🌐 API Request: ${fetchOptions.method} ${url}`);
        
        const response = await fetch(url, fetchOptions);
        
        // Handle different response types
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new APIError(
                errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                response.status,
                errorData
            );
        }
        
        // Parse response based on content type
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }
        
        console.log(`✅ API Response: ${fetchOptions.method} ${url}`, data);
        return data;
        
    } catch (error) {
        console.error(`❌ API Error: ${fetchOptions.method} ${url}`, error);
        
        if (error instanceof APIError) {
            throw error;
        }
        
        // Network or other errors
        throw new APIError(
            error.message || 'Network error occurred',
            0,
            { originalError: error }
        );
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
 * Authentication API calls
 */
export const auth = {
    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Login response with token
     */
    async login(email, password) {
        return apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    /**
     * Register new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Registration response
     */
    async register(userData) {
        return apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },
    
    /**
     * Validate current token
     * @returns {Promise<Object>} Validation response
     */
    async validate() {
        return apiRequest('/api/auth/validate');
    },
    
    /**
     * Logout user
     * @returns {Promise<void>}
     */
    async logout() {
        const response = await apiRequest('/api/auth/logout', {
            method: 'POST'
        });
        
        // Clear local storage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        
        return response;
    },
    
    /**
     * Refresh access token
     * @returns {Promise<Object>} New token data
     */
    async refresh() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            throw new APIError('No refresh token available', 401);
        }
        
        return apiRequest('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken })
        });
    }
};

/**
 * Game API calls
 */
export const game = {
    /**
     * Create new game
     * @param {Object} gameConfig - Game configuration
     * @returns {Promise<Object>} Game data
     */
    async create(gameConfig = {}) {
        return apiRequest('/api/games', {
            method: 'POST',
            body: JSON.stringify(gameConfig)
        });
    },
    
    /**
     * Get game by ID
     * @param {string} gameId - Game ID
     * @returns {Promise<Object>} Game data
     */
    async get(gameId) {
        return apiRequest(`/api/games/${gameId}`);
    },
    
    /**
     * Make a move
     * @param {string} gameId - Game ID
     * @param {Object} move - Move data (from, to, piece)
     * @returns {Promise<Object>} Move response
     */
    async makeMove(gameId, move) {
        return apiRequest(`/api/games/${gameId}/moves`, {
            method: 'POST',
            body: JSON.stringify(move)
        });
    },
    
    /**
     * Get game history
     * @param {string} gameId - Game ID
     * @returns {Promise<Array>} Move history
     */
    async getHistory(gameId) {
        return apiRequest(`/api/games/${gameId}/history`);
    },
    
    /**
     * Resign game
     * @param {string} gameId - Game ID
     * @returns {Promise<Object>} Game result
     */
    async resign(gameId) {
        return apiRequest(`/api/games/${gameId}/resign`, {
            method: 'POST'
        });
    },
    
    /**
     * Offer draw
     * @param {string} gameId - Game ID
     * @returns {Promise<Object>} Draw offer response
     */
    async offerDraw(gameId) {
        return apiRequest(`/api/games/${gameId}/draw`, {
            method: 'POST'
        });
    },
    
    /**
     * Accept/decline draw
     * @param {string} gameId - Game ID
     * @param {boolean} accept - Accept or decline
     * @returns {Promise<Object>} Draw response
     */
    async respondDraw(gameId, accept) {
        return apiRequest(`/api/games/${gameId}/draw/respond`, {
            method: 'POST',
            body: JSON.stringify({ accept })
        });
    }
};

/**
 * Tournament API calls
 */
export const tournament = {
    /**
     * Create tournament
     * @param {Object} tournamentData - Tournament configuration
     * @returns {Promise<Object>} Tournament data
     */
    async create(tournamentData) {
        return apiRequest('/api/tournaments', {
            method: 'POST',
            body: JSON.stringify(tournamentData)
        });
    },
    
    /**
     * Get tournament by ID
     * @param {string} tournamentId - Tournament ID
     * @returns {Promise<Object>} Tournament data
     */
    async get(tournamentId) {
        return apiRequest(`/api/tournaments/${tournamentId}`);
    },
    
    /**
     * Join tournament
     * @param {string} tournamentId - Tournament ID
     * @returns {Promise<Object>} Join response
     */
    async join(tournamentId) {
        return apiRequest(`/api/tournaments/${tournamentId}/join`, {
            method: 'POST'
        });
    },
    
    /**
     * Leave tournament
     * @param {string} tournamentId - Tournament ID
     * @returns {Promise<Object>} Leave response
     */
    async leave(tournamentId) {
        return apiRequest(`/api/tournaments/${tournamentId}/leave`, {
            method: 'POST'
        });
    },
    
    /**
     * Get active tournaments
     * @returns {Promise<Array>} List of tournaments
     */
    async getActive() {
        return apiRequest('/api/tournaments/active');
    }
};

/**
 * User API calls
 */
export const user = {
    /**
     * Get user profile
     * @param {string} userId - User ID (optional, defaults to current user)
     * @returns {Promise<Object>} User profile
     */
    async getProfile(userId = 'me') {
        return apiRequest(`/api/users/${userId}`);
    },
    
    /**
     * Update user profile
     * @param {Object} profileData - Profile update data
     * @returns {Promise<Object>} Updated profile
     */
    async updateProfile(profileData) {
        return apiRequest('/api/users/me', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    },
    
    /**
     * Get user statistics
     * @param {string} userId - User ID (optional, defaults to current user)
     * @returns {Promise<Object>} User statistics
     */
    async getStats(userId = 'me') {
        return apiRequest(`/api/users/${userId}/stats`);
    },
    
    /**
     * Get user's friends
     * @returns {Promise<Array>} Friends list
     */
    async getFriends() {
        return apiRequest('/api/users/me/friends');
    },
    
    /**
     * Send friend request
     * @param {string} username - Username to send request to
     * @returns {Promise<Object>} Request response
     */
    async sendFriendRequest(username) {
        return apiRequest('/api/users/me/friends/request', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
    }
};

/**
 * Health check
 * @returns {Promise<Object>} Server health status
 */
export async function healthCheck() {
    return apiRequest('/api/health');
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
    tournament,
    user,
    healthCheck
};