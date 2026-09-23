class TimerManager {
  constructor(io, auctions) {
    this.io = io;
    this.auctions = auctions;
    this.intervals = {};
  }

  startTimer(auctionId) {
    if (this.intervals[auctionId]) {
      clearInterval(this.intervals[auctionId]);
    }

    this.intervals[auctionId] = setInterval(() => {
      const auction = this.auctions[auctionId];
      
      if (!auction || auction.status !== 'active') {
        this.stopTimer(auctionId);
        return;
      }

      auction.timeRemainingSeconds = Math.max(0, auction.timeRemainingSeconds - 1);
      
      this.io.to(auctionId).emit('auction:time_tick', {
        auctionId,
        timeRemaining: auction.timeRemainingSeconds
      });

      if (auction.timeRemainingSeconds <= 0) {
        this.endAuction(auctionId);
      }
    }, 1000);
  }

  stopTimer(auctionId) {
    if (this.intervals[auctionId]) {
      clearInterval(this.intervals[auctionId]);
      delete this.intervals[auctionId];
    }
  }

  endAuction(auctionId) {
    this.stopTimer(auctionId);
    
    const auction = this.auctions[auctionId];
    if (!auction) return;

    auction.status = 'ended';
    
    let resultData = {
      auctionId,
      finalPrice: auction.currentBid,
      status: 'ended',
      bidHistory: auction.bidHistory
    };

    if (auction.highestBidder && auction.currentBid >= auction.startingPrice) {
      resultData.winner = auction.highestBidder.username;
      resultData.status = 'sold';
    } else {
      resultData.status = 'passed';
    }

    this.io.to(auctionId).emit('auction:sold', resultData);
  }

  extendTimer(auctionId, additionalSeconds) {
    const auction = this.auctions[auctionId];
    if (!auction) return;

    auction.timeRemainingSeconds = additionalSeconds;
  }

  startAllActiveAuctions() {
    Object.keys(this.auctions).forEach(auctionId => {
      const auction = this.auctions[auctionId];
      if (auction.status === 'active') {
        this.startTimer(auctionId);
      }
    });
  }
}

module.exports = TimerManager;
