/**
 * Created by Gabriel on 26/07/2017.
 */

angular.module('blockchain', [])
  .factory('socket', ['$rootScope', function ($rootScope) {
    let socket = io.connect('http://localhost:8080');
    return {
      on: function (eventName, callback) {
        socket.on(eventName, function () {
          let args = arguments;
          $rootScope.$apply(function () {
            callback.apply(socket, args);
          });
        });
      },
      emit: function (eventName, data, callback) {
        socket.emit(eventName, data, function () {
          let args = arguments;
          $rootScope.$apply(function () {
            if (callback) {
              callback.apply(socket, args);
            }
          });
        });
      }
    };
  }])

  .factory('blockchainService', ['$http', 'logger', function ($http, logger) {

    let blockchain;

    const initialiseBlockchain = function () {
      getGenesisBlock().then(function (genesisBlock) {
        blockchain = [genesisBlock];
      });
    };

    const getBlockchain = function () {
      return blockchain;
    };

    const setBlockchain = function (newChain) {
      blockchain = newChain.slice();
    };

    const getLatestBlock = function () {
      let blockchain = getBlockchain();
      return blockchain[blockchain.length - 1];
    };

    const append = function (blockToAppend) {
      blockchain.push(blockToAppend);
    };

    const getGenesisBlock = function () {
      return $http({
        method: 'GET',
        url: 'http://localhost:8080/genesisBlock'
      }).then(function (res) {
        return res.data.data;
      });
    };

    const mineBlock = function (blockchain, blockData, miner) {
      let data = {blockData: blockData, blockchain: blockchain, miner: miner};
      return $http({
        method: 'POST',
        url: 'http://localhost:8080/mineBlock',
        data: data
      }).then(function (res) {
        let newChain = res.data.data;
        setBlockchain(newChain);
        return newChain;
      });
    };

    const replaceChain = function (newBlocks) {
      let data = {chainToValidate: newBlocks};
      return $http({
        method: 'POST',
        url: 'http://localhost:8080/isValidChain',
        data: data
      }).then(function (res) {
        let validBlocks = res.data.data;
        let blockchain  = getBlockchain();
        if (validBlocks) {
          if (newBlocks.length > blockchain.length) {
            logger.log('Received blockchain is valid. Replacing current blockchain with received blockchain', 'success');
            setBlockchain(newBlocks);
            return true;
          } else {
            logger.log('Received blockchain is valid. Received blocks not longer than current blockchain', 'info');
            return false;
          }
        } else {
          logger.log('Received blockchain invalid', 'error');
          return false;
        }
      });
    };

    class Transaction {
      constructor(sender, recipient, data) {
        this.sender    = sender;
        this.recipient = recipient;
        this.data      = data;
      };
    }

    const sendTransaction = function (transaction) {
      let data = {transaction: transaction};
      return $http({
        method: 'POST',
        url: 'http://localhost:8080/sendTransaction',
        data: data
      }).then(function (res) {
        console.log(res.data.data);
      });
    };

    return {
      getGenesisBlock: getGenesisBlock,
      mineBlock: mineBlock,
      getLatestBlock: getLatestBlock,
      replaceChain: replaceChain,
      initialiseBlockchain: initialiseBlockchain,
      append: append,
      getBlockchain: getBlockchain,
      Transaction: Transaction,
      sendTransaction: sendTransaction
    };
  }])

  .factory('p2pService', ['socket', 'blockchainService', 'logger', function (socket, blockchainService, logger) {

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

    const responseChainMsg = function () {
      let blockchain = blockchainService.getBlockchain();
      return {'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain)};
    };

    const responseLatestMsg = function () {
      return {
        'type': MessageType.RESPONSE_BLOCKCHAIN,
        'data': JSON.stringify([blockchainService.getLatestBlock()])
      };
    };

    const broadcast = function (message) {
      socket.emit('client-broadcast', JSON.stringify(message));
    };

    // Handles the response of a message of type RESPONSE_BLOCKCHAIN
    const handleBlockchainResponse = function (message) {
      let receivedBlocks      = JSON.parse(message.data).sort(function (b1, b2) {
        return b1.index - b2.index;
      });
      let latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
      let latestBlockHeld     = blockchainService.getLatestBlock();

      if (latestBlockReceived.index > latestBlockHeld.index) {
        logger.log('Blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index, 'warning');
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
          logger.log('We can append the received block to our chain', 'success');
          blockchainService.append(latestBlockReceived);
          broadcast(responseLatestMsg());
        } else if (receivedBlocks.length === 1) {
          logger.log('We have to query the chain from our peer', 'warning');
          broadcast(queryAllMsg());
        } else {
          logger.log('Received blockchain is longer than current blockchain', 'info');
          blockchainService.replaceChain(receivedBlocks).then(function (res) {
            let success = res;
            if (success) {
              broadcast(responseLatestMsg());
            }
          });
        }
      } else {
        logger.log('Received blockchain is not longer than received blockchain. Do nothing', 'info');
      }
    };

    const initConnection = function (ws) {
      initMessageHandler(ws);
      broadcast(queryChainLengthMsg());
    };

    const initMessageHandler = function (ws) {
      ws.on('message', function (data) {
        let message = JSON.parse(data);
        logger.log('Peer message: ' + JSON.stringify(message), 'info');
        switch (message.type) {
          case MessageType.QUERY_LATEST:
            broadcast(responseLatestMsg());
            break;
          case MessageType.QUERY_ALL:
            broadcast(responseChainMsg());
            break;
          case MessageType.RESPONSE_BLOCKCHAIN:
            handleBlockchainResponse(message);
            break;
        }
      });
    };

    return {
      initConnection: initConnection,
      responseLatestMsg: responseLatestMsg,
      broadcast: broadcast
    };
  }])

  .factory('logger', [function () {

    let logs = [];

    const classMap = {
      'error': 'badge badge-pill badge-danger',
      'warning': 'badge badge-pill badge-warning',
      'success': 'badge badge-pill badge-success',
      'info': 'badge badge-pill badge-info',
      'verbose': 'badge badge-pill badge-primary',
      'debug': 'badge badge-pill badge-default',
    };

    const prioMap = {
      'error': 0,
      'warning': 1,
      'success': 2,
      'info': 3,
      'verbose': 4,
      'debug': 5
    };

    const toString = function (num) {
      if (num < 9) {
        return '0' + num;
      } else {
        return num;
      }
    };

    const getDate = function () {
      let now   = new Date(Date.now());
      let hours = toString(now.getUTCHours());
      let min   = toString(now.getUTCMinutes());
      let secs  = toString(now.getUTCSeconds());
      let milli = toString(now.getUTCMilliseconds());
      return [hours, min, secs].join(':') + '.' + milli + 'Z';
    };

    const log = function (message, level) {
      let log;
      let timestamp = getDate();
      if (level) {
        log = {message: message, timestamp: timestamp, class: classMap[level], level: level, prio: prioMap[level]};
      } else {
        log = {message: message, timestamp: timestamp};
      }
      logs.push(log);
      logs.reverse();
      console.log('[' + level.toUpperCase() + ']' + ' - ' + timestamp + ' - ' + message);
    };

    const getLogs = function () {
      return logs;
    };

    return {
      log: log,
      getLogs: getLogs
    };
  }])

  .filter('reverse', function () {
    return function (items) {
      if (items) {
        return items.slice().reverse();
      }
    };
  })

  .filter('transactionFltr', function () {
    return function (items, scope) {
      let self     = scope.node;
      let filtered = [];
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].name !== self.name) {
            filtered.push(items[i]);
          }
        }
        return filtered;
      }
    };
  })

  .controller('mainController', ['$scope', '$http', 'socket', 'blockchainService', 'p2pService', 'logger',
    function ($scope, $http, socket, blockchainService, p2pService, logger) {
      socket.on('init-message', function (data) {
        $scope.node  = data.node;
        $scope.peers = data.nodes;
      });

      // Initialises the node blockchain
      blockchainService.initialiseBlockchain();
      p2pService.initConnection(socket);

      socket.on('nodes-update', function (data) {
        $scope.nodes = data.nodes;
      });

      $scope.$watchCollection(
        function () {
          return blockchainService.getBlockchain();
        }, function (newChain) {
          if (newChain) {
            $scope.blockchain = newChain.slice();
          }
        });

      $scope.$watchCollection(
        function () {
          return logger.getLogs();
        }, function (newVal) {
          $scope.logs = newVal;
        });

      $scope.selectBlock = function (block) {
        $scope.selectedBlock = block;
      };

      $scope.mineBlock = function () {
        blockchainService.mineBlock($scope.blockchain, $scope.blockdata, $scope.node.id)
          .then(function () {
            p2pService.broadcast(p2pService.responseLatestMsg());
          });
      };

      $scope.createTransaction = function () {
        let transaction = new blockchainService.Transaction($scope.node.id, $scope.transactionRecipient, $scope.transactionData);
        blockchainService.sendTransaction(transaction).then(function (res) {
          console.log(res.data.data);
        });
        console.log(transaction);
      };
    }]);