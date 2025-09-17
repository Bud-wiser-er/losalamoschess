// game.js - Enhanced game logic with frontend integration
import { showError, clearError, showSuccess, showInfo, updateBoard, highlightLegalMoves } from "./common/ui.js";
import { initializeWebSocket, makeMove, joinGame, leaveGame, offerDraw, resignGame, onMessage } from "./common/websocket.js";
import { game as gameAPI } from "./common/api.js";

/**
 * Game state management
 */
class GameManager {
    constructor() {
        this.gameId = null;
        this.gameState = null;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.isPlayerTurn = false;
        this.playerColor = null;
        this.boardElement = null;
        this.isFlipped = false;
        
        this.initializeEventHandlers();
    }

    /**
     * Initialize the game
     * @param {string} gameId - Game ID
     * @param {string} playerColor - Player's color ('white' or 'black')
     */
    async initGame(gameId = null, playerColor = 'white') {
        try {
            clearError();
            
            this.gameId = gameId;
            this.playerColor = playerColor;
            
            // Initialize WebSocket connection
            const token = localStorage.getItem("accessToken");
            if (token) {
                const connected = await initializeWebSocket(token);
                if (!connected) {
                    showError("Failed to connect to game server");
                    return false;
                }
                
                // Join game room if gameId provided
                if (this.gameId) {
                    joinGame(this.gameId);
                }
            } else {
                showError("No authentication token found. Please login.");
                return false;
            }
            
            // Initialize board
            this.initializeBoard();
            
            // Load game state
            if (this.gameId) {
                await this.loadGameState();
            } else {
                // Create new game
                await this.createNewGame();
            }
            
            showSuccess("Game initialized successfully!");
            return true;
            
        } catch (error) {
            console.error("Game initialization failed:", error);
            showError(`Failed to initialize game: ${error.message}`);
            return false;
        }
    }

    /**
     * Initialize event handlers
     */
    initializeEventHandlers() {
        // Listen for game state updates
        window.addEventListener('gameStateUpdate', (event) => {
            this.handleGameStateUpdate(event.detail);
        });
        
        // Listen for move updates
        window.addEventListener('moveUpdate', (event) => {
            this.handleMoveUpdate(event.detail);
        });
        
        // Listen for game end
        window.addEventListener('gameEnded', (event) => {
            this.handleGameEnd(event.detail);
        });
        
        // Listen for chat messages
        window.addEventListener('chatMessage', (event) => {
            this.handleChatMessage(event.detail);
        });
    }

    /**
     * Initialize the chess board
     */
    initializeBoard() {
        this.boardElement = document.getElementById('board');
        if (!this.boardElement) {
            console.error("Board element not found");
            return;
        }
        
        // Clear existing board
        this.boardElement.innerHTML = '';
        
        // Create board squares (6x6 for Los Alamos Chess)
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const square = document.createElement('div');
                square.className = `chess-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                square.dataset.square = this.getSquareNotation(row, col);
                
                // Add click handler
                square.addEventListener('click', (e) => this.handleSquareClick(e));
                
                // Add file and rank labels
                if (col === 0) {
                    const rankLabel = document.createElement('div');
                    rankLabel.className = 'rank-label';
                    rankLabel.textContent = 6 - row;
                    square.appendChild(rankLabel);
                }
                
                if (row === 5) {
                    const fileLabel = document.createElement('div');
                    fileLabel.className = 'file-label';
                    fileLabel.textContent = String.fromCharCode(97 + col); // a-f
                    square.appendChild(fileLabel);
                }
                
                this.boardElement.appendChild(square);
            }
        }
        
        console.log("Chess board initialized");
    }

    /**
     * Load game state from server
     */
    async loadGameState() {
        try {
            const gameData = await gameAPI.get(this.gameId);
            this.handleGameStateUpdate(gameData);
        } catch (error) {
            console.error("Failed to load game state:", error);
            showError("Failed to load game state");
        }
    }

    /**
     * Create a new game
     */
    async createNewGame() {
        try {
            const gameData = await gameAPI.create({
                type: 'los_alamos',
                playerColor: this.playerColor
            });
            
            this.gameId = gameData.gameId;
            this.handleGameStateUpdate(gameData);
            
            // Join the new game room
            joinGame(this.gameId);
            
        } catch (error) {
            console.error("Failed to create new game:", error);
            showError("Failed to create new game");
        }
    }

    /**
     * Handle game state updates
     * @param {Object} gameState - Updated game state
     */
    handleGameStateUpdate(gameState) {
        console.log("Game state updated:", gameState);
        
        this.gameState = gameState;
        this.isPlayerTurn = gameState.currentPlayer === this.playerColor;
        
        // Update board display
        updateBoard(gameState, this.boardElement);
        
        // Update game info
        this.updateGameInfo();
        
        // Clear selection if not player's turn
        if (!this.isPlayerTurn) {
            this.clearSelection();
        }
        
        // Show turn indicator
        if (this.isPlayerTurn) {
            showInfo("Your turn!");
        }
    }

    /**
     * Handle move updates
     * @param {Object} moveData - Move data
     */
    handleMoveUpdate(moveData) {
        console.log("Move update:", moveData);
        
        // Update move history display
        this.updateMoveHistory(moveData);
        
        // Play move sound (if available)
        this.playMoveSound();
        
        // Clear selection
        this.clearSelection();
    }

    /**
     * Handle game end
     * @param {Object} gameEndData - Game end data
     */
    handleGameEnd(gameEndData) {
        console.log("Game ended:", gameEndData);
        
        this.isPlayerTurn = false;
        this.clearSelection();
        
        // Show game result
        const result = gameEndData.result;
        let message = "Game ended";
        
        switch (result.type) {
            case 'checkmate':
                message = result.winner === this.playerColor ? "You won by checkmate!" : "You lost by checkmate.";
                break;
            case 'stalemate':
                message = "Game ended in stalemate (draw).";
                break;
            case 'draw':
                message = "Game ended in a draw.";
                break;
            case 'resignation':
                message = result.winner === this.playerColor ? "You won! Opponent resigned." : "You lost by resignation.";
                break;
            case 'timeout':
                message = result.winner === this.playerColor ? "You won on time!" : "You lost on time.";
                break;
        }
        
        setTimeout(() => {
            alert(message + "\n\nWould you like to play again?");
        }, 1000);
    }

    /**
     * Handle chat messages
     * @param {Object} chatData - Chat message data
     */
    handleChatMessage(chatData) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = 'chat-message';
            messageElement.innerHTML = `
                <div class="chat-author">${chatData.user.username}</div>
                <div class="chat-text">${chatData.message}</div>
            `;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    /**
     * Handle square click
     * @param {Event} event - Click event
     */
    handleSquareClick(event) {
        if (!this.isPlayerTurn) {
            showError("It's not your turn!");
            return;
        }
        
        const square = event.currentTarget;
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        
        if (this.selectedSquare) {
            // Try to make a move
            this.attemptMove(this.selectedSquare, { row, col });
        } else {
            // Select a piece
            this.selectSquare(row, col);
        }
    }

    /**
     * Select a square
     * @param {number} row - Row index
     * @param {number} col - Column index
     */
    selectSquare(row, col) {
        // Check if there's a piece of the player's color
        const piece = this.getPieceAt(row, col);
        if (!piece || piece.color !== this.playerColor) {
            showError("You can only move your own pieces!");
            return;
        }
        
        this.selectedSquare = { row, col };
        
        // Highlight selected square
        this.clearHighlights();
        const square = this.getSquareElement(row, col);
        square.classList.add('selected');
        
        // Get and highlight legal moves
        this.getLegalMoves(row, col);
        highlightLegalMoves(this.legalMoves, this.boardElement);
        
        console.log(`Selected square: ${this.getSquareNotation(row, col)}`);
    }

    /**
     * Attempt to make a move
     * @param {Object} from - Source square {row, col}
     * @param {Object} to - Destination square {row, col}
     */
    async attemptMove(from, to) {
        try {
            // Check if move is legal
            const isLegal = this.legalMoves.some(move => move.row === to.row && move.col === to.col);
            if (!isLegal) {
                showError("Illegal move!");
                this.clearSelection();
                return;
            }
            
            // Send move via WebSocket
            makeMove(this.gameId, {
                from: this.getSquareNotation(from.row, from.col),
                to: this.getSquareNotation(to.row, to.col),
                piece: this.getPieceAt(from.row, from.col)
            });
            
            console.log(`Move attempted: ${this.getSquareNotation(from.row, from.col)} -> ${this.getSquareNotation(to.row, to.col)}`);
            
        } catch (error) {
            console.error("Move failed:", error);
            showError("Failed to make move");
        }
        
        this.clearSelection();
    }

    /**
     * Get piece at position
     * @param {number} row - Row index
     * @param {number} col - Column index
     * @returns {Object|null} Piece object or null
     */
    getPieceAt(row, col) {
        if (!this.gameState || !this.gameState.board) return null;
        return this.gameState.board[row]?.[col] || null;
    }

    /**
     * Get legal moves for a piece
     * @param {number} row - Row index
     * @param {number} col - Column index
     */
    getLegalMoves(row, col) {
        // This should be calculated by the backend and sent via WebSocket
        // For now, we'll use a simplified version
        this.legalMoves = [];
        
        const piece = this.getPieceAt(row, col);
        if (!piece) return;
        
        // Basic move calculation (simplified for Los Alamos Chess)
        // In a real implementation, this would come from the server
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                if (r !== row || c !== col) {
                    // Check if move is potentially valid (basic check)
                    const targetPiece = this.getPieceAt(r, c);
                    if (!targetPiece || targetPiece.color !== piece.color) {
                        this.legalMoves.push({
                            row: r,
                            col: c,
                            isCapture: !!targetPiece
                        });
                    }
                }
            }
        }
    }

    /**
     * Clear selection and highlights
     */
    clearSelection() {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.clearHighlights();
    }

    /**
     * Clear board highlights
     */
    clearHighlights() {
        const squares = this.boardElement.querySelectorAll('.chess-square');
        squares.forEach(square => {
            square.classList.remove('selected', 'legal-move', 'capture-move');
        });
    }

    /**
     * Get square element
     * @param {number} row - Row index
     * @param {number} col - Column index
     * @returns {HTMLElement} Square element
     */
    getSquareElement(row, col) {
        return this.boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    }

    /**
     * Get square notation (e.g., "a1", "f6")
     * @param {number} row - Row index
     * @param {number} col - Column index
     * @returns {string} Square notation
     */
    getSquareNotation(row, col) {
        const file = String.fromCharCode(97 + col); // a-f
        const rank = 6 - row; // 6-1
        return `${file}${rank}`;
    }

    /**
     * Update game info display
     */
    updateGameInfo() {
        // Update turn indicator
        const gameStatus = document.querySelector('.game-status');
        if (gameStatus) {
            const status = this.isPlayerTurn ? 'Your turn' : "Opponent's turn";
            gameStatus.textContent = `● ${status}`;
        }
        
        // Update player info
        if (this.gameState.players) {
            this.updatePlayerInfo();
        }
    }

    /**
     * Update player information display
     */
    updatePlayerInfo() {
        const playerCard = document.getElementById('player-card');
        const opponentCard = document.getElementById('opponent-card');
        
        if (playerCard && this.gameState.players) {
            const player = this.gameState.players.find(p => p.color === this.playerColor);
            if (player) {
                const nameEl = playerCard.querySelector('.player-name');
                const ratingEl = playerCard.querySelector('.player-rating');
                const timerEl = playerCard.querySelector('.player-timer');
                
                if (nameEl) nameEl.textContent = player.username;
                if (ratingEl) ratingEl.textContent = `${player.rating} ELO`;
                if (timerEl && player.timeRemaining) {
                    timerEl.textContent = this.formatTime(player.timeRemaining);
                }
            }
        }
        
        if (opponentCard && this.gameState.players) {
            const opponent = this.gameState.players.find(p => p.color !== this.playerColor);
            if (opponent) {
                const nameEl = opponentCard.querySelector('.player-name');
                const ratingEl = opponentCard.querySelector('.player-rating');
                const timerEl = opponentCard.querySelector('.player-timer');
                
                if (nameEl) nameEl.textContent = opponent.username;
                if (ratingEl) ratingEl.textContent = `${opponent.rating} ELO`;
                if (timerEl && opponent.timeRemaining) {
                    timerEl.textContent = this.formatTime(opponent.timeRemaining);
                }
            }
        }
    }

    /**
     * Update move history display
     * @param {Object} moveData - Move data
     */
    updateMoveHistory(moveData) {
        const movesList = document.getElementById('moves-list');
        if (!movesList) return;
        
        // Add move to history
        const moveElement = document.createElement('div');
        moveElement.className = 'move-pair';
        moveElement.innerHTML = `
            <span class="move-number">${Math.ceil(moveData.moveNumber / 2)}.</span>
            <span class="move">${moveData.algebraic}</span>
        `;
        
        movesList.appendChild(moveElement);
        movesList.scrollTop = movesList.scrollHeight;
    }

    /**
     * Format time display
     * @param {number} timeInMs - Time in milliseconds
     * @returns {string} Formatted time
     */
    formatTime(timeInMs) {
        const minutes = Math.floor(timeInMs / 60000);
        const seconds = Math.floor((timeInMs % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Play move sound
     */
    playMoveSound() {
        // Simple audio feedback
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+7zwnElBSl+zPHZizcIF2W57OScTgwOUarm7blmGgU1k9n1unImBSF9yO/eizELElyx6OmgUxILRZ3p8sFzJAUme8rx2YY2Bhxqvu7mnE4MDlOq5ey7ZRsFM5HY9LtyJgUifc7w3ooyDBJcrdngUxQOQZ7u8wAA');
            audio.volume = 0.3;
            audio.play();
        } catch (error) {
            // Ignore audio errors
        }
    }

    /**
     * Flip the board
     */
    flipBoard() {
        this.isFlipped = !this.isFlipped;
        if (this.boardElement) {
            this.boardElement.style.transform = this.isFlipped ? 'rotate(180deg)' : 'rotate(0deg)';
            
            // Also flip individual squares to keep text readable
            const squares = this.boardElement.querySelectorAll('.chess-square');
            squares.forEach(square => {
                square.style.transform = this.isFlipped ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }
    }
}

// Global game manager instance
let gameManager = null;

/**
 * Initialize the game
 * @param {string} gameId - Game ID (optional)
 * @param {string} playerColor - Player color (optional)
 */
export async function initGame(gameId = null, playerColor = 'white') {
    if (!gameManager) {
        gameManager = new GameManager();
    }
    
    return await gameManager.initGame(gameId, playerColor);
}

/**
 * Go back to previous page
 */
export function goBack() {
    clearError();
    
    // Leave game room if in a game
    if (gameManager && gameManager.gameId) {
        leaveGame(gameManager.gameId);
    }
    
    // Navigate back
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = "tournament_setup.html";
    }
}

/**
 * Offer draw
 */
export function offerDraw() {
    if (!gameManager || !gameManager.gameId) {
        showError("No active game found");
        return;
    }
    
    if (confirm("Are you sure you want to offer a draw?")) {
        offerDraw(gameManager.gameId);
        showInfo("Draw offer sent to opponent");
    }
}

/**
 * Resign from current game
 */
export function resign() {
    if (!gameManager || !gameManager.gameId) {
        showError("No active game found");
        return;
    }
    
    if (confirm("Are you sure you want to resign? This will end the game.")) {
        resignGame(gameManager.gameId);
        showInfo("You have resigned from the game");
    }
}

/**
 * Start a new game
 */
export async function newGame() {
    if (confirm("Start a new game? This will leave the current game.")) {
        // Leave current game if active
        if (gameManager && gameManager.gameId) {
            leaveGame(gameManager.gameId);
        }
        
        // Create new game manager
        gameManager = new GameManager();
        
        // Initialize new game
        const success = await gameManager.initGame();
        if (success) {
            showSuccess("New game started!");
        }
    }
}

/**
 * Flip the chess board
 */
export function flipBoard() {
    if (gameManager) {
        gameManager.flipBoard();
    }
}

/**
 * Navigate move history
 */
export function firstMove() {
    // TODO: Implement move history navigation
    showInfo("Move history navigation coming soon!");
}

export function previousMove() {
    // TODO: Implement move history navigation
    showInfo("Move history navigation coming soon!");
}

export function nextMove() {
    // TODO: Implement move history navigation
    showInfo("Move history navigation coming soon!");
}

export function lastMove() {
    // TODO: Implement move history navigation
    showInfo("Move history navigation coming soon!");
}

/**
 * Select AI difficulty
 * @param {number} level - Difficulty level (0-3)
 */
export function selectDifficulty(level) {
    // Update UI
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    difficultyButtons.forEach((btn, index) => {
        btn.classList.toggle('selected', index === level);
    });
    
    // TODO: Send difficulty change to server
    const difficulties = ['Beginner', 'Easy', 'Medium', 'Hard'];
    showInfo(`AI difficulty set to ${difficulties[level]}`);
}

/**
 * Send chat message
 */
export function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput || !gameManager || !gameManager.gameId) return;
    
    const message = chatInput.value.trim();
    if (message) {
        sendChatMessage(gameManager.gameId, message);
        chatInput.value = '';
    }
}

/**
 * Auto-initialize game on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Extract game ID from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');
    const playerColor = urlParams.get('color') || 'white';
    
    // Initialize game
    if (document.getElementById('board')) {
        const success = await initGame(gameId, playerColor);
        if (!success) {
            // Redirect to login if not authenticated
            setTimeout(() => {
                window.location.href = 'login_page.html';
            }, 2000);
        }
    }
});

// Make functions globally available
window.goBack = goBack;
window.offerDraw = offerDraw;
window.resign = resign;
window.newGame = newGame;
window.flipBoard = flipBoard;
window.firstMove = firstMove;
window.previousMove = previousMove;
window.nextMove = nextMove;
window.lastMove = lastMove;
window.selectDifficulty = selectDifficulty;
window.sendChatMessage = sendChatMessage;

// Export game manager for advanced usage
export { gameManager };

// Default export
export default {
    initGame,
    goBack,
    offerDraw,
    resign,
    newGame,
    flipBoard,
    firstMove,
    previousMove,
    nextMove,
    lastMove,
    selectDifficulty,
    sendChatMessage,
    gameManager
};