const { default: Ganache } = require("ganache-core");
const { task } = require("hardhat/config");

require("@nomiclabs/hardhat-ganache");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-web3");
require("hardhat-contract-sizer"); //yarn run hardhat size-contracts
require("solidity-coverage"); // $ npx hardhat coverage
require("hardhat-log-remover");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
/// this is for use with ethers.js
task("accounts", "Prints the list of accounts", async () => {
	const accounts = await ethers.getSigners();

	for (const account of accounts.address) {
		const wallet = ethers.Wallet.fromMnemonic("test test test test test test test test test test test junk", "m/44'/60'/0'/0");

		console.log(account);
	}
});

/*task("accounts", "Prints accounts", async (_, { web3 }) => {
	console.log();
	console.log(await web3.eth.getAccounts());
});*/

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
/**/

module.exports = {
	solidity: {
		version: "0.5.17",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	contractSizer: {
		alphaSort: false,
		runOnCompile: false,
		disambiguatePaths: false,
	},
	networks: {
		hardhat: {},
	},
	paths: {
		sources: "./contracts",
		tests: "./tests-js",
	},
	mocha: {
		timeout: 600000,
		grep: "^(?=.*; using Ganache).*",
	},
};
