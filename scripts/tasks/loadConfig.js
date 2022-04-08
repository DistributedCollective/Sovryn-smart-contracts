const config = {
	contracts: function () {
		let configData;
		if (network.name == "rskSovrynMainnet" || network.name == "rskPublicMainnet") {
			configData = require("../contractInteraction/mainnet_contracts.json");
		} else if (network.name == "rskSovrynTestnet" || network.name == "rskPublicTestnet") {
			configData = require("../contractInteraction/testnet_contracts.json");
		}

		return configData;
	},
};

module.exports = { config };
