const socket = io();
let currentAuction = null;
let currentUser = null;
let timerInterval = null;

const joinModal = document.getElementById('joinModal');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('usernameInput');
const auctionSelect = document.getElementById('auctionSelect');
const currentUserDisplay = document.getElementById('currentUser');
const viewerCount = document.getElementById('viewerCount');
const itemTitle = document.getElementById('itemTitle');
const itemDescription = document.getElementById('itemDescription');
const currentPrice = document.getElementById('currentPrice');
const highestBidder = document.getElementById('highestBidder');
const timer = document.getElementById('timer');
const timerSection = document.querySelector('.timer-section');
const bidHistory = document.getElementById('bidHistory');
const bidAmount = document.getElementById('bidAmount');
const placeBidBtn = document.getElementById('placeBidBtn');
const minBidHint = document.getElementById('minBidHint');
const quickBids = document.querySelectorAll('.quick-bid');
const outbidAlert = document.getElementById('outbidAlert');
const outbidMessage = document.getElementById('outbidMessage');
const extendedAlert = document.getElementById('extendedAlert');
const extendedMessage = document.getElementById('extendedMessage');
const auctionEndedAlert = document.getElementById('auctionEndedAlert');
const endedMessage = document.getElementById('endedMessage');
const bidError = document.getElementById('bidError');
const bidErrorMessage = document.getElementById('bidErrorMessage');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const winningBidderBadge = document.getElementById('winningBidderBadge');

socket.on('connect', () => {
  console.log('Connected to server');
  fetch('/api/auctions')
    .then(res => res.json())
    .then(data => {
      auctionSelect.innerHTML = '<option value="">-- Select an auction --</option>';
      data.forEach(auction => {
        const option = document.createElement('option');
        option.value = auction.id;
        option.textContent = `${auction.title} - Starting: ₹${auction.startingPrice.toLocaleString()}`;
        option.dataset.status = auction.status;
        auctionSelect.appendChild(option);
      });
    })
    .catch(err => console.error('Error fetching auctions:', err));
});

joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const auctionId = auctionSelect.value;

  if (!username) {
    showError('Please enter your name');
    return;
  }

  if (!auctionId) {
    showError('Please select an auction');
    return;
  }

  currentUser = username;
  socket.emit('auction:join', { auctionId, username });

  joinModal.style.display = 'none';
  currentUserDisplay.textContent = username;
});

function showError(message) {
  bidErrorMessage.textContent = message;
  bidError.style.display = 'flex';
  setTimeout(() => {
    bidError.style.display = 'none';
  }, 3000);
}

socket.on('auction:init', ({ item, bidHistory: history, timeRemaining, totalViewers }) => {
  currentAuction = item;
  updateAuctionDisplay(item, history, timeRemaining);
  viewerCount.textContent = totalViewers;
});

socket.on('user:joined', ({ username, totalViewers }) => {
  viewerCount.textContent = totalViewers;
});

socket.on('user:left', ({ username, totalViewers }) => {
  viewerCount.textContent = totalViewers;
});

socket.on('auction:time_tick', ({ auctionId, timeRemaining }) => {
  timer.textContent = timeRemaining;
  
  timerSection.classList.remove('urgent', 'extended');
  if (timeRemaining <= 10) {
    timerSection.classList.add('urgent');
  }
});

socket.on('bid:success', ({ currentBid, highestBidder: bidder, bidHistory: history, timeRemaining }) => {
  currentPrice.textContent = `₹${currentBid.toLocaleString()}`;
  document.getElementById('currentPrice').classList.add('pulse');
  setTimeout(() => {
    document.getElementById('currentPrice').classList.remove('pulse');
  }, 500);

  highestBidder.textContent = bidder;
  updateMinBid(currentBid, currentAuction?.minIncrement || 1000);
  
  updateBidHistory(history);

  if (currentUser && bidder === currentUser) {
    winningBidderBadge.style.display = 'inline-flex';
  } else {
    winningBidderBadge.style.display = 'none';
  }
});

socket.on('bid:outbid', ({ message }) => {
  outbidMessage.textContent = message;
  outbidAlert.classList.add('show');
  
  document.body.classList.add('shake');
  setTimeout(() => {
    document.body.classList.remove('shake');
  }, 500);

  setTimeout(() => {
    outbidAlert.classList.remove('show');
  }, 5000);
});

socket.on('bid:rejected', ({ reason }) => {
  bidErrorMessage.textContent = reason;
  bidError.style.display = 'flex';
  setTimeout(() => {
    bidError.style.display = 'none';
  }, 4000);
});

socket.on('auction:extended', ({ timeRemaining, message }) => {
  extendedMessage.textContent = message;
  extendedAlert.classList.add('show');
  timerSection.classList.add('extended');
  
  setTimeout(() => {
    extendedAlert.classList.remove('show');
  }, 4000);
});

socket.on('auction:sold', ({ winner, finalPrice, status }) => {
  statusText.textContent = status.toUpperCase();
  statusBadge.classList.add(status);
  
  if (winner && status === 'sold') {
    if (winner === currentUser) {
      endedMessage.textContent = `🎉 Congratulations! You won with ₹${finalPrice.toLocaleString()}!`;
    } else {
      endedMessage.textContent = `🔨 Sold to ${winner} for ₹${finalPrice.toLocaleString()}!`;
    }
  } else {
    endedMessage.textContent = `❌ Auction ended - Item passed (reserve not met)`;
  }

  auctionEndedAlert.classList.add('show');
  placeBidBtn.disabled = true;
  bidAmount.disabled = true;
  quickBids.forEach(btn => btn.disabled = true);
});

function updateAuctionDisplay(item, history, timeRemaining) {
  itemTitle.textContent = item.title;
  itemDescription.textContent = item.description;
  currentPrice.textContent = `₹${item.currentBid.toLocaleString()}`;
  highestBidder.textContent = item.highestBidder?.username || '-';
  timer.textContent = timeRemaining;

  statusText.textContent = item.status.toUpperCase();

  if (item.status === 'ended' || item.status === 'sold') {
    statusBadge.classList.add('ended');
  }

  updateMinBid(item.currentBid, item.minIncrement);
  updateBidHistory(history);
}

function updateMinBid(currentBid, minIncrement) {
  const minNextBid = currentBid + minIncrement;
  minBidHint.textContent = minNextBid.toLocaleString();
  bidAmount.min = minNextBid;
  bidAmount.placeholder = `Enter at least ${minNextBid.toLocaleString()}`;

  quickBids.forEach(btn => {
    const increment = parseInt(btn.dataset.increment) * minIncrement;
    btn.querySelector('.increment-val').textContent = `${(currentBid + increment).toLocaleString()}`;
    btn.dataset.amount = currentBid + increment;
  });
}

function updateBidHistory(history) {
  if (!history || history.length === 0) {
    bidHistory.innerHTML = '<p class="no-bids">No bids yet. Be the first to bid!</p>';
    return;
  }

  bidHistory.innerHTML = history.map((bid, index) => `
    <div class="history-item ${index === 0 ? 'latest' : ''}">
      <div class="bidder">${bid.bidder}</div>
      <div class="amount">₹${bid.amount.toLocaleString()}</div>
      <div class="time">${bid.timestamp}</div>
    </div>
  `).join('');
}

placeBidBtn.addEventListener('click', () => {
  const amount = parseInt(bidAmount.value);
  if (!amount || isNaN(amount)) {
    showError('Please enter a valid bid amount');
    return;
  }

  socket.emit('bid:place', { auctionId: currentAuction.id, amount });
  bidAmount.value = '';
});

bidAmount.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    placeBidBtn.click();
  }
});

quickBids.forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = parseInt(btn.dataset.amount);
    if (amount) {
      socket.emit('bid:place', { auctionId: currentAuction.id, amount });
    }
  });
});
