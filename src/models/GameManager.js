/**
 * GameManager Service Model
 * Manages active games and game lifecycle
 */
class GameManager {
  constructor() {
    this.activeGames = [];
  }

  createGame(users) {
    const game = new Game({
      players: users
    });
    this.activeGames.push(game);
    return game;
  }

  endGame(game) {
    game.endGame();
    this.activeGames = this.activeGames.filter(g => g.gameId !== game.gameId);
  }

  findGameById(gameId) {
    return this.activeGames.find(g => g.gameId === gameId);
  }

  getActiveGames() {
    return this.activeGames;
  }

  getGamesForUser(userId) {
    return this.activeGames.filter(g => 
      g.players.some(p => p.userId === userId)
    );
  }
}

module.exports = GameManager;