/**
 * Created by Gabriel on 12/07/2017.
 */

// GET request for remote image
const mineBlock = function () {
  let httpAddress = document.getElementById('peer-select').value;
  let blockData   = document.getElementById('block-data-input').value;
  console.log(httpAddress, blockData);
  axios({
    method: 'post',
    url: httpAddress + '/mineBlock',
    data: {data: blockData},
    headers: {'Access-Control-Allow-Origin': '127.0.0.1'}
  }).then(function (res) {
    console.log(res);
  }).catch(function (error) {
    console.log(error);
  });
};

const createTransaction = function () {
  let httpAddress = document.getElementById('peer-to').value;
  let uuid        = uuidv1();
  let data        = {uuid: uuid, from: document.getElementById('peer-from').value};
  blockData       = {data: data};
  console.log(httpAddress, data);
  axios({
    method: 'post',
    url: httpAddress + '/message',
    data: {data: blockData},
    headers: {'Access-Control-Allow-Origin': '127.0.0.1'}
  }).then(function (res) {
    console.log(res);
  }).catch(function (error) {
    console.log(error);
  });
};