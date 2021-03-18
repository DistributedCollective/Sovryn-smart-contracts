const { constants } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const LoanSettings = artifacts.require("LoanSettings");

const { getSUSD, getRBTC, getWRBTC, getBZRX, getSovryn, getPriceFeeds } = require("../Utils/initializer.js");

contract("Protocol", (accounts) => {
	let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds;
	const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
	beforeEach(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
	});

	describe("Protocol Tests", () => {
		it("Test targetSetup", async () => {
			const sig1 = "testFunction1(address,uint256,bytes)";
			const sig2 = "testFunction2(address[],uint256[],bytes[])";

			const sigs = [sig1, sig2];
			let targets = [ONE_ADDRESS, ONE_ADDRESS];
			await sovryn.setTargets(sigs, targets);

			expect((await sovryn.getTarget(sig1)) == ONE_ADDRESS).to.be.true;
			expect((await sovryn.getTarget(sig2)) == ONE_ADDRESS).to.be.true;

			targets = [constants.ZERO_ADDRESS, constants.ZERO_ADDRESS];
			await sovryn.setTargets(sigs, targets);

			expect((await sovryn.getTarget(sig1)) == constants.ZERO_ADDRESS).to.be.true;
			expect((await sovryn.getTarget(sig2)) == constants.ZERO_ADDRESS).to.be.true;
		});

		it("Test replaceContract", async () => {
			const sig = "setupLoanParams((bytes32,bool,address,address,address,uint256,uint256,uint256)[])";
			const loanSettings = await LoanSettings.new();

			await sovryn.setTargets([sig], [constants.ZERO_ADDRESS]);
			expect((await sovryn.getTarget(sig)) == constants.ZERO_ADDRESS).to.be.true;

			await sovryn.replaceContract(loanSettings.address);
			expect((await sovryn.getTarget(sig)) == loanSettings.address).to.be.true;
		});

		it("Test receiveEther", async () => {
			expect((await web3.eth.getBalance(sovryn.address)) == 0).to.be.true;
			// await web3.eth.sendTransaction({ from: accounts[0].toString(), to: sovryn.address, value: 10000, gas: "210000" });
			// expect((await web3.eth.getBalance(sovryn.address)).toNumber() == 10000).to.be.true;
		});
	});
});
