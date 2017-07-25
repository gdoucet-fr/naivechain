/**
 * Created by Gabriel on 25/07/2017.
 */

let a = 5;
let b = 2;

const path = require('path');

const test = require(path.join(__dirname, 'test'))(a, b);

console.log(test.f1(10));
console.log(test.f2(10));
