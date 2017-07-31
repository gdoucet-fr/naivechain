/**
 * Created by Gabriel on 26/06/2017.
 */

'use strict';

const crypto  = require('crypto-js');
const path    = require('path');
//const logger = require(path.join(__dirname, 'logger'));
const logger  = require('winston');
const shortid = require('shortid');
const _       = require('lodash');

class Block {
  constructor(index, previousHash, timestamp, data, hash, miner) {
//    console.log('Miner: ' + miner);
    this.index        = index;
    this.previousHash = previousHash.toString();
    this.timestamp    = timestamp;
    this.data         = data;
    this.hash         = hash.toString();
    this.miner        = miner;
  };
}

class Transaction {
  constructor() {
    this.id = shortid.generate();
  };
}

/**
 * Gets the genesis block of the blockchain.
 *
 * @returns {Block} The genesis block
 */
const getGenesisBlock = function () {
  return new Block(0, '0', 1497830400, 'genesis block', '89540f61e334e6612ca801029ce3915a1c7ef8eba3a0e1f55fae49e7a2190d3d', 'root');
};


/**
 * Gets the last block of a blockchain.
 *
 * @param blockchain The blockchain to get the last block from
 * @returns {*}
 */
const getLatestBlock = function (blockchain) {
  return blockchain[blockchain.length - 1];
};


/**
 * Calculates the SHA256 hash of particular fields of a block.
 *
 * @param index - The index of the block
 * @param previousHash - The hash of the previous block
 * @param timestamp - The timestamp of the block
 * @param data - The data of the block
 */
const calculateHash = function (index, previousHash, timestamp, data) {
  return crypto.SHA256(index + previousHash + timestamp + data).toString();
};


/**
 * Calculates the SHA256 of a block object.
 *
 * @param block - The block to calculate the hash for
 */
const calculateHashForBlock = function (block) {
  return calculateHash(block.index, block.previousHash, block.timestamp, block.data);
};


/**
 * Validates the authenticity of a new block mined by a node.
 *
 * @param newBlock - The newly mined block
 * @param previousBlock - The previous block of the blockchain
 * @returns {boolean}
 */
const isValidNewBlock = function (newBlock, previousBlock) {
  if (previousBlock.index + 1 !== newBlock.index) {
    logger.error('Invalid index');
    return false;
  } else if (previousBlock.hash !== newBlock.previousHash) {
    logger.error('Invalid previous hash');
    return false;
  } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
    logger.debug(typeof (newBlock.hash) + ' ' + typeof calculateHashForBlock(newBlock));
    logger.error('Invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
    return false;
  }
  return true;
};


/**
 * Validates the entirety of a chain.
 *
 * @param blockchainToValidate - The chain to validate
 * @returns {boolean}
 */
const isValidChain = function (blockchainToValidate) {
  if (JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(getGenesisBlock())) {
    return false;
  }

  let tempBlocks = [blockchainToValidate[0]];

  for (let i = 1; i < blockchainToValidate.length; i++) {
    if (isValidNewBlock(blockchainToValidate[i], tempBlocks[i - 1])) {
      tempBlocks.push(blockchainToValidate[i]);
    } else {
      return false;
    }
  }
  return true;
};


/**
 * Generates next block of the blockchain.
 *
 * @param blockchain - The blockchain to generate the new block for
 * @param blockData - The block data
 * @returns {Block}
 */
const generateNextBlock = function (blockchain, blockData, miner) {
  let previousBlock = getLatestBlock(blockchain);
  let nextIndex     = previousBlock.index + 1;
  let nextTimestamp = new Date().getTime() / 1000; // 0;// for tests
  let nextHash      = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData);
  return new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, nextHash, miner);
};

const addBlock = function (newBlock, blockchain) {
  let newChain = _.cloneDeep(blockchain);
  if (isValidNewBlock(newBlock, getLatestBlock(newChain))) {
    newChain.push(newBlock);
  }
  return newChain;
};

module.exports = {
  Block: Block,
  Transaction: Transaction,
  getGenesisBlock: getGenesisBlock,
  generateNextBlock: generateNextBlock,
  getLatestBlock: getLatestBlock,
  isValidNewBlock: isValidNewBlock,
  isValidChain: isValidChain,
  calculateHashForBlock: calculateHashForBlock,

  addBlock: addBlock
};