# PowerDue Audio Capture

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

### Serial Streaming Mode

The tool can render a stream of 16-bit unsigned integers from a serial port. Simply open up the serial port of your PowerDue and stream raw bytes from the ADC to the serial port.

### TCP Streaming Mode

The tool will also handle data coming in from TCP connections. Each TCP connection will register as a new trace.

## Troubleshooting

If something isn't working right, contact the following below with a detailed description of the problem (screenshots help too).
- Cef Ramirez (cef.ramirez@sv.cmu.edu)

## Contributing

The tool, obviously, can be improved a lot further. If you have fixes and improvements to add, feel free to send in pull requests.