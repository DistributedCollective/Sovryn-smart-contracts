
/* eslint-disable import/no-extraneous-dependencies */
require("chai")
	.use(require("chai-as-promised"))
	.use(require("chai-bn")(require("bn.js")))
	.use(require("chai-string"))
	.use(require("dirty-chai"))
	.expect();

const Decimal = require("decimal.js");
Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN, toExpPos: 40 });

const ganache = require("ganache-core");
/* eslint-enable import/no-extraneous-dependencies */

module.exports = {
	contracts_directory: "./contracts",
	contracts_build_directory: "./build/contracts",
	test_directory: "./tests-js",
	networks: {
		development: {
			host: "localhost",
			port: 7545,
			network_id: "*",
			gasPrice: 20000000000,
			gas: 6800000,
			provider: ganache.provider({
				gasLimit: 6800000,
				gasPrice: 20000000000,
				default_balance_ether: 10000000000000000000,
			}),
		},
	},
	plugins: ["solidity-coverage"],
	compilers: {
		solc: {
			version: "0.5.17",
			settings: {
=======
// //Here is the command line  use to launch the Ganache CLI client:
//ganache-cli -d 100000000 --allowUnlimitedContractSize
module.exports = {
	// Configure your compilers
	compilers: {
		solc: {
			version: "0.5.17", // Fetch exact version from solc-bin (default: truffle's version)
			// docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
			// settings: {          // See the solidity docs for advice about optimization and evmVersion
			settings: {
				// See the solidity docs for advice about optimization and evmVersion
				optimizer: {
					enabled: true,
					runs: 200,
				},
			},

		},
	},
	mocha: {
		before_timeout: 600000,
		timeout: 600000,
		useColors: true,
		reporter: "list",

			//  evmVersion: "byzantium"
			// }
		},
	},
	/**
	 * Networks define how you connect to your  client and let you set the
	 * defaults web3 uses to send transactions. If you don't specify one truffle
	 * will spin up a development blockchain for you on port 8545 when you
	 * run `develop` or `test`. You can ask a truffle command to use a specific
	 * network from the command line, e.g
	 *
	 * $ truffle test --network <network-name>
	 */

	networks: {
		// Useful for testing. The `development` name is special - truffle uses it by default
		// if it's defined here and no other network is specified at the command line.
		// You should run a client (like ganache-cli, geth or parity) in a separate terminal
		// tab if you use this network and you must also set the `host`, `port` and `network_id`
		// options below to some value.
		//
		development: {
			host: "localhost", // Localhost (default: none)
			port: 8545, // Standard Ethereum port (default: none)
			network_id: "*", // Any network (default: none)
		},

	},
};
