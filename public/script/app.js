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
      let data = {blockData: blockData, blockchain: blockchain, minedBy: miner};
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
        if (validBlocks && newBlocks.length > blockchain.length) {
          logger.log('Received blockchain is valid. Replacing current blockchain with received blockchain', 'success');
          setBlockchain(newBlocks);
          return true;
        } else {
          console.error('Received blockchain invalid');
          return false;
        }
      });
    };

    return {
      getGenesisBlock: getGenesisBlock,
      mineBlock: mineBlock,
      getLatestBlock: getLatestBlock,
      replaceChain: replaceChain,
      initialiseBlockchain: initialiseBlockchain,
      append: append,
      getBlockchain: getBlockchain
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
        logger.log('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index, 'warning');
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
        logger.log('Received message' + JSON.stringify(message), 'info');
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
      'error': 'label label-danger',
      'warning': 'label label-warning',
      'success': 'label label-success',
      'info': 'label label-info',
      'verbose': 'label label-primary',
      'debug': 'label label-default',
    };

    const prioMap = {
      'error': 0,
      'warning': 1,
      'success': 2,
      'info': 3,
      'verbose': 4,
      'debug': 5
    };

    const log = function (message, level) {
      let log;
      if (level) {
        log = {message: message, class: classMap[level], level: level, prio: prioMap[level]};
      } else {
        log = {message: message};
      }
      logs.push(log);
      logs.reverse();
      console.log('[' + level.toUpperCase() + ']' + message);
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

  .controller('mainController', ['$scope', '$http', 'socket', 'blockchainService', 'p2pService', 'logger',
    function ($scope, $http, socket, blockchainService, p2pService, logger) {
      socket.on('init-message', function (data) {
        $scope.name  = data.name;
        $scope.nodes = data.nodes;
      });

      // Initialises the node blockchain
      blockchainService.initialiseBlockchain();
      p2pService.initConnection(socket);

      socket.on('nodes-update', function (data) {
        $scope.nodes = data.nodes;
      });

      $scope.$watch(
        function () {
          return blockchainService.getBlockchain();
        }, function (newChain) {
          if (newChain) {
            $scope.blockchain = newChain.slice();
          }
        });

      $scope.$watch(
        function () {
          return logger.getLogs();
        }, function (newVal) {
          $scope.logs = newVal;
        });

      $scope.selectBlock = function (block) {
        $scope.selectedBlock = block;
      };

      $scope.mineBlock = function () {
        blockchainService.mineBlock($scope.blockchain, $scope.blockdata, $scope.name)
          .then(function (newChain) {
            p2pService.broadcast(p2pService.responseLatestMsg());
          });
      };
    }]);