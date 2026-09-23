require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const TimerManager = require('./sockets/timerManager');
const { handleBidPlacement } = require('./sockets/auctionEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/auctions', (req, res) => {
  const auctionList = Object.values(auctions).map(auction => ({
    id: auction.id,
    title: auction.title,
    description: auction.description,
    startingPrice: auction.startingPrice,
    currentBid: auction.currentBid,
    minIncrement: auction.minIncrement,
    status: auction.status
  }));
  res.json(auctionList);
});

const auctions = {
  'AUC_VINTAGE_99': {
    id: 'AUC_VINTAGE_99',
    title: '1967 Vintage Fender Stratocaster',
    description: 'Original condition rare electric guitar with sunburst finish',
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null,
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: 'active',
    bidHistory: [],
    timerInterval: null
  },
  'AUC_ROLEX_01': {
    id: 'AUC_ROLEX_01',
    title: 'Rolex Submariner 1968',
    description: 'Vintage diving watch in excellent condition',
    startingPrice: 150000,
    currentBid: 150000,
    highestBidder: null,
    minIncrement: 5000,
    timeRemainingSeconds: 90,
    status: 'active',
    bidHistory: [],
    timerInterval: null
  },
  'AUC_ART_77': {
    id: 'AUC_ART_77',
    title: 'Contemporary Abstract Painting',
    description: 'Oil on canvas by emerging artist, 48x60 inches',
    startingPrice: 25000,
    currentBid: 25000,
    highestBidder: null,
    minIncrement: 1000,
    timeRemainingSeconds: 120,
    status: 'active',
    bidHistory: [],
    timerInterval: null
  }
};

const roomViewers = {};
const socketAuctionMap = {};

const timerManager = new TimerManager(io, auctions);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('auction:join', ({ auctionId, username }) => {
    if (!auctions[auctionId]) {
      return socket.emit('error', { message: 'Auction not found' });
    }

    socket.join(auctionId);
    socketAuctionMap[socket.id] = { auctionId, username };
    socket.auctionId = auctionId;
    socket.username = username;

    if (!roomViewers[auctionId]) {
      roomViewers[auctionId] = new Set();
    }
    roomViewers[auctionId].add(socket.id);

    const auction = auctions[auctionId];
    const auctionData = {
      id: auction.id,
      title: auction.title,
      description: auction.description,
      startingPrice: auction.startingPrice,
      currentBid: auction.currentBid,
      highestBidder: auction.highestBidder,
      minIncrement: auction.minIncrement,
      timeRemainingSeconds: auction.timeRemainingSeconds,
      status: auction.status
    };

    socket.emit('auction:init', {
      item: auctionData,
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      totalViewers: roomViewers[auctionId].size
    });

    io.to(auctionId).emit('user:joined', {
      username,
      totalViewers: roomViewers[auctionId].size
    });

    console.log(`${username} joined auction ${auctionId}. Viewers: ${roomViewers[auctionId].size}`);
  });

  socket.on('bid:place', ({ auctionId, amount }) => {
    const userData = socketAuctionMap[socket.id];
    if (!userData) {
      return socket.emit('bid:rejected', { reason: 'You must join the auction first' });
    }

    handleBidPlacement(io, socket, auctions, auctionId, amount, userData.username, timerManager);
  });

  socket.on('disconnect', () => {
    const userData = socketAuctionMap[socket.id];
    if (userData) {
      const { auctionId, username } = userData;
      
      if (roomViewers[auctionId]) {
        roomViewers[auctionId].delete(socket.id);
        
        io.to(auctionId).emit('user:left', {
          username,
          totalViewers: roomViewers[auctionId].size
        });
      }
      
      delete socketAuctionMap[socket.id];
    }
    
    console.log(`Client disconnected: ${socket.id}`);
  });
});

timerManager.startAllActiveAuctions();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`\n🔨 Auction Server running on http://localhost:${PORT}`);
  console.log(`📊 Active Auctions: ${Object.keys(auctions).length}`);
  console.log(`\nAuctions available:`);
  Object.values(auctions).forEach(auction => {
    console.log(`  - ${auction.title} (Starting: ₹${auction.startingPrice.toLocaleString()})`);
  });
  console.log(`\n🎯 Open the above URL in multiple browser tabs to test bidding!\n`);
});
