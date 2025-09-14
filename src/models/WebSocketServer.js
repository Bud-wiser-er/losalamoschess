/**
 * WebSocketServer Model
 * Handles real-time communication
 */
class WebSocketServer {
  constructor() {
    this.connections = new Map();
    this.subscriptions = new Map();
  }

  broadcast(gameId, message) {
    // Broadcast message to all subscribers of a game
    const subscribers = this.subscriptions.get(gameId) || [];
    subscribers.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.send(JSON.stringify(message));
      }
    });
  }

  subscribe(connectionId, gameId) {
    // Subscribe connection to game updates
    if (!this.subscriptions.has(gameId)) {
      this.subscriptions.set(gameId, []);
    }
    this.subscriptions.get(gameId).push(connectionId);
  }

  handleMove(gameId, move) {
    // Handle incoming move and broadcast to subscribers
    this.broadcast(gameId, {
      type: 'MOVE',
      data: move
    });
  }

  handleConnection(connectionId, socket) {
    this.connections.set(connectionId, socket);
  }

  handleDisconnection(connectionId) {
    this.connections.delete(connectionId);
    // Remove from all subscriptions
    this.subscriptions.forEach((subscribers, gameId) => {
      const index = subscribers.indexOf(connectionId);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    });
  }
}

module.exports = WebSocketServer;