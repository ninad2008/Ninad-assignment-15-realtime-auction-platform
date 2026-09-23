# 🔨 Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io)
> **Track:** Backend & Real-Time Web | **Level:** Advanced | **Estimated Time:** 8–10 Hours  
> **Tech Stack:** Node.js, Express.js, Socket.io, In-Memory State Engine, Timer Synchronizer, CORS

---

## 📌 1. Objective & Overview

Architect a mission-critical, low-latency **Real-Time Live Auction & Bidding Platform** using **Node.js, Express.js, and Socket.io**. Students will build an authoritative bidding engine that prevents race conditions, enforces minimum bid increments, broadcasts real-time outbid notifications, synchronizes live countdown timers across all connected bidders, and implements **Anti-Snipe Timer Extensions** (extending auction time if a bid arrives in the final seconds).

### Key Learning Outcomes:
- Managing high-concurrency real-time transactional actions without race conditions.
- Broadcasting instantaneous outbid alerts and live ticker price updates.
- Implementing server-side countdown clocks and anti-sniping rules (soft-close timer reset).
- Building an authoritative bid validation engine (min increment check, self-outbid prohibition, wallet balance simulation).
- Maintaining an auditable live bid activity history feed per auction room.

---

## 🛠️ 2. Tech Stack & Dependencies

```bash
# Initialize project
npm init -y

# Install dependencies
npm install express socket.io cors dotenv uuid

# Install development tools
npm install -D nodemon
```

---

## 🏷️ 3. Auction Data Model & Room State

```javascript
// In-Memory Auction Room State
const auctions = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active", // "upcoming", "active", "ended"
    bidHistory: [],
    timerInterval: null
  }
};
```

---

## 📡 4. Real-Time Socket Event Protocol

### 🔄 Room & Stream Events

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `auction:join` | `Client -> Server` | `{ "auctionId": "AUC_VINTAGE_99", "username": "Vikram" }` | Join the live bidding floor room |
| `auction:init` | `Server -> Client` | `{ "item": { ... }, "bidHistory": [...], "timeRemaining": 45 }` | Hydrates current auction status to newly joined bidder |
| `auction:time_tick` | `Server -> Room` | `{ "auctionId": "...", "timeRemaining": 44 }` | Broadcasted every 1 second |
| `user:joined` | `Server -> Room` | `{ "username": "Vikram", "totalViewers": 14 }` | Updates live audience count |

### 💰 Live Bidding Actions

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `bid:place` | `Client -> Server` | `{ "auctionId": "AUC_VINTAGE_99", "amount": 54000 }` | Bidder places a higher bid |
| `bid:success` | `Server -> Room` | `{ "newBid": 54000, "highestBidder": "Vikram", "timeRemaining": 30 }` | Broadcasts new leading price to all participants |
| `bid:outbid` | `Server -> Client` | `{ "message": "You have been outbid by Vikram at ₹54,000!" }` | Targeted alert sent strictly to the previous highest bidder |
| `bid:rejected` | `Server -> Client` | `{ "reason": "Bid must be at least ₹56,000" }` | Rejection error sent to invalid bid attempt |
| `auction:extended` | `Server -> Room` | `{ "message": "Anti-snipe triggered: +20 seconds added!" }` | Emitted when late bid extends the clock |
| `auction:sold` | `Server -> Room` | `{ "winner": "Vikram", "finalPrice": 62000, "status": "sold" }` | Emitted when clock hits 0 and reserve met |

---

## 🛡️ 5. Authoritative Bidding & Anti-Snipe Engine

```javascript
// sockets/auctionEngine.js
function handleBidPlacement(io, socket, auction, bidAmount, username) {
  // 1. Check if auction is active
  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    return socket.emit('bid:rejected', { reason: 'Auction is closed' });
  }

  // 2. Check if bidder is already the highest bidder
  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
  }

  // 3. Check minimum increment
  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (bidAmount < minimumRequired) {
    return socket.emit('bid:rejected', { 
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired}` 
    });
  }

  // 4. Capture previous highest bidder to notify outbid
  const previousBidder = auction.highestBidder;

  // 5. Update State
  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString()
  });

  // 6. Anti-Snipe Rule: If bid placed within last 15s, extend timer back to 20s
  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    io.to(auction.id).emit('auction:extended', {
      timeRemaining: 20,
      message: 'Bid in final seconds: Timer extended by 20s!'
    });
  }

  // 7. Broadcast new top bid to room
  io.to(auction.id).emit('bid:success', {
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  // 8. Send private alert to outbid user
  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      message: `You were outbid by ${username} with ₹${bidAmount}!`
    });
  }
}
```

---

## 🏗️ 6. Directory Structure

```text
assignment-15-auction-socket/
├── public/
│   ├── index.html           # Live bidding floor UI
│   ├── app.js               # Client socket handlers & bid buttons
│   └── style.css            # Dark trading floor aesthetic & animations
├── sockets/
│   ├── auctionEngine.js     # Bid validation, outbid alerts & anti-snipe logic
│   └── timerManager.js      # Server-side 1s interval countdown clock
├── server.js                # Server setup
├── package.json
└── README.md
```

---

## 🧪 7. Testing & Verification

1. Start the server on `http://localhost:5000`.
2. Open three browser tabs on the auction page: Bidder A (Vikram), Bidder B (Ananya), and Viewer C.
3. Place a bid from Vikram: verify all 3 screens update the current highest bid to ₹52,000.
4. Place a higher bid from Ananya: verify Vikram instantly receives an **"Outbid Alert"** banner.
5. Wait until the timer drops to 10 seconds, then place a bid: verify the clock jumps back to 20 seconds (**Anti-Snipe Protection**).
6. Let the clock tick down to 0: verify the room emits `auction:sold` and further bids are rejected.

---

## 📊 8. Grading Rubric (100 Marks)

| Evaluation Component | Marks |
|---|:---:|
| **Real-Time Bid Processing & Validation Engine** | 30 |
| **Server-Side Countdown Timer & Anti-Snipe Mechanism** | 25 |
| **Targeted Outbid Notifications & Live Room Broadcasting** | 20 |
| **Auditable Bid History Feed & Live Viewer Counter** | 15 |
| **Trading Floor Client UI Polish, Audio/Visual Cues & Architecture** | 10 |
| **Total Marks** | **100** |

---

## 📤 9. Submission Guidelines

- Push code to GitHub: `itm-assignment-15-auction-socket`.
- Include a 1-minute video demo demonstrating concurrent bidding, outbid alerts, and anti-snipe extension.
