/**
 * Created by Gabriel on 25/07/2017.
 */

const express    = require('express');
const app        = express();
const bodyParser = require('body-parser');
const os         = require('os');
const path       = require('path');
const hostname   = '127.0.0.1';
const _          = require('lodash');
const http       = require('http');
const cors       = require('cors');
const async      = require('async');

const blockchainAPI = require(path.join(__dirname, 'blockchain.js'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cors());
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/genesisBlock', function (req, res) {
  res.send({data: blockchainAPI.getGenesisBlock()});
});

app.post('/generateNextBlock', function (req, res) {
  let blockData  = req.body.blockData;
  let blockchain = req.body.blockchain;
  console.log(blockData);
  console.log(blockchain);
  res.send({data: blockchainAPI.generateNextBlock(blockchain, blockData)});
});

app.post('/getLatestBlock', function (req, res) {
  let blockchain  = req.body.blockchain;
  console.log(blockchain);
  res.send({data: blockchainAPI.getLatestBlock(blockchain)});
});

app.post('/isValidNewBlock', function (req, res) {
  let newBlock  = req.body.newBlock;
  let previousBlock = req.body.previousBlock;
  console.log(newBlock);
  console.log(previousBlock);
  res.send({data: blockchainAPI.isValidNewBlock(newBlock, previousBlock)});
});

app.post('/isValidChain', function (req, res) {
  let blockchain  = req.body.blockchain;
  console.log(blockchain);
  res.send({data: blockchainAPI.isValidChain(blockchain)});
});

app.post('/calculateHashForBlock', function (req, res) {
  let block  = req.body.block;
  console.log(block);
  res.send({data: blockchainAPI.calculateHashForBlock(block)});
});


app.listen(8000, 'localhost', function () {
  console.log('Listening http on port: ' + 8000);
});