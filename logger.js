/**
 * Created by Gabriel on 27/06/2017.
 */

const winston = require('winston');

const myCustomLevels = {
  levels: {
    error: 0,
    warn: 1,
    success: 2,
    info: 3,
    verbose: 4,
    debug: 5
  },
  colors: {
    error: 'red',
    warning: 'orange',
    success: 'green',
    info: 'cyan',
    verbose: 'grey',
    debug: 'white'
  }
};

const logger = new winston.Logger({
  level: 'debug',
  levels: myCustomLevels.levels,
  colors: myCustomLevels.colors,
  transports: [
    new (winston.transports.Console)({
      timestamp: function () {
        return new Date(Date.now()).toISOString();
      },
      formatter: function (options) {
        return this.timestamp() + ' [' + winston.config.colorize(options.level, options.level.toUpperCase())
          + '] - ' + options.message;
      }
    })
  ]
});

module.exports = logger;