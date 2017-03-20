// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var fs = require("fs");
var SerialPort = require('serialport');
var Plotly = require('plotly.js/lib/core');
var http = require('http');
var net = require('net');
const {dialog} = require('electron').remote;

Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};

var serialPortSelect = document.getElementById('serialportSelect');

var plotDiv = document.getElementById('plot');

var time = [];
var serialData = [];
var traces = 0;

var buffers = {};
var traceNames = [];
traceNames.push("Serial");

function initPlot(){
  var initTraces = [];
  for(var i=0; i < traces+1; i++){
    initTraces.push({
      y: [],
      name: traceNames[i]
    });
  }
  
  Plotly.plot(plotDiv, initTraces,
  {
    xaxis: {title: 'Time (us)'},
    yaxis: {title: 'Magnitude'},
    margin: {t: 0},
    autosize: true
  });
}
initPlot();

function render(y, index){
  Plotly.restyle(plotDiv, {
    y: [y]
  }, [index]);
  // Plotly.extendTraces(plotDiv, {y: [y]}, [0]);
}

exports.clearPlots = function(){
  Plotly.purge(plotDiv);
  initPlot();
}

exports.exportData = function(){
  dialog.showSaveDialog({title: "powerdue-out.csv"}, function(filename){
    if(filename != null){
      console.log("writing file to: " + filename);
    }
  });
  // write timestamped data buffers into csv file 
}

function addData(buffer, index){
  var dataBuf = buffers["" + index];
  if(dataBuf == null){
    dataBuf = [];
    buffers["" + index] = dataBuf;
  }
  dataBuf = dataBuf.concat(Array.from(buffer));
  if(dataBuf.length > 2048){
    dataBuf = dataBuf.slice(buffer.length);
  }
  buffers["" + index] = dataBuf;
  render(dataBuf, index);
}

exports.onSerialRefresh = function(){
  // clear all previous options
  var length = serialPortSelect.options.length;
  for (i = 0; i < length; i++) {
    serialPortSelect.options[i] = null;
  }
  
  SerialPort.list(function(err, ports){
    ports.forEach(function(port){
      var opt = document.createElement('option');
      opt.value = port.comName;
      opt.innerHTML = port.comName;
      serialPortSelect.add(opt);
    });
  });
}

exports.onSerialOpen = function(){
  var chosenPort = serialPortSelect.value;
  
  port = new SerialPort(chosenPort, { 
    autoOpen: false,
    baudRate: 1050000,
    parser: SerialPort.parsers.byteLength(256)
  });
  port.open(function (err) {
    if (err) {
      return console.log('Error opening port: ', err.message);
    }
  });  
  
  // the open event will always be emitted 
  port.on('open', function() {
    
  });

  port.on('data', function(data){
    var buf = new Uint16Array(data.buffer, data.byteOffset, data.byteLength/Uint16Array.BYTES_PER_ELEMENT);
    addData(buf, 0);
  });

  port.on('close', function(){
    port = null;
  });

  port.on('disconnect', function(){
    port = null;
  });

  port.on('error', function(e){
    port = null;
  });
}

exports.onSerialClose = function(){
  port.close();
  port = null;
}

// const server = http.createServer((req, res) =>{
//   console.log(req);
//   if(req.method == "GET"){
//     console.log(req.connection.remoteAddress);
//   }
//   res.end();
// });
const server = net.createServer((c) => {
  traces++;
  c.traceNumber = traces;
  Plotly.addTraces(plotDiv, {y: [], name: c.remoteAddress});
  traceNames.push(c.remoteAddress);
  c.on('end', () => {
    console.log("client disconnected");
  });
  c.on('data', (data) => {
    var buf = new Uint16Array(data.buffer, data.byteOffset, data.byteLength/Uint16Array.BYTES_PER_ELEMENT);
    addData(buf, c.traceNumber);
  });
});
server.on('error', (err) => {
  console.log("error: " + err);
});
server.listen(4000);