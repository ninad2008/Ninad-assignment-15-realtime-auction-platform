function handleBidPlacement(io, socket, auctions, auctionId, bidAmount, username, timerManager) {
  const auction = auctions[auctionId];

  if (!auction) {
    return socket.emit('bid:rejected', { reason: 'Auction not found' });
  }

  if (auction.status !== 'active') {
    return socket.emit('bid:rejected', { reason: 'Auction is closed' });
  }

  if (auction.timeRemainingSeconds <= 0) {
    return socket.emit('bid:rejected', { reason: 'Auction has ended' });
  }

  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
  }

  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (bidAmount < minimumRequired) {
    return socket.emit('bid:rejected', {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString()}`
    });
  }

  const previousBidder = { ...auction.highestBidder };

  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString()
  });

  let timerExtended = false;
  if (auction.timeRemainingSeconds < 15) {
    timerManager.extendTimer(auctionId, 20);
    timerExtended = true;
    
    io.to(auctionId).emit('auction:extended', {
      timeRemaining: 20,
      message: 'Bid in final seconds: Timer extended by 20s!'
    });
  }

  auction.highestBidder = { socketId: socket.id, username };

  io.to(auctionId).emit('bid:success', {
    auctionId,
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  if (previousBidder && previousBidder.socketId && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      message: `You were outbid by ${username} with ₹${bidAmount.toLocaleString()}!`
    });
  }
}

module.exports = { handleBidPlacement };
