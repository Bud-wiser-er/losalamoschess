/**
 * User Model
 * Represents a registered user in the Los Alamos Chess platform
 */
class User {
  constructor(data = {}) {
    this.userId = data.userId || this.generateId();
    this.username = data.username || '';
    this.email = data.email || '';
    this.passwordHash = data.passwordHash || '';
    this.isOnline = data.isOnline || false;
    this.rating = data.rating || 1200; // Starting ELO rating
    this.createdAt = data.createdAt || new Date();
    this.refreshToken = data.refreshToken || null;
    this.tokenExpiry = data.tokenExpiry || null;
  }

  generateId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async login(email, password) {
    // Implementation will be handled by AuthenticationService
    throw new Error('Login should be handled by AuthenticationService');
  }

  logout() {
    this.isOnline = false;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  updateProfile(data) {
    Object.keys(data).forEach(key => {
      if (this.hasOwnProperty(key) && key !== 'userId' && key !== 'passwordHash') {
        this[key] = data[key];
      }
    });
  }

  resetPassword() {
    // Implementation will be handled by AuthenticationService
    throw new Error('Password reset should be handled by AuthenticationService');
  }

  getGameHistory() {
    // Returns list of games - will be implemented with database service
    return [];
  }

  updateRating(newRating) {
    this.rating = newRating;
  }

  toJSON() {
    const { passwordHash, refreshToken, ...publicData } = this;
    return publicData;
  }
}

module.exports = User;