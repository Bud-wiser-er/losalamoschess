/**
 * Friend Model
 * Represents a friendship relationship
 */
class Friend {
  constructor(data = {}) {
    this.user = data.user || null; // User object
    this.friendStatus = data.friendStatus || false; // true = accepted, false = pending
    this.requestDate = data.requestDate || new Date();
    this.acceptDate = data.acceptDate || null;
  }

  sendRequest(user) {
    this.user = user;
    this.friendStatus = false;
    this.requestDate = new Date();
  }

  acceptRequest() {
    this.friendStatus = true;
    this.acceptDate = new Date();
  }

  removeFriend() {
    this.friendStatus = false;
    this.user = null;
  }

  getOtherUser() {
    return this.user;
  }
}

module.exports = Friend;