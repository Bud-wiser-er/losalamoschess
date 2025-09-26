/**
 * CORRECTED FIXED GAME SCRIPT FOR LOS ALAMOS CHESS
 * 
 * Purpose: Complete game logic for 6x6 Los Alamos Chess implementation
 * Integrates: Database, Security, Game Engine, Frontend UI
 * 
 * Input: User interactions (clicks, moves, chat)
 * Output: Updated game state, board display, move history, timers
 * 
 * File Location: /frontend/fixed-game-script.js
 */

// Game state management
let gameState = {
    board: null,
    currentPlayer: 'white',
    gameId: null,
    playerColor: 'white',
    timeLeft: { white: 900000, black: 900000 }, // 15 minutes in milliseconds
    moveHistory: [],
    isGameActive: true,
    selectedSquare: null,
    legalMoves: []
};

// Timer management
let gameTimers = {
    whiteInterval: null,
    blackInterval: null,
    lastUpdate: Date.now()
};

// WebSocket connection
let gameSocket = null;

// Initial Los Alamos Chess position
const INITIAL_POSITION = {
    'a6': '♜', 'b6': '♞', 'c6': '♛', 'd6': '♚', 'e6': '♞', 'f6': '♜',
    'a5': '♟', 'b5': '♟', 'c5': '♟', 'd5': '♟', 'e5': '♟', 'f5': '♟',
    'a4': '', 'b4': '', 'c4': '', 'd4': '', 'e4': '', 'f4': '',
    'a3': '', 'b3': '', 'c3': '', 'd3': '', 'e3': '', 'f3': '',
    'a2': '♙', 'b2': '♙', 'c2': '♙', 'd2': '♙', 'e2': '♙', 'f2': '♙',
    'a1': '♖', 'b1': '♘', 'c1': '♕', 'd1': '♔', 'e1': '♘', 'f1': '♖'
};

/**
 * Initialize the chess game
 * Called when page loads
 */
function initializeGame() {
    console.log('🎮 Initializing Los Alamos Chess Game...');
    
    // Setup board
    createChessBoard();
    setupInitialPosition();
    
    // Setup UI components
    setupEventListeners();
    initializeTimers();
    loadPlayerInfo();
    
    // Initialize WebSocket connection
    initializeWebSocket();
    
    console.log('✅ Game initialization complete');
}

/**
 * Create the 6x6 chess board HTML structure
 */
function createChessBoard() {
    const boardElement = document.getElementById('board');
    if (!boardElement) return;
    
    boardElement.innerHTML = '';
    
    // Create board squares
    for (let rank = 6; rank >= 1; rank--) {
        for (let file = 0; file < 6; file++) {
            const fileChar = String.fromCharCode(97 + file); // a-f
            const squareId = fileChar + rank;
            
            const square = document.createElement('div');
            square.className = 'square';
            square.id = squareId;
            square.dataset.square = squareId;
            
            // Alternate colors
            if ((file + rank) % 2 === 0) {
                square.classList.add('dark');
            } else {
                square.classList.add('light');
            }
            
            // Add coordinate labels
            if (file === 5) {
                const rankLabel = document.createElement('span');
                rankLabel.className = 'rank-label';
                rankLabel.textContent = rank;
                square.appendChild(rankLabel);
            }
            
            if (rank === 1) {
                const fileLabel = document.createElement('span');
                fileLabel.className = 'file-label';
                fileLabel.textContent = fileChar;
                square.appendChild(fileLabel);
            }
            
            // Add click handler
            square.addEventListener('click', () => handleSquareClick(squareId));
            
            boardElement.appendChild(square);
        }
    }
}

/**
 * Setup initial piece positions
 */
function setupInitialPosition() {
    Object.entries(INITIAL_POSITION).forEach(([square, piece]) => {
        const squareElement = document.getElementById(square);
        if (squareElement && piece) {
            const pieceElement = document.createElement('span');
            pieceElement.className = 'piece';
            pieceElement.textContent = piece;
            pieceElement.draggable = true;
            squareElement.appendChild(pieceElement);
        }
    });
    
    gameState.board = { ...INITIAL_POSITION };
}

/**
 * Handle square click events
 * @param {string} squareId - Square identifier (e.g., 'e4')
 */
function handleSquareClick(squareId) {
    if (!gameState.isGameActive) return;
    
    const square = document.getElementById(squareId);
    const piece = square.querySelector('.piece');
    
    // If a square is already selected
    if (gameState.selectedSquare) {
        // If clicking the same square, deselect
        if (gameState.selectedSquare === squareId) {
            clearSelection();
            return;
        }
        
        // If clicking a valid move destination
        if (gameState.legalMoves.includes(squareId)) {
            makeMove(gameState.selectedSquare, squareId);
            return;
        }
        
        // Clear selection and potentially select new piece
        clearSelection();
    }
    
    // Select piece if it belongs to current player
    if (piece && canSelectPiece(piece.textContent)) {
        selectSquare(squareId);
    }
}

/**
 * Check if piece can be selected by current player
 * @param {string} pieceSymbol - Unicode chess piece symbol
 * @returns {boolean} Whether piece can be selected
 */
function canSelectPiece(pieceSymbol) {
    const whitePieces = ['♔', '♕', '♖', '♘', '♙'];
    const blackPieces = ['♚', '♛', '♜', '♞', '♟'];
    
    if (gameState.currentPlayer === 'white' && gameState.playerColor === 'white') {
        return whitePieces.includes(pieceSymbol);
    } else if (gameState.currentPlayer === 'black' && gameState.playerColor === 'black') {
        return blackPieces.includes(pieceSymbol);
    }
    return false;
}

/**
 * Select a square and show legal moves
 * @param {string} squareId - Square to select
 */
function selectSquare(squareId) {
    clearSelection();
    
    gameState.selectedSquare = squareId;
    const square = document.getElementById(squareId);
    square.classList.add('selected');
    
    // Get legal moves using Byron's engine
    calculateLegalMoves(squareId);
}

function calculateLegalMoves(squareId) {
    gameState.legalMoves = [];
    
    console.log('Requesting legal moves for:', squareId); // Debug
    
    if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
        const message = {
            type: 'get_legal_moves',
            gameId: gameState.gameId,
            square: squareId,
            currentFen: generateCurrentFEN()
        };
        
        console.log('Sending WebSocket message:', message); // Debug
        gameSocket.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket not available - using fallback move calculation');
        calculateBasicLegalMoves(squareId);
        highlightLegalMoves();
    }
}

/**
 * Fallback: Basic legal move calculation
 * @param {string} squareId - Selected square
 */
function calculateBasicLegalMoves(squareId) {
    const piece = gameState.board[squareId];
    if (!piece) return;
    
    const file = squareId.charCodeAt(0) - 97; // 0-5
    const rank = parseInt(squareId[1]); // 1-6
    
    // Basic move patterns for different pieces
    const directions = getBasicMoveDirections(piece);
    
    for (const [dx, dy] of directions) {
        let newFile = file + dx;
        let newRank = rank + dy;
        
        if (newFile >= 0 && newFile < 6 && newRank >= 1 && newRank <= 6) {
            const newSquare = String.fromCharCode(97 + newFile) + newRank;
            const targetPiece = gameState.board[newSquare];
            
            if (!targetPiece || !isSameColor(piece, targetPiece)) {
                gameState.legalMoves.push(newSquare);
            }
        }
    }
}

/**
 * Generate current FEN from board state
 */
function generateCurrentFEN() {
    let fen = '';
    for (let rank = 6; rank >= 1; rank--) {
        let rankStr = '';
        let emptyCount = 0;
        
        for (let file = 0; file < 6; file++) {
            const square = String.fromCharCode(97 + file) + rank;
            const piece = gameState.board[square];
            
            if (piece) {
                if (emptyCount > 0) {
                    rankStr += emptyCount;
                    emptyCount = 0;
                }
                const fenPiece = unicodeToFEN(piece);
                rankStr += fenPiece;
            } else {
                emptyCount++;
            }
        }
        
        if (emptyCount > 0) {
            rankStr += emptyCount;
        }
        
        fen += rankStr;
        if (rank > 1) fen += '/';
    }
    
    fen += ` ${gameState.currentPlayer === 'white' ? 'w' : 'b'} - - 0 ${Math.floor(gameState.moveHistory.length / 2) + 1}`;
    return fen;
}

/**
 * Convert Unicode piece symbols to FEN notation
 */
function unicodeToFEN(unicode) {
    const mapping = {
        '♔': 'K', '♕': 'Q', '♖': 'R', '♘': 'N', '♙': 'P',
        '♚': 'k', '♛': 'q', '♜': 'r', '♞': 'n', '♟': 'p'
    };
    return mapping[unicode] || '';
}

/**
 * Get basic move directions for piece type
 * @param {string} piece - Piece symbol
 * @returns {Array} Array of [dx, dy] direction vectors
 */
function getBasicMoveDirections(piece) {
    const whitePawns = ['♙'];
    const blackPawns = ['♟'];
    const rooks = ['♖', '♜'];
    const knights = ['♘', '♞'];
    const queens = ['♕', '♛'];
    const kings = ['♔', '♚'];
    
    if (whitePawns.includes(piece)) {
        return [[0, 1]]; // Only forward for pawns (captures handled separately)
    } else if (blackPawns.includes(piece)) {
        return [[0, -1]]; // Only forward for pawns
    } else if (rooks.includes(piece)) {
        return [[0, 1], [0, -1], [1, 0], [-1, 0]];
    } else if (knights.includes(piece)) {
        return [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
    } else if (queens.includes(piece)) {
        return [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    } else if (kings.includes(piece)) {
        return [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    }
    return [];
}

/**
 * Check if two pieces are the same color
 * @param {string} piece1 - First piece symbol
 * @param {string} piece2 - Second piece symbol
 * @returns {boolean} Whether pieces are same color
 */
function isSameColor(piece1, piece2) {
    const whitePieces = ['♔', '♕', '♖', '♘', '♙'];
    const piece1IsWhite = whitePieces.includes(piece1);
    const piece2IsWhite = whitePieces.includes(piece2);
    return piece1IsWhite === piece2IsWhite;
}

/**
 * Highlight legal move squares
 */
function highlightLegalMoves() {
    console.log('Highlighting moves:', gameState.legalMoves); // Debug
    
    gameState.legalMoves.forEach(move => {
        let targetSquare;
        
        // Handle different move formats
        if (move.length === 4) {
            // UCI format like "c2c3" - extract destination
            targetSquare = move.substring(2, 4);
        } else if (move.length === 2) {
            // Already just the destination square like "c3"
            targetSquare = move;
        } else {
            console.warn('Unknown move format:', move);
            return;
        }
        
        console.log('Looking for square:', targetSquare); // Debug
        
        const square = document.getElementById(targetSquare);
        if (square) {
            const targetPiece = gameState.board[targetSquare];
            
            if (targetPiece) {
                square.classList.add('capture-move');
                console.log('Added capture highlight to:', targetSquare);
            } else {
                square.classList.add('valid-move');
                console.log('Added move highlight to:', targetSquare);
            }
        } else {
            console.error('Square not found:', targetSquare);
        }
    });
}

/**
 * Clear all selections and highlights
 */
function clearSelection() {
    gameState.selectedSquare = null;
    gameState.legalMoves = [];
    
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('selected', 'valid-move', 'capture-move');
    });
}

/**
 * Make a move from source to destination
 * @param {string} from - Source square
 * @param {string} to - Destination square
 */
function makeMove(from, to) {
    const fromSquare = document.getElementById(from);
    const toSquare = document.getElementById(to);
    const piece = fromSquare.querySelector('.piece');
    
    if (!piece) return;
    
    // Remove piece from source
    fromSquare.removeChild(piece);
    
    // Remove captured piece if present
    const capturedPiece = toSquare.querySelector('.piece');
    if (capturedPiece) {
        toSquare.removeChild(capturedPiece);
    }
    
    // Place piece at destination
    toSquare.appendChild(piece);
    
    // Update game state
    gameState.board[to] = gameState.board[from];
    gameState.board[from] = '';
    
    // Update visual feedback
    updateLastMoveHighlight(from, to);
    
    // Add to move history
    addMoveToHistory(from, to, gameState.board[to], !!capturedPiece);
    
    // Clear selection
    clearSelection();
    
    // Switch turns
    switchTurn();
    
    // Send move to server
    sendMoveToServer(from, to);
    
    // If it's AI's turn, trigger AI move
    if (gameState.currentPlayer !== gameState.playerColor) {
        setTimeout(() => triggerAIMove(), 1000);
    }
}

/**
 * Update last move highlight
 * @param {string} from - Source square
 * @param {string} to - Destination square
 */
function updateLastMoveHighlight(from, to) {
    document.querySelectorAll('.last-move').forEach(square => {
        square.classList.remove('last-move');
    });
    
    document.getElementById(from).classList.add('last-move');
    document.getElementById(to).classList.add('last-move');
}

/**
 * Add move to history display
 * @param {string} from - Source square
 * @param {string} to - Destination square
 * @param {string} piece - Piece symbol
 * @param {boolean} isCapture - Whether move was a capture
 */
function addMoveToHistory(from, to, piece, isCapture) {
    const movesList = document.getElementById('moves-list');
    
    // Remove "No moves yet" message
    const noMoves = movesList.querySelector('.no-moves');
    if (noMoves) {
        noMoves.remove();
    }
    
    const moveNumber = Math.floor(gameState.moveHistory.length / 2) + 1;
    const isWhiteMove = gameState.moveHistory.length % 2 === 0;
    
    let moveNotation = `${from}-${to}`;
    if (isCapture) moveNotation += 'x';
    
    // Add to game state
    gameState.moveHistory.push({
        from,
        to,
        piece,
        isCapture,
        notation: moveNotation,
        timestamp: Date.now()
    });
    
    // Update UI
    if (isWhiteMove) {
        const movePair = document.createElement('div');
        movePair.className = 'move-pair';
        movePair.innerHTML = `
            <span class="move-number">${moveNumber}.</span>
            <span class="move">${moveNotation}</span>
            <span class="move">...</span>
        `;
        movesList.appendChild(movePair);
    } else {
        const lastPair = movesList.lastElementChild;
        const blackMove = lastPair.querySelector('.move:last-child');
        blackMove.textContent = moveNotation;
    }
    
    movesList.scrollTop = movesList.scrollHeight;
    updateMoveCount();
}

/**
 * Switch turns between players
 */
function switchTurn() {
    gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
    
    const playerCard = document.getElementById('player-card');
    const opponentCard = document.getElementById('opponent-card');
    
    if ((gameState.currentPlayer === 'white' && gameState.playerColor === 'white') ||
        (gameState.currentPlayer === 'black' && gameState.playerColor === 'black')) {
        playerCard.classList.add('active');
        opponentCard.classList.remove('active');
    } else {
        opponentCard.classList.add('active');
        playerCard.classList.remove('active');
    }
    
    const currentTurnElement = document.getElementById('current-turn');
    if (currentTurnElement) {
        currentTurnElement.textContent = gameState.currentPlayer.charAt(0).toUpperCase() + gameState.currentPlayer.slice(1);
    }
    
    switchTimers();
}

/**
 * Initialize and manage game timers
 */
function initializeTimers() {
    updateTimerDisplay('white', gameState.timeLeft.white);
    updateTimerDisplay('black', gameState.timeLeft.black);
    startTimer(gameState.currentPlayer);
}

/**
 * Start timer for specified color
 * @param {string} color - 'white' or 'black'
 */
function startTimer(color) {
    clearInterval(gameTimers.whiteInterval);
    clearInterval(gameTimers.blackInterval);
    
    gameTimers.lastUpdate = Date.now();
    
    const timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - gameTimers.lastUpdate;
        gameTimers.lastUpdate = now;
        
        gameState.timeLeft[color] -= elapsed;
        
        if (gameState.timeLeft[color] <= 0) {
            gameState.timeLeft[color] = 0;
            clearInterval(timerInterval);
            handleTimeOut(color);
        }
        
        updateTimerDisplay(color, gameState.timeLeft[color]);
    }, 100);
    
    if (color === 'white') {
        gameTimers.whiteInterval = timerInterval;
    } else {
        gameTimers.blackInterval = timerInterval;
    }
}

/**
 * Switch active timer
 */
function switchTimers() {
    startTimer(gameState.currentPlayer);
}

/**
 * Update timer display
 * @param {string} color - 'white' or 'black'
 * @param {number} timeInMs - Time in milliseconds
 */
function updateTimerDisplay(color, timeInMs) {
    const minutes = Math.floor(timeInMs / 60000);
    const seconds = Math.floor((timeInMs % 60000) / 1000);
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const timerId = color === 'white' ? 'white-timer' : 'black-timer';
    const timerElement = document.getElementById(timerId);
    
    if (timerElement) {
        timerElement.textContent = formattedTime;
        
        timerElement.classList.remove('warning', 'critical');
        if (timeInMs <= 30000) {
            timerElement.classList.add('critical');
        } else if (timeInMs <= 60000) {
            timerElement.classList.add('warning');
        }
    }
}

/**
 * Handle timer timeout
 * @param {string} color - Color that ran out of time
 */
function handleTimeOut(color) {
    gameState.isGameActive = false;
    const winner = color === 'white' ? 'black' : 'white';
    
    alert(`Time's up! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by timeout.`);
    
    const gameStatusElement = document.getElementById('game-status');
    if (gameStatusElement) {
        gameStatusElement.textContent = `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins - Timeout`;
    }
}

/**
 * Update move count display
 */
function updateMoveCount() {
    const moveCountElement = document.getElementById('move-count');
    if (moveCountElement) {
        moveCountElement.textContent = gameState.moveHistory.length;
    }
}

/**
 * Load player information from localStorage or API
 */
function loadPlayerInfo() {
    const username = localStorage.getItem('username') || 'Player';
    const rating = localStorage.getItem('rating') || '1200';
    
    const playerNameElement = document.querySelector('#player-card .player-name');
    const playerRatingElement = document.querySelector('#player-card .player-rating');
    const playerAvatarElement = document.querySelector('#player-card .player-avatar');
    
    if (playerNameElement) playerNameElement.textContent = username;
    if (playerRatingElement) playerRatingElement.textContent = `${rating} ELO`;
    if (playerAvatarElement) playerAvatarElement.textContent = username.charAt(0).toUpperCase();
    
    console.log(`Player loaded: ${username} (${rating} ELO)`);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.querySelector('.chat-send');
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
    
    if (chatSend) {
        chatSend.addEventListener('click', sendChatMessage);
    }
}

/**
 * Send chat message
 */
function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    
    if (!chatInput || !chatMessages) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.innerHTML = `
        <div class="chat-author">You</div>
        <div class="chat-text">${escapeHtml(message)}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.value = '';
    
    if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
        gameSocket.send(JSON.stringify({
            type: 'chat',
            text: message,
            gameId: gameState.gameId
        }));
    }
}

/**
 * Escape HTML characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Initialize WebSocket connection
 */
function initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
        gameSocket = new WebSocket(wsUrl);
        
        gameSocket.onopen = () => {
            console.log('WebSocket connected');
            gameSocket.send(JSON.stringify({
                type: 'join_game',
                gameId: gameState.gameId || 'demo_game'
            }));
        };
        
        gameSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
        
        gameSocket.onclose = () => {
            console.log('WebSocket disconnected');
            setTimeout(initializeWebSocket, 3000);
        };
        
        gameSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
    }
}

/**
 * Handle WebSocket messages
 * @param {Object} data - Message data
 */
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'legal_moves':
            handleLegalMovesResponse(data);
            break;
        case 'move':
            handleOpponentMove(data.move);
            break;
        case 'chat':
            handleChatMessage(data.message);
            break;
        case 'connected':
            console.log('Connected to game server');
            break;
        case 'error':
            console.error('Server error:', data.message);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

/**
 * Handle legal moves response from server
 * @param {Object} data - Legal moves data
 */
function handleLegalMovesResponse(data) {
    console.log('Received legal moves:', data.moves); // Debug log
    gameState.legalMoves = data.moves || [];
    highlightLegalMoves();
    console.log(`Highlighting ${gameState.legalMoves.length} legal moves for ${data.square}`);
}

/**
 * Handle opponent move
 * @param {Object} move - Move data
 */
function handleOpponentMove(move) {
    if (!move || !move.from || !move.to) return;
    
    const fromSquare = document.getElementById(move.from);
    const toSquare = document.getElementById(move.to);
    const piece = fromSquare.querySelector('.piece');
    
    if (piece) {
        fromSquare.removeChild(piece);
        
        const capturedPiece = toSquare.querySelector('.piece');
        if (capturedPiece) {
            toSquare.removeChild(capturedPiece);
        }
        
        toSquare.appendChild(piece);
        
        gameState.board[move.to] = gameState.board[move.from];
        gameState.board[move.from] = '';
        
        updateLastMoveHighlight(move.from, move.to);
        addMoveToHistory(move.from, move.to, gameState.board[move.to], !!capturedPiece);
        switchTurn();
    }
}

/**
 * Handle chat message from server
 * @param {Object} message - Chat message data
 */
function handleChatMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.innerHTML = `
        <div class="chat-author">${escapeHtml(message.author)}</div>
        <div class="chat-text">${escapeHtml(message.text)}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Send move to server
 * @param {string} from - Source square
 * @param {string} to - Destination square
 */
function sendMoveToServer(from, to) {
    if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
        gameSocket.send(JSON.stringify({
            type: 'move',
            gameId: gameState.gameId,
            move: { from, to },
            timestamp: Date.now()
        }));
    }
}

/**
 * Trigger AI move (simplified)
 */
function triggerAIMove() {
    if (gameState.currentPlayer === gameState.playerColor) return;
    
    const aiMoves = getAllLegalMovesForColor(gameState.currentPlayer);
    
    if (aiMoves.length > 0) {
        const randomMove = aiMoves[Math.floor(Math.random() * aiMoves.length)];
        setTimeout(() => {
            makeMove(randomMove.from, randomMove.to);
        }, 500);
    }
}

/**
 * Get all legal moves for a color (simplified)
 * @param {string} color - 'white' or 'black'
 * @returns {Array} Array of move objects
 */
function getAllLegalMovesForColor(color) {
    const moves = [];
    const pieces = color === 'white' ? ['♔', '♕', '♖', '♘', '♙'] : ['♚', '♛', '♜', '♞', '♟'];
    
    for (const [square, piece] of Object.entries(gameState.board)) {
        if (pieces.includes(piece)) {
            const oldSelected = gameState.selectedSquare;
            const oldLegalMoves = [...gameState.legalMoves];
            
            calculateBasicLegalMoves(square);
            
            for (const to of gameState.legalMoves) {
                moves.push({ from: square, to });
            }
            
            gameState.selectedSquare = oldSelected;
            gameState.legalMoves = oldLegalMoves;
        }
    }
    
    return moves;
}

// Global functions for HTML onclick handlers
window.goBack = function() {
    if (confirm('Are you sure you want to leave the game?')) {
        window.location.href = 'dashboard_page.html';
    }
};

window.offerDraw = function() {
    if (confirm('Are you sure you want to offer a draw?')) {
        alert('Draw offer sent to opponent');
    }
};

window.resign = function() {
    if (confirm('Are you sure you want to resign?')) {
        gameState.isGameActive = false;
        alert('You have resigned. Game over.');
        
        const gameStatusElement = document.getElementById('game-status');
        if (gameStatusElement) {
            gameStatusElement.textContent = 'Game ended - Resigned';
        }
    }
};

window.newGame = function() {
    if (confirm('Start a new game?')) {
        gameState.board = { ...INITIAL_POSITION };
        gameState.currentPlayer = 'white';
        gameState.timeLeft = { white: 900000, black: 900000 };
        gameState.moveHistory = [];
        gameState.isGameActive = true;
        
        setupInitialPosition();
        clearSelection();
        
        const movesList = document.getElementById('moves-list');
        movesList.innerHTML = '<div class="no-moves"><span>No moves yet</span></div>';
        
        initializeTimers();
        updateMoveCount();
        
        const currentTurnElement = document.getElementById('current-turn');
        if (currentTurnElement) {
            currentTurnElement.textContent = 'White';
        }
        
        const gameStatusElement = document.getElementById('game-status');
        if (gameStatusElement) {
            gameStatusElement.textContent = 'Active';
        }
        
        console.log('New game started');
    }
};

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeGame);