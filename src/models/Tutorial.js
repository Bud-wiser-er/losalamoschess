/**
 * Tutorial Model
 * Represents the interactive tutorial system
 */
class Tutorial {
  constructor(data = {}) {
    this.steps = data.steps || this.getDefaultSteps();
    this.progress = data.progress || 0;
    this.currentStep = 0;
    this.completed = false;
  }

  getDefaultSteps() {
    return [
      'Welcome to Los Alamos Chess',
      'Understanding the 6x6 board',
      'Piece movements - No bishops',
      'Special rules - No castling, no en passant',
      'How to win - Checkmate and stalemate',
      'Practice moves',
      'Your first game'
    ];
  }

  startTutorial() {
    this.currentStep = 0;
    this.progress = 0;
    this.completed = false;
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.updateProgress();
      return true;
    }
    return false;
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateProgress();
      return true;
    }
    return false;
  }

  updateProgress() {
    this.progress = ((this.currentStep + 1) / this.steps.length) * 100;
  }

  completeTutorial() {
    this.completed = true;
    this.progress = 100;
  }

  resetTutorial() {
    this.currentStep = 0;
    this.progress = 0;
    this.completed = false;
  }
}

module.exports = Tutorial;