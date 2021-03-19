const { expect } = require("chai");
const MultiSigWallet = artifacts.require("MultiSigWallet");

const ProtocolSettings = artifacts.require("ProtocolSettings");
const sovrynProtocol = artifacts.require("sovrynProtocol");
const ISovryn = artifacts.require("ISovryn");

const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");

const SwapsExternal = artifacts.require("SwapsExternal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");

const { getSUSD, getRBTC, getWRBTC, getBZRX, getPriceFeeds } = require("../Utils/initializer.js");

// Deploys the multisig wallet contract setting 3 owners and 2 required confirmations

const getMultisig = async (accounts) => {
	const requiredConf = 2;
	const owners = [accounts[0], accounts[1], accounts[2]];
	const multisig = await MultiSigWallet.new(owners, requiredConf);
	return multisig;
};

contract("ProtocolSettings", (accounts) => {
	let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds, multisig;
	const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
	beforeEach(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);

		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);

		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.replaceContract((await LoanSettings.new()).address);
		await sovryn.replaceContract((await LoanMaintenance.new()).address);
		await sovryn.replaceContract((await SwapsExternal.new()).address);

		const sovrynSwapSimulator = await TestSovrynSwap.new(priceFeeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([SUSD.address, RBTC.address, WRBTC.address], [true, true, true]);

		await sovryn.setWrbtcToken(WRBTC.address);

		multisig = await getMultisig(accounts);
	});

	// Change Sovryn contract owner to multisig
	const set_owner_to_multisig = async () => {
		await sovryn.transferOwnership(multisig.address);
	};

	describe("ProtocolSettings Tests", () => {
		it("Test setCoreParams", async () => {
			const dest = sovryn.address;
			const val = 0;

			let data = sovryn.contract.methods.setPriceFeedContract(ONE_ADDRESS).encodeABI();

			let tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });
			// console.log(tx);

			console.log(await sovryn.priceFeeds());
			await sovryn.setPriceFeedContract("0x66aB6D9362d4F35596279692F0251Db635165871");
			console.log(await sovryn.priceFeeds());

			expect((await sovryn.priceFeeds()) == ONE_ADDRESS).to.be.true;
			expect((await sovryn.swapsImpl()) == ONE_ADDRESS).to.be.true;
		});
	});
});
