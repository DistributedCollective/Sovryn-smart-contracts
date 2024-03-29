/* eslint-disable */
require("chai")
	.use(require("chai-as-promised"))
	//.use(require("chai-bn")(require("bn.js")))
	//.use(require("chai-string"))
	//.use(require("dirty-chai"))
	.expect();

const Decimal = require("decimal.js");
Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN, toExpPos: 40 });

const ganache = require("ganache-core");
/* eslint-enable */

module.exports = {
	contracts_directory: "./contracts",
	contracts_build_directory: "./build/contracts",
	test_directory: "./tests",
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
				optimizer: {
					enabled: true,
					runs: 200,
				},
			},
		},
	},
	mocha: {
		enableTimeouts: false,
		before_timeout: 3600000,
		timeout: 1800000,
		useColors: true,
		reporter: "list",
	},
};
