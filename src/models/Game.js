/**
 * Game Model
 * Represents a Los Alamos chess game instance
 */
class Game {
  constructor(data = {}) {
    this.gameId = data.gameId || this.generateId();
    this.players = data.players || []; // Array of User objects
    this.board = data.board || null; // Board instance
    this.status = data.status || 'PENDING'; // PENDING, IN_PROGRESS, COMPLETED, ABANDONED
    this.moves = data.moves || []; // Array of Move objects
    this.currentTurn = data.currentTurn || null; // User reference
    this.startTime = data.startTime || null;
    this.endTime = data.endTime || null;
    this.version = data.version || 0; // For optimistic locking
    this.fen = data.fen || 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'; // Initial Los Alamos FEN
    this.clock = data.clock || { white: 300, black: 300 }; // Time in seconds
  }

  generateId() {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startGame() {
    this.status = 'IN_PROGRESS';
    this.startTime = new Date();
    this.currentTurn = this.players[0]; // White starts
  }

  endGame() {
    this.status = 'COMPLETED';
    this.endTime = new Date();
  }

  makeMove(move) {
    // Validate move through Rules Engine
    if (this.status !== 'IN_PROGRESS') {
      return false;
    }
    
    this.moves.push(move);
    this.version++;
    this.switchTurn();
    return true;
  }

  switchTurn() {
    const currentIndex = this.players.indexOf(this.currentTurn);
    this.currentTurn = this.players[(currentIndex + 1) % 2];
  }

  getWinner() {
    // Determine winner based on game completion
    if (this.status !== 'COMPLETED') {
      return null;
    }
    // Logic to determine winner from final position
    return null;
  }

  getGameDuration() {
    if (!this.startTime) return 0;
    const end = this.endTime || new Date();
    return (end - this.startTime) / 1000; // Duration in seconds
  }

  saveGame() {
    // Will be implemented with DatabaseService
    throw new Error('Save should be handled by DatabaseService');
  }

  loadGame() {
    // Will be implemented with DatabaseService
    throw new Error('Load should be handled by DatabaseService');
  }
}

module.exports = Game;