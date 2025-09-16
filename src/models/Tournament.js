/**
 * Tournament Model
 * Represents a chess tournament
 */
class Tournament {
  constructor(data = {}) {
    this.tournamentId = data.tournamentId || this.generateId();
    this.name = data.name || '';
    this.participants = data.participants || []; // Array of User objects
    this.games = data.games || []; // Array of Game objects
    this.startDate = data.startDate || null;
    this.endDate = data.endDate || null;
    this.status = data.status || 'REGISTRATION'; // REGISTRATION, IN_PROGRESS, COMPLETED
    this.format = data.format || 'SWISS'; // SWISS, KNOCKOUT, ROUND_ROBIN
  }

  generateId() {
    return `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startTournament() {
    if (this.participants.length < 2) {
      throw new Error('Tournament requires at least 2 participants');
    }
    this.status = 'IN_PROGRESS';
    this.startDate = new Date();
  }

  endTournament() {
    this.status = 'COMPLETED';
    this.endDate = new Date();
  }

  addParticipant(user) {
    if (this.status !== 'REGISTRATION') {
      throw new Error('Tournament registration is closed');
    }
    if (!this.participants.find(p => p.userId === user.userId)) {
      this.participants.push(user);
    }
  }

  removeParticipant(user) {
    if (this.status !== 'REGISTRATION') {
      throw new Error('Cannot remove participant after tournament starts');
    }
    this.participants = this.participants.filter(p => p.userId !== user.userId);
  }

  getWinner() {
    if (this.status !== 'COMPLETED') {
      return null;
    }
    // Tournament winner logic based on format
    return null;
  }

  generatePairings() {
    // Generate next round pairings based on tournament format
    // Implementation depends on tournament type
    return [];
  }
}

module.exports = Tournament;