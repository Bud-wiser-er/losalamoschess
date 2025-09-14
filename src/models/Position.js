/**
 * Position Model
 * Represents a position on the board
 */
class Position {
  constructor(row, column) {
    this.row = row;
    this.column = column;
  }

  toString() {
    const files = 'abcdef';
    const rank = 6 - this.row;
    return `${files[this.column]}${rank}`;
  }

  equals(other) {
    return other && this.row === other.row && this.column === other.column;
  }

  getDistance(pos) {
    return Math.max(
      Math.abs(this.row - pos.row),
      Math.abs(this.column - pos.column)
    );
  }

  static fromString(notation) {
    // Parse algebraic notation (e.g., "a1", "f6")
    const files = 'abcdef';
    const file = notation[0];
    const rank = parseInt(notation[1]);
    
    const column = files.indexOf(file);
    const row = 6 - rank;
    
    if (column === -1 || row < 0 || row >= 6) {
      throw new Error(`Invalid position notation: ${notation}`);
    }
    
    return new Position(row, column);
  }
}

module.exports = Position;