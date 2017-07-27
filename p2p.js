/**
 * Created by Gabriel on 24/07/2017.
 */

'use strict';

const path          = require('path');
const blockchainAPI = require(path.join(__dirname, 'blockchain.js'));
const WebSocket     = require('ws');
const logger        = require(path.join(__dirname, 'logger'));

module.exports = function (sockets, p2pPort, blockchain) {

// Different message types and associated functions
  const MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2
  };

  const queryChainLengthMsg = function () {
    return {'type': MessageType.QUERY_LATEST};
  };

  const queryAllMsg = function () {
    return {'type': MessageType.QUERY_ALL};
  };

  const responseChainMsg = function (blockchain) {
    return {'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain)};
  };

  const responseLatestMsg = function (blockchain) {
    return {
      'type': MessageType.RESPONSE_BLOCKCHAIN,
      'data': JSON.stringify([blockchainAPI.getLatestBlock(blockchain)])
    };
  };


// Handles the response of a message of type RESPONSE_BLOCKCHAIN
  const handleBlockchainResponse = function (message) {
    let receivedBlocks      = JSON.parse(message.data).sort(function (b1, b2) {
      return b1.index - b2.index;
    });
    let latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    let latestBlockHeld     = blockchainAPI.getLatestBlock(blockchain);

    if (latestBlockReceived.index > latestBlockHeld.index) {
      logger.warn('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
      if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
        logger.success('We can append the received block to our chain');
        blockchain.push(latestBlockReceived);
        broadcast(responseLatestMsg(blockchain));
      } else if (receivedBlocks.length === 1) {
        logger.warn('We have to query the chain from our peer');
        broadcast(queryAllMsg());
      } else {
        logger.info('Received blockchain is longer than current blockchain');
        replaceChain(receivedBlocks);
      }
    } else {
      logger.info('Received blockchain is not longer than received blockchain. Do nothing');
    }
  };

  const initP2PServer = function (sockets) {
    const server = new WebSocket.Server({port: p2pPort});
    server.on('connection', function (ws) {
      initConnection(ws, sockets);
    });
    logger.verbose('listening websocket p2p port on: ' + p2pPort);
  };

  const initConnection = function (ws) {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
  };

  const initMessageHandler = function (ws) {
    ws.on('message', function (data) {
      let message = JSON.parse(data);
      logger.verbose('Received message' + JSON.stringify(message));
      switch (message.type) {
        case MessageType.QUERY_LATEST:
          write(ws, responseLatestMsg(blockchain));
          break;
        case MessageType.QUERY_ALL:
          write(ws, responseChainMsg(blockchain));
          break;
        case MessageType.RESPONSE_BLOCKCHAIN:
          handleBlockchainResponse(message);
          break;
      }
    });
  };

  const initErrorHandler = function (ws) {
    const closeConnection = function (ws) {
      logger.error('connection failed to peer: ' + ws.url);
      sockets.splice(sockets.indexOf(ws), 1);
    };

    ws.on('close', function () {
      closeConnection(ws);
    });

    ws.on('error', function () {
      closeConnection(ws);
    });
  };


  const connectToPeers = function (newPeers) {
    newPeers.forEach(function (peer) {
      const ws = new WebSocket(peer);
      ws.on('open', function () {
        initConnection(ws);
      });
      ws.on('error', function () {
        logger.error('connection failed');
      });
    });
  };

  const replaceChain = function (newBlocks) {
    if (blockchainAPI.isValidChain(newBlocks) && newBlocks.length > blockchain.length) {
      logger.log('[SUCCESS] Received blockchain is valid. Replacing current blockchain with received blockchain');
      blockchain = newBlocks;
      broadcast(responseLatestMsg(blockchain));
    } else {
      logger.error('Received blockchain invalid');
    }
  };

  /**
   * Write a message to a socket.
   * @param ws - The web socket to write to
   * @param message - The message to write
   */
  const write = function (ws, message) {
    ws.send(JSON.stringify(message));
  };

  /**
   * Broadcasts a message to all the sockets.
   * @param message - The message to write
   */
  const broadcast = function (message) {
    sockets.forEach(function (socket) {
      write(socket, message);
    });
  };

  return {
    connectToPeers: connectToPeers,
    initP2PServer: initP2PServer,
    broadcast: broadcast,
    responseLatestMsg: responseLatestMsg
  };
};