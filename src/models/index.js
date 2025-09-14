/**
 * Main export file for all models
 */

module.exports = {
  // Core Models
  User: require('./User'),
  Game: require('./Game'),
  Board: require('./Board'),
  Move: require('./Move'),
  Position: require('./Position'),
  Tournament: require('./Tournament'),
  Friend: require('./Friend'),
  AIBot: require('./AIBot'),
  Tutorial: require('./Tutorial'),
  Opponent: require('./Opponent'),
  
  // Service Models
  GameManager: require('./GameManager'),
  DatabaseService: require('./DatabaseService'),
  AuthenticationService: require('./AuthenticationService'),
  RulesEngine: require('./RulesEngine'),
  WebSocketServer: require('./WebSocketServer')
};