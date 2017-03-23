// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var fs = require("fs");
var SerialPort = require('serialport');
var Plotly = require('plotly.js/lib/core');
var http = require('http');
var net = require('net');
var linspace = require('linspace');
const {dialog} = require('electron').remote;

Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};

var serialPortSelect = document.getElementById('serialportSelect');

var plotDiv = document.getElementById('plot');
var graphUpdateEnabled = document.getElementById('enableCheckbox');

var time = [];
var serialData = [];
var traces = 0;

var streams = {};

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
    xaxis: {title: 'Time (ms)'},
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

function renderPacket(packet, index){
  if(graphUpdateEnabled.checked){
    console.log(packet);
    Plotly.restyle(plotDiv, {
      x: [packet.time],
      y: [packet.samples],
      name: packet.deviceID
    }, [index]);
  }
}

exports.clearPlots = function(){
  Plotly.purge(plotDiv);
  initPlot();
}

exports.exportData = function(){
  dialog.showSaveDialog({title: "powerdue-out.csv"}, function(filename){
    if(filename != null){
      console.log("writing file to: " + filename);``
    }
  });
  // write timestamped data buffers into csv file 
}

function addData(packet, index){
  if(graphUpdateEnabled.checked){
    var dataBuf = buffers["" + index];
    if(dataBuf == null){
      dataBuf = [];
      buffers["" + index] = dataBuf;
    }
    dataBuf = dataBuf.concat(packet.samples);
    if(dataBuf.length > 2048){
      dataBuf = dataBuf.slice(packet.samples.length);
    }
    buffers["" + index] = dataBuf;
    render(dataBuf, index);
  }
}

var PACKET_HEADER = "F0F0F0F0";
var PACKET_FOOTER = "F7F7F7F7";

function parsePacket(packet){
  var samples = Array.from(new Uint16Array(packet.buffer, packet.byteOffset + 28, (packet.byteLength - 28)/Uint16Array.BYTES_PER_ELEMENT));
  var timestamp = packet.readUIntLE(12, 6);
  var samplingFreq = packet.readUInt32LE(8);
  var startTime = (timestamp/samplingFreq) * 1000;  // show as ms
  var endTime = ((timestamp+samples.length)/samplingFreq) * 1000; // show as ms
  return {
    deviceID: packet.toString('ascii', 0, 8),
    samplingFreq: samplingFreq,
    timestamp: timestamp,  // javascript can only support upto 6 bytes -_-
    reserved: packet.readUIntLE(20, 8),
    sampleSize: samples.length,
    samples: samples,
    time: linspace(startTime, endTime, samples.length)
  };
}

function packetFound(packet, index){
  var p = parsePacket(packet);
  renderPacket(p, index);
  // addData(p, index);
}

function detectPacket(buffer, index){
  var pktHeaderIndex = buffer.indexOf(PACKET_HEADER, "hex");
  var pktFooterIndex = buffer.indexOf(PACKET_FOOTER, "hex");
  if(pktHeaderIndex != -1 && pktFooterIndex != -1){
    if(pktHeaderIndex > pktFooterIndex){
      // we missed the first packet header, disregard everything until the packet footer
      return buffer.slice(pktFooterIndex + 4);
    } else {  
      var packet = buffer.slice(pktHeaderIndex + 4, pktFooterIndex);
      packetFound(packet, index);
      return buffer.slice(pktFooterIndex + 4);
    }
  } else {
    return buffer;
  }
}

function addStreamData(buffer, index){
  var dataBuf = streams["" + index];
  if(dataBuf == null){
    dataBuf = Buffer.alloc(0);
    streams["" + index] = dataBuf;
  }
  dataBuf = Buffer.concat([dataBuf, buffer]);
  dataBuf = detectPacket(dataBuf, index);
  streams["" + index] = dataBuf;
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
    addStreamData(data, 0);
    // var buf = new Uint16Array(data.buffer, data.byteOffset, data.byteLength/Uint16Array.BYTES_PER_ELEMENT);
    // addData(buf, 0);
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

const server = net.createServer((c) => {
  traces++;
  c.traceNumber = traces;
  Plotly.addTraces(plotDiv, {y: [], name: c.remoteAddress});
  traceNames.push(c.remoteAddress);
  c.on('end', () => {
    console.log("client disconnected");
  });
  c.on('data', (data) => {
    console.log("incoming data..");
    addStreamData(data, c.traceNumber);
    // var buf = new Uint16Array(data.buffer, data.byteOffset, data.byteLength/Uint16Array.BYTES_PER_ELEMENT);
    // addData(buf, c.traceNumber);
  });
});
server.on('error', (err) => {
  console.log("error: " + err);
});
server.listen(4000);