/**
 * Opponent Model
 * Represents an opponent (human or AI)
 */
class Opponent {
  constructor(data = {}) {
    this.opponentId = data.opponentId || this.generateId();
    this.displayName = data.displayName || 'Anonymous';
    this.type = data.type || 'HUMAN'; // HUMAN or AI
    this.rating = data.rating || 1200;
  }

  generateId() {
    return `opponent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  makeMove() {
    // Placeholder for move generation
    // Implementation depends on opponent type
    throw new Error('makeMove must be implemented by subclass');
  }
}

module.exports = Opponent;