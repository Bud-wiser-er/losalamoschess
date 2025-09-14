/**
 * Move Model
 * Represents a single move in the game
 */
class Move {
  constructor(data = {}) {
    this.from = data.from || null; // Position object
    this.to = data.to || null; // Position object
    this.piece = data.piece || null; // Piece that's moving
    this.isCapture = data.isCapture || false;
    this.isCheck = data.isCheck || false;
    this.isCheckmate = data.isCheckmate || false;
    this.timestamp = data.timestamp || new Date();
  }

  isValid() {
    // Basic validation - detailed validation in Rules Engine
    return this.from && this.to && this.piece;
  }

  toString() {
    // Convert to algebraic notation
    const files = 'abcdef';
    const fromFile = files[this.from.column];
    const toFile = files[this.to.column];
    const fromRank = 6 - this.from.row;
    const toRank = 6 - this.to.row;
    
    return `${fromFile}${fromRank}${this.isCapture ? 'x' : ''}${toFile}${toRank}`;
  }

  toUCI() {
    // Convert to UCI format
    const files = 'abcdef';
    return `${files[this.from.column]}${6 - this.from.row}${files[this.to.column]}${6 - this.to.row}`;
  }
}

module.exports = Move;