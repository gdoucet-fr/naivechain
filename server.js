const bodyParser    = require('body-parser');
const cors          = require('cors');
const express       = require('express');
const app           = express();
const server        = require('http').Server(app);
const _             = require('lodash');
const path          = require('path');
const io            = require('socket.io')(server);
const blockchainAPI = require(path.join(__dirname, 'blockchain.js'));
const p2p           = require(path.join(__dirname, 'p2p.js'));
const shortid       = require('shortid');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Chargement du fichier index.html affiché au client
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'views', 'index.html'));
});

app.get('/genesisBlock', function (req, res) {
  res.send({data: blockchainAPI.getGenesisBlock()});
});

app.post('/generateNextBlock', function (req, res) {
  let blockData  = req.body.blockData;
  let blockchain = req.body.blockchain;
  //console.log(blockData);
  //console.log(blockchain);
  res.send({data: blockchainAPI.generateNextBlock(blockchain, blockData)});
});

app.post('/getLatestBlock', function (req, res) {
  let blockchain = req.body.blockchain;
  //console.log(blockchain);
  res.send({data: blockchainAPI.getLatestBlock(blockchain)});
});

app.post('/isValidNewBlock', function (req, res) {
  let newBlock      = req.body.newBlock;
  let previousBlock = req.body.previousBlock;
  //console.log(newBlock);
  //console.log(previousBlock);
  res.send({data: blockchainAPI.isValidNewBlock(newBlock, previousBlock)});
});

app.post('/isValidChain', function (req, res) {
  let chainToValidate = req.body.chainToValidate;
  //console.log(chainToValidate);
  res.send({data: blockchainAPI.isValidChain(chainToValidate)});
});

app.post('/calculateHashForBlock', function (req, res) {
  let block = req.body.block;
  //console.log(block);
  res.send({data: blockchainAPI.calculateHashForBlock(block)});
});

app.post('/mineBlock', function (req, res) {
  let blockData  = req.body.blockData;
  let blockchain = req.body.blockchain;
  let miner      = req.body.miner;
  let newBlock   = blockchainAPI.generateNextBlock(blockchain, blockData, miner);
  let newChain   = blockchainAPI.addBlock(newBlock, blockchain);
  res.send({data: newChain});
});

app.post('/sendTransaction', function (req, res) {
  console.log('yoohoo');
  let transaction = req.body.transaction;
  transaction.id  = shortid.generate();
  console.log(transaction);
  res.send({data: transaction});
});


let sockets = {};

const broadcast = function (message) {
  io.sockets.emit('tests-broadcast', message);
};

const getIndex = function () {
  if (_.keys(sockets).length === 0) {
    return 1;
  }
  let currentIndices   = _.map(sockets, function (node) {
    return node.index;
  });
  currentIndices       = _.sortBy(currentIndices);
  let lastIndex        = _.last(currentIndices);
  let availableIndices = [];
  for (let i = 1; i <= lastIndex; i++) {
    if (!_.includes(currentIndices, i)) {
      availableIndices.push(i);
    }
  }

  if (_.isEmpty(availableIndices)) {
    return _.keys(sockets).length + 1;
  } else {
    return _.first(availableIndices);
  }
};

const getNodes = function () {
  let nodes = _.map(sockets, function (node) {
    return node;
  });
  nodes     = _.sortBy(nodes, [function (node) {
    return node.name;
  }]);
  return nodes;
};

let addClient = function (socket) {
  console.log('');
  console.log('New connection');

  let index   = getIndex();
  let name    = 'node-' + index;
  let id      = shortid.generate();
  let newNode = {name: name, index: index, id: id};
  _.set(sockets, socket.id, newNode);

  let nodes = getNodes();
  socket.emit('init-message', {message: 'Connection established!', node: newNode, nodes: nodes});
  socket.broadcast.emit('nodes-update', {nodes: nodes});
};

// Quand un client se connecte, on le note dans la console
io.sockets.on('connection', function (socket) {

  addClient(socket);

// On reception of a message of type 'message'
  socket.on('message', function (data) {
    console.log(data.name + ': ' + data.message);
  });

// On reception of a message of type 'client-broadcast' the server simply forwards the data
  socket.on('client-broadcast', function (data) {
    socket.broadcast.emit('message', data);
  });

// On receiving a disconnection event
  socket.on('disconnect', function (reason) {
    sockets   = _.omit(sockets, socket.id);
    let nodes = getNodes();
    socket.broadcast.emit('nodes-update', {nodes: nodes});
  });
});

server.listen(8080);