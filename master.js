/**
 * Created by Gabriel on 28/06/2017.
 */

'use strict';

const async         = require('async');
const bodyParser    = require('body-parser');
const cors          = require('cors');
const express       = require('express');
const http          = require('http');
const _             = require('lodash');
const os            = require('os');
const path          = require('path');
const spawn         = require('child_process').spawn;
const WebSocket     = require('ws');
const blockchainAPI = require(path.join(__dirname, 'blockchain'));


const p2pPort  = process.env.P2P_PORT || 6000;
let sockets    = [];
let blockchain = [blockchainAPI.getGenesisBlock()];

const hostname = '127.0.0.1';

const initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

let peers = [];

const app = express();
const p2p = require(path.join(__dirname, 'p2p'))(sockets, p2pPort, blockchain);

class Peer {
  constructor(name, httpPort, p2pPort) {
    this.name        = name;
    this.httpPort    = httpPort;
    this.p2pPort     = p2pPort;
    this.hostname    = hostname;
    this.httpAddress = 'http://' + hostname + ':' + httpPort;
    this.p2pAddress  = 'ws://' + hostname + ':' + p2pPort;
  }
}

const newProcess = function (newPeer) {

  // Clone the actual env vars to avoid overrides
  let env       = Object.create(process.env);
  env.HTTP_PORT = newPeer.httpPort;
  env.P2P_PORT  = newPeer.p2pPort;
  env.PEERNAME  = newPeer.name;
  env.PEERS     = _.map(peers, function (peer) {
    return peer.p2pAddress;
  });

  const childProcess = spawn('node', ['peer.js'], {env: env});
  childProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  childProcess.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
  });

  childProcess.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
};

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

app.post('/', function (req, res) {
  res.render(path.join(__dirname, 'master'), {
    pageData: {
      peers: JSON.stringify(peers),
      blockchain: JSON.stringify(blockchain)
    }
  });
});

app.get('/', function (req, res) {
  res.render(path.join(__dirname, 'master'), {
    pageData: {
      peers: JSON.stringify(peers),
      blockchain: JSON.stringify(blockchain)
    }
  });
});

app.post('/addPeer', function (req, res) {
//  connectToPeers([req.body.peer]);
  let peerName = _.get(req.body, 'peer-name'); //'node-' + (peers.length + 1);
  let httpPort = _.get(req.body, 'http-port');
  let p2pPort  = _.get(req.body, 'p2p-port');
  let newPeer  = new Peer(peerName, httpPort, p2pPort);
  newProcess(newPeer);
  peers.push(newPeer);
  //httpPort += 1;
  //p2pPort += 1;
  res.redirect('/');
});


/* GOOD TODO
 for (let i = 1; i <= 3; i++) {
 let peerName = 'node-' + 1;
 let httpPort = 3001 + i;
 let p2pPort  = 6001 + i;
 let newPeer  = new Peer(peerName, httpPort, p2pPort);
 //  newProcess(newPeer);
 peers.push(newPeer);
 }

 async.eachSeries([1, 2, 3], function (i, callback) {
 let peerName = 'node-' + i;
 let httpPort = 3000 + i;
 let p2pPort  = 6000 + i;
 let newPeer  = new Peer(peerName, httpPort, p2pPort);
 newProcess(newPeer);
 peers.push(newPeer);
 setTimeout(callback, 300);
 }
 );
 */

p2p.connectToPeers(initialPeers);
p2p.initP2PServer(sockets);

app.listen(3000, hostname, function () {
  console.log('Listening http on port: ' + 3000);
});