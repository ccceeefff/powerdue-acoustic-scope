// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var fs = require("fs");
var SerialPort = require('serialport');
var Plotly = require('plotly.js/lib/core');
var http = require('http');
var net = require('net');
var linspace = require('linspace');
var mqtt = require('mqtt')

const {dialog} = require('electron').remote;
const {shell} = require('electron')

Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};

// var mqttClient  = mqtt.connect('mqtt://broker.hivemq.com');
var mqttClient  = mqtt.connect('tcp://198.199.94.236');

var serialPortSelect = document.getElementById('serialportSelect');
var sampleRateSelect = document.getElementById('sampleRateSelect');


var plotDiv = document.getElementById('plot');
var graphUpdateEnabled = document.getElementById('enableCheckbox');

var time = [];
var serialData = [];
var traces = 0;

var streams = {};

var captureMode = 2;  // by default capture continuously
var capturedPackets = {};
var buffers = {};
var traceNames = [];
traceNames.push("Serial");

// devices settings
var devices = [];
var device_traces = {};

var configId = 0;
var sampleRate = 1000;
var stdDiff = 20.0;
var syncPeriod = 10000;


function setSystemParams(){
  var stdDifferenceInput = document.getElementById('stdDifferenceInput');
  var syncPeriodInput = document.getElementById('syncPeriodInput');

  var params = [];

  if(sampleRate != sampleRateSelect.value) {
    sampleRate = sampleRateSelect.value;
    params = appendParam(params, "adc_sample_rate", 1, "uint32", sampleRate);
  }
  if(stdDifferenceInput.value != "" && stdDiff != parseFloat(stdDifferenceInput.value)) {
    stdDiff = parseFloat(stdDifferenceInput.value);
    params = appendParam(params, "trigger_default_std_distance", 2, "float", stdDiff);
  }
  if(syncPeriodInput.value != "" && syncPeriod != parseInt(syncPeriodInput.value)) {
    syncPeriod = parseFloat(syncPeriodInput.value);
    params = appendParam(params, "sync_period", 3, "uint32", syncPeriod);
  }

  if(params.length === 0) {
    // nothing to send
    return;
  }

  configId++;
  var downlink_msg = {
    "config_id": configId,
    "params":params
  };
  // console.log(downlink_msg);
  
  // publish to all!!!!
  for(i in devices) {
    mqttClient.publish("PowerDue_Acoustic/node/"+devices[i]+"/tx", JSON.stringify(downlink_msg));
  }
}
exports.setSystemParams = setSystemParams;

function appendParam(settings, name, code, type, value) {
  var param = {
    "name": name,
    "code": code,
    "type": type,
    "value": value
  }
  settings.push(param);
  return settings;
}

function setCaptureMode(mode){
  captureMode = mode;
  // update label
  var modeLabel = document.getElementById('graphMode');
  switch(captureMode){
    case 0:
      modeLabel.textContent = "Stopped";
      break;
    case 1:
      modeLabel.textContent = "Capture Once";
      // clear out previously captured packets
      clearPlots();
      break;
    case 2:
      modeLabel.textContent = "Continuous Capture";
      break;
  }
}
exports.setCaptureMode = setCaptureMode;

function initPlot(){
  var initTraces = [];
  for(var i=0; i < traces+1; i++){
    initTraces.push({
      x: [null],
      y: [null],
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
  
  // reset packet captures
  capturedPackets = {};
}
initPlot();

function render(y, index){
  Plotly.restyle(plotDiv, {
    y: [y]
  }, [index]);
  // Plotly.extendTraces(plotDiv, {y: [y]}, [0]);
}

function renderPacket(packet, index){
  if(captureMode > 0){  // if not stopped
    if(captureMode > 1 || (capturedPackets["" + index] == null)){  // continuous mode or we have not captured a packet for this index yet
      console.log(packet);

      Plotly.restyle(plotDiv, {
        x: [packet.time],
        y: [packet.samples],
        name: packet.deviceID + "/" + traceNames[index]
      }, [index]);
      capturedPackets["" + index] = packet;
      
      // if we have captured packets for each device, except serial (hence -1)
      // change to stopped mode
      if(captureMode == 1 && Object.keys(capturedPackets).length >= (traceNames.length-1)){
        setCaptureMode(0);
      }
    }
  }
}

function clearPlots(){
  Plotly.purge(plotDiv);
  initPlot();
}
exports.clearPlots = clearPlots;

function writePacketsToFile(packets, filename){
  console.log("writing file to: " + filename);
  console.log(packets);
  
  // open file for writing
  var fd = fs.openSync(filename, 'w');
  
  // write the device id on the first line
  fs.writeSync(fd, "Device ID");
  for(var p=0; p < packets.length; p++){
    var packet = packets[p];
    fs.writeSync(fd, ",");
    fs.writeSync(fd, packet.deviceID);
  }
  fs.writeSync(fd, "\r\n");
  
  // write sampling frequency
  fs.writeSync(fd, "Sampling Frequency");
  for(var p=0; p < packets.length; p++){
    var packet = packets[p];
    fs.writeSync(fd, ",");
    fs.writeSync(fd, "" + packet.samplingFreq);
  }
  fs.writeSync(fd, "\r\n");
  
  // write clock offset
  fs.writeSync(fd, "Clock Offset");
  for(var p=0; p < packets.length; p++){
    var packet = packets[p];
    fs.writeSync(fd, ",");
    fs.writeSync(fd, "" + packet.clockOffset);
  }
  fs.writeSync(fd, "\r\n");
  
  // write network delay
  fs.writeSync(fd, "Network Delay");
  for(var p=0; p < packets.length; p++){
    var packet = packets[p];
    fs.writeSync(fd, ",");
    fs.writeSync(fd, "" + packet.networkDelay);
  }
  fs.writeSync(fd, "\r\n");
  
  // write timestamp
  fs.writeSync(fd, "Timestamp");
  for(var p=0; p < packets.length; p++){
    var packet = packets[p];
    fs.writeSync(fd, ",");
    fs.writeSync(fd, "" + packet.timestamp);
  }
  fs.writeSync(fd, "\r\n");
  
  // write number of samples
  // also get max length of samples
  var maxSize = 0;
  fs.writeSync(fd, "Length");
  for(var p=0; p < packets.length; p++){
    var packet = packets[p];
    fs.writeSync(fd, ",");
    fs.writeSync(fd, "" + packet.sampleSize);
    maxSize = Math.max(packet.sampleSize, maxSize);
  }
  fs.writeSync(fd, "\r\n");
  
  // write header
  fs.writeSync(fd, "Index (Sample#)");
  for(var p=0; p < packets.length; p++){
    var packet = packets[p];
    fs.writeSync(fd, ",");
    fs.writeSync(fd, "Magnitude");
  }
  fs.writeSync(fd, "\r\n");
  
  // write samples
  for(var i=0; i < maxSize; i++){
    fs.writeSync(fd, "" + (i+1));
    for(var p=0; p < packets.length; p++){
      var packet = packets[p];
      fs.writeSync(fd, ",");
      if(i < packet.sampleSize){
        fs.writeSync(fd, "" + packet.samples[i]);
      }
    }
    fs.writeSync(fd, "\r\n");
  }
  
  // close file
  fs.closeSync(fd);
  
  console.log("Done writing file!");
  dialog.showMessageBox({
    type: 'info',
    buttons: ['OK', 'Open File'],
    message: "File written to: " + filename
  },
  function(response){
    if(response == 1){  // open file
      shell.openItem(filename);
    }
  });
}

exports.exportData = function(){
  // stop capturing first 
  setCaptureMode(0);

  // make a copy of the packets so we don't lose them 
  var packets = [];
  for(var key in capturedPackets){
    packets.push(capturedPackets[key]);
  }
  
  dialog.showSaveDialog({
    title: "events.csv",
    filters: [
      {name: 'CSV Files', extensions: ['csv']}
    ]
  }, function(filename){
    if(filename != null){
      writePacketsToFile(packets, filename);
    }
  });
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
  
  var clockOffset = packet.readInt32LE(20);
  var networkDelay = packet.readInt32LE(24);
  
  return {
    deviceID: packet.toString('ascii', 0, 8),
    samplingFreq: samplingFreq,
    timestamp: timestamp,  // javascript can only support upto 6 bytes -_-
    clockOffset: clockOffset,
    networkDelay: networkDelay,
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

mqttClient.on('connect', function () {
  mqttClient.subscribe('PowerDue_Acoustic/node/+/rx');
  console.log('mqtt connect');
})
 
mqttClient.on('message', function (topic, message) {
  var matches = topic.match(/^PowerDue_Acoustic\/node\/(.+)\/rx/);
  var deviceID = matches[1];

  if(devices.indexOf(deviceID) === -1) {
    console.log("new device: "+ deviceID);
    
    traces++;
    devices.push(deviceID);
    device_traces[deviceID] = traces;
    Plotly.addTraces(plotDiv, {y: [], name: deviceID}); 
    traceNames.push(deviceID);
  }

  var jsonMsg = JSON.parse(message.toString());
  var data = Buffer.from(jsonMsg.data,'base64');
  addStreamData(data, device_traces[deviceID]);
})

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
