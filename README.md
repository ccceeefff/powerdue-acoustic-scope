# PowerDue Acoustic Visualizer

This tool allows you to capture signal traces from several PowerDues and visualize them on a line plot.

## Requirements

To run this tool, you will need to install node.js. Visit https://nodejs.org and download the latest installation for your platform.

## Getting Started

1. Download or clone this repository to your local machine.
2. In your terminal/console of choice, switch to the directory of the project
3. Install all node.js dependencies by running `npm install`
4. Rebuild the electron runtime for it to function with the native serialportm module: `npm run rebuild`
5. Once all dependencies have installed, run `npm start` to launch the app.

**NOTE**: Some users will experience version mismatches between Electron and Node.js. When this happens, look up the documentation on Electron on rebuilding for native node.js modules: http://electron.atom.io/docs/tutorial/using-native-node-modules/

**NOTE2**: Make sure to update/pull this tool often. More updates will be added over the coming days.

## Using the tool

The tool is primarily used by receiving TCP packets from PowerDues. The PowerDue Acoustic Sensor firmware submits a fixed packet structure containing all the information for each event. When running this app, it will automatically host a TCP server at port 4000 which PowerDues can connect to and send information. You must configure your Acoustic Sensors to submit data to your own IP.

To capture data, you may use one of two modes.
* Continuous - this mode will continuously accept packets and update the graph with each packet. 
* Capture Once - this mode will wait for one packet from each connected device. After receiving a packet from each, it will automatically stop capturing. This is useful for collecting data for specific events.

Exporting data will generate a .csv file containing the information from each packet currently displayed in the graph.

## Troubleshooting

If something isn't working right, contact the following below with a detailed description of the problem (screenshots help too).
- Cef Ramirez (cef.ramirez@sv.cmu.edu)

## Contributing

The tool, obviously, can be improved a lot further. If you have fixes and improvements to add, feel free to send in pull requests.