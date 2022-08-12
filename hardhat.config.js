const { task } = require("hardhat/config");

require("@nomiclabs/hardhat-ganache");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-waffle");
require("hardhat-contract-sizer"); //yarn run hardhat size-contracts
require("solidity-coverage"); // $ npx hardhat coverage
require("hardhat-log-remover");
require("hardhat-abi-exporter");

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

/*
 * Test hardhat forking with patched hardhat
 *
 * If you get this error:
 * InvalidResponseError: Invalid JSON-RPC response's result.
 * Errors: Invalid value null supplied to : RpcBlockWithTransactions | null/transactions: RpcTransaction Array/2:
 * RpcTransaction/v: QUANTITY, Invalid value null supplied to : RpcBlockWithTransactions | null/transactions:
 * RpcTransaction Array/2: RpcTransaction/r: QUANTITY, Invalid value null supplied to :
 * RpcBlockWithTransactions | null/transactions: RpcTransaction Array/2: RpcTransaction/s: QUANTITY
 *
 * Then the forking doesn't work correctly (ie. hardhat was not properly patched)
 */
task("check-fork-patch", "Check Hardhat Fork Patch by Rainer").setAction(
	async (taskArgs, hre) => {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						jsonRpcUrl: "https://mainnet.sovryn.app/rpc",
						blockNumber: 4272658,
					},
				},
			],
		});
		//const xusd = await IERC20.at("0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F");
        const xusd = await hre.ethers.getContractAt("ERC20", "0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F");
		const totalSupply = await xusd.totalSupply();
		if (totalSupply.toString() === "12346114443582774719512874")
			console.log("Hardhat mainnet forking works properly!")
		else
			console.log("Hardhat mainnet forking does NOT work properly!")
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
	abiExporter: {
		path: "./abi",
		clear: true,
		flat: false,
		only: [],
		except: [],
		spacing: 4,
	},
	contractSizer: {
		alphaSort: false,
		runOnCompile: false,
		disambiguatePaths: false,
	},
	networks: {
		hardhat: {
			allowUnlimitedContractSize: true,
			initialBaseFeePerGas: 0,
		},
		rskPublicTestnet: {
			url: "https://public-node.testnet.rsk.co/",
			accounts: { mnemonic: "brownie", count: 10 },
			network_id: 31,
			confirmations: 4,
			gasMultiplier: 1.25,
			//timeout: 20000, // increase if needed; 20000 is the default value
			//allowUnlimitedContractSize, //EIP170 contrtact size restriction temporal testnet workaround
		},
		rskPublicMainnet: {
			url: "https://public-node.rsk.co/",
			network_id: 30,
			//timeout: 20000, // increase if needed; 20000 is the default value
		},
		rskSovrynTestnet: {
			url: "https://testnet.sovryn.app/rpc",
			accounts: { mnemonic: "brownie", count: 10 },
			network_id: 31,
			confirmations: 4,
			gasMultiplier: 1.25,
			//timeout: 20000, // increase if needed; 20000 is the default value
			//allowUnlimitedContractSize, //EIP170 contrtact size restriction temporal testnet workaround
		},
		rskSovrynMainnet: {
			url: "https://mainnet.sovryn.app/rpc",
			network_id: 30,
			//timeout: 20000, // increase if needed; 20000 is the default value
		},
	},
	paths: {
		sources: "./contracts",
		tests: "./tests",
	},
	mocha: {
		timeout: 800000,
		grep: "^(?!.*; using Ganache).*",
	},
};
