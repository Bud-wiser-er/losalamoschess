// Create the enhanced frontend chess manager
cat > frontend/chess-game-manager.js << 'EOF'
/**
 * Enhanced Chess Game Manager - Client Side
 * Works with the integrated server APIs
 */

class ChessGameManager {
    constructor() {
        this.boardSize = 6;
        this.selectedSquare = null;
        this.currentTurn = 'white';
        this.playerColor = 'white';
        this.gameStatus = 'active';
        this.legalMoves = [];
        
        // Starting position for Los Alamos Chess (6x6)
        this.currentPosition = [
            [{type: 'rook', color: 'black'}, {type: 'knight', color: 'black'}, {type: 'queen', color: 'black'}, {type: 'king', color: 'black'}, {type: 'knight', color: 'black'}, {type: 'rook', color: 'black'}],
            [{type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}],
            [null, null, null, null, null, null],
            [null, null, null, null, null, null],
            [{type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}],
            [{type: 'rook', color: 'white'}, {type: 'knight', color: 'white'}, {type: 'queen', color: 'white'}, {type: 'king', color: 'white'}, {type: 'knight', color: 'white'}, {type: 'rook', color: 'white'}]
        ];
        
        this.boardElement = null;
        this.statusElement = null;
    }

    async initialize() {
        console.log('🎮 Initializing enhanced chess game...');
        
        try {
            // Test server connection
            await this.testServerConnection();
            
            // Create board
            this.createBoard();
            this.updateBoardDisplay();
            this.setupEventHandlers();
            this.updateStatus();
            
            console.log('✅ Chess game initialized successfully!');
            this.showMessage('Chess game ready! Both colors can move.', 'success');