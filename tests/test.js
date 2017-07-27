/**
 * Created by Gabriel on 26/06/2017.
 */

'use strict';

const path          = require('path');
const blockchainAPI = require(path.join(__dirname, '..', 'blockchain.js'));
const chai          = require('chai');
const expect        = chai.expect;
const crypto        = require('crypto'); // The native node crypto library
const hash          = crypto.createHash('sha256');

let blockchain = [blockchainAPI.getGenesisBlock()];

it('Testing the genesis block', function () {
  let result         = blockchainAPI.getGenesisBlock();
  const genesisBlock = new blockchainAPI.Block(0, '0', 1497830400, 'genesis block', '89540f61e334e6612ca801029ce3915a1c7ef8eba3a0e1f55fae49e7a2190d3d');
  expect(result).to.eql(genesisBlock);
});

it('Testing the block hashing function with crypto-js', function () {
  const genesisBlock = blockchainAPI.getGenesisBlock();
  let result         = blockchainAPI.calculateHashForBlock(genesisBlock);
  hash.update(genesisBlock.index + genesisBlock.previousHash + genesisBlock.timestamp + genesisBlock.data);
  expect(result).to.eql(hash.digest('hex'));
});

it('Testing the generation of a new block', function () {
  const block1   = new blockchainAPI.Block(1,
    '89540f61e334e6612ca801029ce3915a1c7ef8eba3a0e1f55fae49e7a2190d3d',
    0,
    'block 1',
    'fbf7a935abbf58d3e66ec327aa9946132a3697c6bf9d675425757c6498582858');
  const newBlock = blockchainAPI.generateNextBlock(blockchain, 'block 1');
  expect(block1).to.eql(newBlock);
});

describe('Testing the latest block getter', function () {
  it('Test for an empty blockchain', function () {
    let blockchain = [];
    let result     = blockchainAPI.getLatestBlock(blockchain);
    expect(result, 'should be undefined').to.be.undefined;
  });

  it('Test for a 1-element blockchain (genesis block)', function () {
    let genesisBlock = blockchainAPI.getGenesisBlock();
    let result       = blockchainAPI.getLatestBlock(blockchain);
    expect(result).to.eql(genesisBlock);
  });
});

describe('Testing the block validating function with a 1-element blockchain', function () {
  it('The new block is valid', function () {
    const newBlock  = blockchainAPI.generateNextBlock(blockchain, 'block 1');
    let latestBlock = blockchainAPI.getLatestBlock(blockchain);
    let result      = blockchainAPI.isValidNewBlock(newBlock, latestBlock);
    expect(result, 'should be true').to.be.true;
  });

  it('The new block\'s index is invalid', function () {
    const newBlock  = blockchainAPI.generateNextBlock(blockchain, 'block 1');
    newBlock.index  = 2;
    let latestBlock = blockchainAPI.getLatestBlock(blockchain);
    let result      = blockchainAPI.isValidNewBlock(newBlock, latestBlock);
    expect(result, 'should be false').to.be.false;
  });

  it('The new block\'s previous hash is invalid', function () {
    const newBlock  = blockchainAPI.generateNextBlock(blockchain, 'block 1');
    newBlock.previousHash += 'x';
    let latestBlock = blockchainAPI.getLatestBlock(blockchain);
    let result      = blockchainAPI.isValidNewBlock(newBlock, latestBlock);
    expect(result, 'should be false').to.be.false;
  });

  it('New block\'s hash is invalid', function () {
    const newBlock  = blockchainAPI.generateNextBlock(blockchain, 'block 1');
    newBlock.hash += 'x';
    let latestBlock = blockchainAPI.getLatestBlock(blockchain);
    let result      = blockchainAPI.isValidNewBlock(newBlock, latestBlock);
    expect(result, 'should be false').to.be.false;
  });
});

describe('Testing the new block addition', function () {
  it('Adding an element to a 1-element blockchain', function () {
    const newBlock = blockchainAPI.generateNextBlock(blockchain, 'block 1');
    blockchainAPI.addBlock(newBlock, blockchain);
    expect(blockchain).to.eql([blockchainAPI.getGenesisBlock(), newBlock]);
  });

  it('Adding an element to a 2-element blockchain', function () {
    blockchain = [blockchainAPI.getGenesisBlock()];
    const newBlock1 = blockchainAPI.generateNextBlock(blockchain, 'block 1');
    blockchainAPI.addBlock(newBlock1, blockchain);

    const newBlock2 = blockchainAPI.generateNextBlock(blockchain, 'block 2');
    blockchainAPI.addBlock(newBlock2, blockchain);

    expect(blockchain).to.eql([blockchainAPI.getGenesisBlock(), newBlock1, newBlock2]);
  });
});