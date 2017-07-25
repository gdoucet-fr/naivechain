'use strict';
const express    = require('express');
const bodyParser = require('body-parser');
const WebSocket  = require('ws');
const cors       = require('cors');

const http_port    = process.env.HTTP_PORT;
const p2p_port     = process.env.P2P_PORT;
const peerName     = process.env.PEERNAME;
const initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

const path          = require('path');
const blockchainAPI = require(path.join(__dirname, 'blockchain.js'));
const logger        = require(path.join(__dirname, 'logger'));

//const logger = require('winston');

let sockets    = [];
let blockchain = [blockchainAPI.getGenesisBlock()];

const p2p = require(path.join(__dirname, 'p2p'))(sockets, p2p_port, blockchain);

const initHttpServer = function () {
  const app = express();
  app.set('view engine', 'pug');
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: false}));
  app.use(cors());

  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  app.get('/blocks', function (req, res) {
    res.send(JSON.stringify(blockchain));
  });

  app.post('/mineBlock', function (req, res) {
    console.log(req.body);
    let newBlock = blockchainAPI.generateNextBlock(blockchain, req.body.data);
    blockchainAPI.addBlock(newBlock, blockchain);
    p2p.broadcast(p2p.responseLatestMsg());
    logger.info('Block added: ' + JSON.stringify(newBlock));
    res.render(path.join(__dirname, 'peer'), {pageData: {blockchain: JSON.stringify(blockchain), peerName: peerName}});
  });

  app.post('/message', function (req, res) {
    let transaction = req.body.data;
    console.log(transaction);
    let newBlock = blockchainAPI.generateNextBlock(blockchain, transaction);
    blockchainAPI.addBlock(newBlock, blockchain);
    p2p.broadcast(p2p.responseLatestMsg());
    logger.info('Block added: ' + JSON.stringify(newBlock));
    res.redirect('/');
  });

  app.get('/peers', function (req, res) {
    res.send(sockets.map(function (s) {
      return s._socket.remoteAddress + ':' + s._socket.remotePort;
    }));
  });

  app.post('/addPeer', function (req, res) {
    p2p.connectToPeers([req.body.peer], sockets, blockchain);
    res.render(path.join(__dirname, 'peer'), {pageData: {blockchain: JSON.stringify(blockchain), peerName: peerName}});
  });

  app.listen(http_port, function () {
    logger.verbose('Listening http on port: ' + http_port);
  });

  app.get('/', function (req, res) {
    res.render(path.join(__dirname, 'peer'), {pageData: {blockchain: JSON.stringify(blockchain), peerName: peerName}});
  });
};


// Entry point
p2p.connectToPeers(initialPeers, sockets, blockchain);
initHttpServer();
p2p.initP2PServer(sockets);