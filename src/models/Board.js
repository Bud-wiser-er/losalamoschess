/**
 * Board Model
 * Represents the 6x6 Los Alamos chess board
 */
class Board {
  constructor(fen = null) {
    this.squares = Array(6).fill(null).map(() => Array(6).fill(null));
    this.capturedPieces = [];
    
    if (fen) {
      this.loadFromFEN(fen);
    } else {
      this.initializeBoard();
    }
  }

  initializeBoard() {
    // Initialize Los Alamos starting position
    // Black pieces
    this.squares[0] = [
      { type: 'rook', color: 'black' },
      { type: 'knight', color: 'black' },
      { type: 'queen', color: 'black' },
      { type: 'king', color: 'black' },
      { type: 'knight', color: 'black' },
      { type: 'rook', color: 'black' }
    ];
    
    // Black pawns
    this.squares[1] = Array(6).fill({ type: 'pawn', color: 'black' });
    
    // Empty squares
    this.squares[2] = Array(6).fill(null);
    this.squares[3] = Array(6).fill(null);
    
    // White pawns
    this.squares[4] = Array(6).fill({ type: 'pawn', color: 'white' });
    
    // White pieces
    this.squares[5] = [
      { type: 'rook', color: 'white' },
      { type: 'knight', color: 'white' },
      { type: 'queen', color: 'white' },
      { type: 'king', color: 'white' },
      { type: 'knight', color: 'white' },
      { type: 'rook', color: 'white' }
    ];
  }

  loadFromFEN(fen) {
    // Parse FEN string and set up board
    // Implementation details for Los Alamos FEN parsing
  }

  getPieceAt(position) {
    if (!this.isValidPosition(position)) {
      return null;
    }
    return this.squares[position.row][position.column];
  }

  movePiece(move) {
    const piece = this.getPieceAt(move.from);
    if (!piece) return false;
    
    const targetPiece = this.getPieceAt(move.to);
    if (targetPiece) {
      this.capturedPieces.push(targetPiece);
    }
    
    this.squares[move.to.row][move.to.column] = piece;
    this.squares[move.from.row][move.from.column] = null;
    
    return true;
  }

  isValidPosition(position) {
    return position.row >= 0 && position.row < 6 && 
           position.column >= 0 && position.column < 6;
  }

  isCheckmate(color) {
    // Check for checkmate condition
    // Will be implemented with Rules Engine
    return false;
  }

  isStalemate(color) {
    // Check for stalemate condition
    // Will be implemented with Rules Engine
    return false;
  }

  toFEN() {
    // Convert current board state to FEN string
    // Implementation for Los Alamos FEN generation
    return '';
  }
}

module.exports = Board;