/**
 * Created by Gabriel on 25/07/2017.
 */

module.exports = function (a, b) {

  const f1 = function (param) {
    console.log(a, b);
    return param + a;
  };

  const f2 = function (param) {
    console.log(a, b);
    return b * param;
  };

  return {
    f1: f1,
    f2: f2
  };
};