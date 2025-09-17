// common/websocket.js
// WebSocket communication module for Los Alamos Chess

import { showError, showSuccess, showInfo } from './ui.js';

/**
 * WebSocket connection manager
 */
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.eventHandlers = new Map();
        this.messageQueue = [];
        this.heartbeatInterval = null;
        this.config = {
            url: process.env.NODE_ENV === 'production' 
                ? 'wss://your-production-api.com' 
                : 'ws://localhost:3000',
            reconnect: true,
            heartbeat: true,
            heartbeatInterval: 30000, // 30 seconds
        };
    }

    /**
     * Connect to WebSocket server
     * @param {string} token - Authentication token
     * @param {Object} options - Connection options
     * @returns {Promise<void>}
     */
    async connect(token, options = {}) {
        this.config = { ...this.config, ...options };
        
        return new Promise((resolve, reject) => {
            try {
                console.log('🔌 Connecting to WebSocket:', this.config.url);
                
                // Create WebSocket connection
                this.socket = new WebSocket(this.config.url);
                
                // Set up event listeners
                this.socket.onopen = (event) => {
                    console.log('✅ WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // Send authentication
                    this.send('authenticate', { token });
                    
                    // Process queued messages
                    this.processMessageQueue();
                    
                    // Start heartbeat if enabled
                    if (this.config.heartbeat) {
                        this.startHeartbeat();
                    }
                    
                    this.emit('connected', event);
                    resolve();
                };
                
                this.socket.onmessage = (event) => {
                    this.handleMessage(event);
                };
                
                this.socket.onclose = (event) => {
                    console.log('🔌 WebSocket disconnected:', event.code, event.reason);
                    this.isConnected = false;
                    this.stopHeartbeat();
                    this.emit('disconnected', event);
                    
                    // Attempt reconnection if enabled
                    if (this.config.reconnect && event.code !== 1000) {
                        this.attemptReconnection(token);
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                };
                
            } catch (error) {
                console.error('❌ WebSocket connection failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        this.config.reconnect = false; // Disable reconnection
        this.stopHeartbeat();
        
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        
        this.isConnected = false;
        console.log('🔌 WebSocket manually disconnected');
    }

    /**
     * Send message to server
     * @param {string} event - Event name
     * @param {Object} data - Message data
     */
    send(event, data = {}) {
        const message = {
            event,
            data,
            timestamp: Date.now(),
            id: this.generateMessageId()
        };
        
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            console.log('📤 WebSocket sent:', event, data);
        } else {
            // Queue message for later
            this.messageQueue.push(message);
            console.log('📋 WebSocket message queued:', event, data);
        }
    }

    /**
     * Subscribe to WebSocket events
     * @param {string} event - Event name
     * @param {function} handler - Event handler
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    /**
     * Unsubscribe from WebSocket events
     * @param {string} event - Event name
     * @param {function} handler - Event handler to remove
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to handlers
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }

    /**
     * Handle incoming WebSocket message
     * @param {MessageEvent} event - WebSocket message event
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('📥 WebSocket received:', message.event, message.data);
            
            // Handle system messages
            switch (message.event) {
                case 'authenticated':
                    showSuccess('Connected to game server');
                    break;
                    
                case 'authentication_error':
                    showError('Authentication failed');
                    this.disconnect();
                    break;
                    
                case 'pong':
                    // Heartbeat response
                    break;
                    
                case 'error':
                    showError(message.data.message || 'Server error');
                    break;
                    
                default:
                    // Emit custom events
                    this.emit(message.event, message.data);
                    break;
            }
            
        } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
        }
    }

    /**
     * Attempt to reconnect to WebSocket
     * @param {string} token - Authentication token
     */
    async attemptReconnection(token) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('❌ Max reconnection attempts reached');
            showError('Lost connection to game server');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        showInfo(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(async () => {
            try {
                await this.connect(token);
                showSuccess('Reconnected to game server');
            } catch (error) {
                console.error('❌ Reconnection failed:', error);
                this.attemptReconnection(token);
            }
        }, delay);
    }

    /**
     * Process queued messages
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.socket.send(JSON.stringify(message));
            console.log('📤 WebSocket sent queued:', message.event, message.data);
        }
    }

    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping');
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Generate unique message ID
     * @returns {string} Message ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get connection status
     * @returns {Object} Connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            readyState: this.socket ? this.socket.readyState : WebSocket.CLOSED,
            queuedMessages: this.messageQueue.length
        };
    }
}

// Global WebSocket manager instance
const wsManager = new WebSocketManager();

/**
 * Game-specific WebSocket handlers
 */

/**
 * Connect to WebSocket server
 * @param {string} token - Authentication token
 * @param {Object} options - Connection options
 * @returns {Promise<void>}
 */
export async function connectWebSocket(token, options = {}) {
    return wsManager.connect(token, options);
}

/**
 * Disconnect from WebSocket server
 */
export function disconnectWebSocket() {
    wsManager.disconnect();
}

/**
 * Send message to server
 * @param {string} event - Event name
 * @param {Object} data - Message data
 */
export function sendMessage(event, data = {}) {
    wsManager.send(event, data);
}

/**
 * Subscribe to WebSocket events
 * @param {string} event - Event name
 * @param {function} handler - Event handler
 */
export function onMessage(event, handler) {
    wsManager.on(event, handler);
}

/**
 * Unsubscribe from WebSocket events
 * @param {string} event - Event name
 * @param {function} handler - Event handler to remove
 */
export function offMessage(event, handler) {
    wsManager.off(event, handler);
}

/**
 * Get WebSocket connection status
 * @returns {Object} Connection status
 */
export function getConnectionStatus() {
    return wsManager.getStatus();
}

/**
 * Game-specific message handlers
 */

/**
 * Join a game room
 * @param {string} gameId - Game ID
 */
export function joinGame(gameId) {
    sendMessage('join-game', { gameId });
}

/**
 * Leave a game room
 * @param {string} gameId - Game ID
 */
export function leaveGame(gameId) {
    sendMessage('leave-game', { gameId });
}

/**
 * Make a move in the game
 * @param {string} gameId - Game ID
 * @param {Object} move - Move data (from, to, piece)
 */
export function makeMove(gameId, move) {
    sendMessage('move', { gameId, ...move });
}

/**
 * Send chat message
 * @param {string} gameId - Game ID
 * @param {string} message - Chat message
 */
export function sendChatMessage(gameId, message) {
    sendMessage('chat-message', { gameId, message });
}

/**
 * Offer draw
 * @param {string} gameId - Game ID
 */
export function offerDraw(gameId) {
    sendMessage('offer-draw', { gameId });
}

/**
 * Respond to draw offer
 * @param {string} gameId - Game ID
 * @param {boolean} accept - Accept or decline draw
 */
export function respondToDraw(gameId, accept) {
    sendMessage('draw-response', { gameId, accept });
}

/**
 * Resign from game
 * @param {string} gameId - Game ID
 */
export function resignGame(gameId) {
    sendMessage('resign', { gameId });
}

/**
 * Request rematch
 * @param {string} gameId - Game ID
 */
export function requestRematch(gameId) {
    sendMessage('rematch-request', { gameId });
}

/**
 * Respond to rematch request
 * @param {string} gameId - Game ID
 * @param {boolean} accept - Accept or decline rematch
 */
export function respondToRematch(gameId, accept) {
    sendMessage('rematch-response', { gameId, accept });
}

/**
 * Tournament-specific handlers
 */

/**
 * Join tournament
 * @param {string} tournamentId - Tournament ID
 */
export function joinTournament(tournamentId) {
    sendMessage('join-tournament', { tournamentId });
}

/**
 * Leave tournament
 * @param {string} tournamentId - Tournament ID
 */
export function leaveTournament(tournamentId) {
    sendMessage('leave-tournament', { tournamentId });
}

/**
 * Get tournament updates
 * @param {string} tournamentId - Tournament ID
 */
export function subscribeTournamentUpdates(tournamentId) {
    sendMessage('subscribe-tournament', { tournamentId });
}

/**
 * Unsubscribe from tournament updates
 * @param {string} tournamentId - Tournament ID
 */
export function unsubscribeTournamentUpdates(tournamentId) {
    sendMessage('unsubscribe-tournament', { tournamentId });
}

/**
 * Setup common game event handlers
 */
export function setupGameHandlers() {
    // Game state updates
    onMessage('game-state', (data) => {
        console.log('Game state updated:', data);
        // Update UI with new game state
        window.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: data }));
    });
    
    // Move updates
    onMessage('move', (data) => {
        console.log('Move received:', data);
        // Update board display
        window.dispatchEvent(new CustomEvent('moveUpdate', { detail: data }));
    });
    
    // Player joined/left
    onMessage('player-joined', (data) => {
        console.log('Player joined:', data.user.username);
        showInfo(`${data.user.username} joined the game`);
    });
    
    onMessage('player-left', (data) => {
        console.log('Player left:', data.user.username);
        showInfo(`${data.user.username} left the game`);
    });
    
    onMessage('player-disconnected', (data) => {
        console.log('Player disconnected:', data.user.username);
        showInfo(`${data.user.username} disconnected`);
    });
    
    onMessage('player-reconnected', (data) => {
        console.log('Player reconnected:', data.user.username);
        showInfo(`${data.user.username} reconnected`);
    });
    
    // Chat messages
    onMessage('chat-message', (data) => {
        console.log('Chat message:', data);
        window.dispatchEvent(new CustomEvent('chatMessage', { detail: data }));
    });
    
    // Game events
    onMessage('game-started', (data) => {
        console.log('Game started:', data);
        showSuccess('Game started!');
        window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
    });
    
    onMessage('game-ended', (data) => {
        console.log('Game ended:', data);
        const result = data.result;
        let message = 'Game ended';
        
        switch (result.type) {
            case 'checkmate':
                message = `Checkmate! ${result.winner} wins!`;
                break;
            case 'stalemate':
                message = 'Stalemate! Game is a draw.';
                break;
            case 'draw':
                message = 'Game ended in a draw.';
                break;
            case 'resignation':
                message = `${result.winner} wins by resignation!`;
                break;
            case 'timeout':
                message = `${result.winner} wins on time!`;
                break;
        }
        
        showInfo(message);
        window.dispatchEvent(new CustomEvent('gameEnded', { detail: data }));
    });
    
    // Draw offers
    onMessage('draw-offered', (data) => {
        console.log('Draw offered by:', data.by);
        if (confirm(`${data.by} offered a draw. Do you accept?`)) {
            respondToDraw(data.gameId, true);
        } else {
            respondToDraw(data.gameId, false);
        }
    });
    
    onMessage('draw-accepted', (data) => {
        console.log('Draw accepted');
        showSuccess('Draw accepted! Game is a draw.');
        window.dispatchEvent(new CustomEvent('gameEnded', { 
            detail: { result: { type: 'draw' } } 
        }));
    });
    
    onMessage('draw-declined', (data) => {
        console.log('Draw declined');
        showInfo('Draw offer declined.');
    });
    
    // Rematch requests
    onMessage('rematch-requested', (data) => {
        console.log('Rematch requested by:', data.by);
        if (confirm(`${data.by} wants a rematch. Do you accept?`)) {
            respondToRematch(data.gameId, true);
        } else {
            respondToRematch(data.gameId, false);
        }
    });
    
    onMessage('rematch-accepted', (data) => {
        console.log('Rematch accepted');
        showSuccess('Rematch accepted! Starting new game...');
        window.location.reload(); // Reload to start new game
    });
    
    onMessage('rematch-declined', (data) => {
        console.log('Rematch declined');
        showInfo('Rematch declined.');
    });
    
    // Tournament events
    onMessage('tournament-started', (data) => {
        console.log('Tournament started:', data);
        showSuccess(`Tournament "${data.name}" has started!`);
        window.dispatchEvent(new CustomEvent('tournamentStarted', { detail: data }));
    });
    
    onMessage('tournament-round-started', (data) => {
        console.log('Tournament round started:', data);
        showInfo(`Round ${data.round} has started!`);
        window.dispatchEvent(new CustomEvent('tournamentRoundStarted', { detail: data }));
    });
    
    onMessage('tournament-ended', (data) => {
        console.log('Tournament ended:', data);
        showSuccess(`Tournament ended! Winner: ${data.winner?.username || 'Unknown'}`);
        window.dispatchEvent(new CustomEvent('tournamentEnded', { detail: data }));
    });
    
    // Error handling
    onMessage('error', (data) => {
        console.error('WebSocket error:', data);
        showError(data.message || 'An error occurred');
    });
    
    // Rate limiting
    onMessage('rate-limited', (data) => {
        console.warn('Rate limited:', data);
        showError('You are sending messages too quickly. Please slow down.');
    });
}

/**
 * Setup tutorial-specific handlers
 */
export function setupTutorialHandlers() {
    onMessage('tutorial-step', (data) => {
        console.log('Tutorial step:', data);
        window.dispatchEvent(new CustomEvent('tutorialStep', { detail: data }));
    });
    
    onMessage('tutorial-completed', (data) => {
        console.log('Tutorial completed:', data);
        showSuccess('Tutorial completed! Well done!');
        window.dispatchEvent(new CustomEvent('tutorialCompleted', { detail: data }));
    });
    
    onMessage('tutorial-hint', (data) => {
        console.log('Tutorial hint:', data);
        showInfo(data.message);
        window.dispatchEvent(new CustomEvent('tutorialHint', { detail: data }));
    });
}

/**
 * Initialize WebSocket connection with automatic setup
 * @param {string} token - Authentication token
 * @param {Object} options - Connection options
 */
export async function initializeWebSocket(token, options = {}) {
    try {
        await connectWebSocket(token, options);
        
        // Setup default handlers
        setupGameHandlers();
        
        // Setup tutorial handlers if on tutorial page
        if (window.location.pathname.includes('tutorial')) {
            setupTutorialHandlers();
        }
        
        console.log('✅ WebSocket initialized successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to initialize WebSocket:', error);
        showError('Failed to connect to game server');
        return false;
    }
}

/**
 * Cleanup WebSocket connection
 */
export function cleanupWebSocket() {
    // Clear all event handlers
    wsManager.eventHandlers.clear();
    
    // Disconnect
    disconnectWebSocket();
    
    console.log('🧹 WebSocket cleaned up');
}

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
    cleanupWebSocket();
});

// Auto-initialize if token is available
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        // Small delay to ensure other modules are loaded
        setTimeout(() => {
            initializeWebSocket(token);
        }, 100);
    }
});

// Export WebSocket manager for advanced usage
export { wsManager };

// Default export
export default {
    connectWebSocket,
    disconnectWebSocket,
    sendMessage,
    onMessage,
    offMessage,
    getConnectionStatus,
    joinGame,
    leaveGame,
    makeMove,
    sendChatMessage,
    offerDraw,
    respondToDraw,
    resignGame,
    requestRematch,
    respondToRematch,
    joinTournament,
    leaveTournament,
    subscribeTournamentUpdates,
    unsubscribeTournamentUpdates,
    setupGameHandlers,
    setupTutorialHandlers,
    initializeWebSocket,
    cleanupWebSocket,
    wsManager
};