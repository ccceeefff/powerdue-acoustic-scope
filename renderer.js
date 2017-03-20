// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var fs = require("fs");
var SerialPort = require('serialport');
var Plotly = require('plotly.js/lib/core');

Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};

var serialPortSelect = document.getElementById('serialportSelect');

var plotDiv = document.getElementById('plot');

var time = [];
var data = [];

function initPlot(){
  Plotly.plot(plotDiv, [{
    y: []
  }
  ], {
    xaxis: {title: 'Time (us)'},
    yaxis: {title: 'Magnitude'},
    margin: {t: 0},
    autosize: true
  });
}
initPlot();

function render(y){
  Plotly.restyle(plotDiv, {
    y: [y]
  }, [0]);
  // Plotly.extendTraces(plotDiv, {y: [y]}, [0]);
}

exports.clearPlots = function(){
  Plotly.purge(plotDiv);
  initPlot();
}

function addData(buffer){
  data = data.concat(Array.from(buffer));
  if(data.length > 2048){
    data = data.slice(buffer.length);
  }
  render(data);
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
    baudRate: 115200,
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
    addData(buf);
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