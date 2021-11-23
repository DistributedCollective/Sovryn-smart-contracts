const { expect } = require("chai");
const { expectRevert, BN } = require("@openzeppelin/test-helpers");
const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicBeacon = artifacts.require("LoanTokenLogicBeacon");
const LoanTokenLogicProxy = artifacts.require("LoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenWRBTC,
	loan_pool_setup,
	lend_to_pool,
	getPriceFeeds,
	getSovryn,
	getSOV,
	decodeLogs,
	open_margin_trade_position,
	CONSTANTS,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

// This decodes longs for a single event type, and returns a decoded object in
// the same form truffle-contract uses on its receipts

contract("LoanTokenAdministration", (accounts) => {
	let owner;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC;

	before(async () => {
		[owner] = accounts;
	});

	beforeEach(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		sov = await getSOV(sovryn, priceFeeds, SUSD, accounts);

		loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);
	});

	describe("Test administration", () => {
		it("Test demand curve setting", async () => {
			const baseRate = wei("1", "ether");
			const rateMultiplier = wei("20.25", "ether");
			const targetLevel = wei("80", "ether");
			const kinkLevel = wei("90", "ether");
			const maxScaleRate = wei("100", "ether");

			await loanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);

			/** Change to LoanToken ABI */
			loanToken = await LoanToken.at(loanToken.address);

			expect((await loanToken.baseRate()).toString() == baseRate);
			expect((await loanToken.rateMultiplier()).toString() == rateMultiplier);
			expect((await loanToken.lowUtilBaseRate()).toString() == baseRate);
			expect((await loanToken.lowUtilRateMultiplier()).toString() == rateMultiplier);

			/** Change back to LoanTokenModules Interface */
			loanToken = await ILoanTokenModules.at(loanToken.address);

			const borrowInterestRate = await loanToken.borrowInterestRate();
			expect(borrowInterestRate.gt(oneEth)).to.be.true;
		});

		it("Test demand curve setting should fail if rateMultiplier plus baseRate is grater than 100%", async () => {
			const incorrect_baseRate = wei("51", "ether");
			const incorrect_rateMultiplier = wei("50", "ether");
			const baseRate = wei("1", "ether");
			const rateMultiplier = wei("20.25", "ether");
			const targetLevel = wei("80", "ether");
			const kinkLevel = wei("90", "ether");
			const maxScaleRate = wei("100", "ether");

			await expectRevert.unspecified(
				loanToken.setDemandCurve(
					incorrect_baseRate,
					incorrect_rateMultiplier,
					baseRate,
					rateMultiplier,
					targetLevel,
					kinkLevel,
					maxScaleRate
				)
			);
			await expectRevert.unspecified(
				loanToken.setDemandCurve(
					baseRate,
					rateMultiplier,
					incorrect_baseRate,
					incorrect_rateMultiplier,
					targetLevel,
					kinkLevel,
					maxScaleRate
				)
			);
		});

		it("Test lending fee setting", async () => {
			await sovryn.setLendingFeePercent(hunEth);
			expect((await sovryn.lendingFeePercent()).eq(hunEth)).to.be.true;
		});

		/*
			1. pause a function
			2. try to call the function - should fail
			3. reactivate it
			4. try to call the function - should succeed
		*/
		it("Test toggle function pause", async () => {
			await lend_to_pool(loanToken, SUSD, owner);
			const functionSignature = "marginTrade(bytes32,uint256,uint256,uint256,address,address,uint256,bytes)";

			// pause the given function and make sure the function can't be called anymore
			let localLoanToken = loanToken;
			await localLoanToken.setPauser(accounts[0]);
			await localLoanToken.toggleFunctionPause(functionSignature, true);

			await expectRevert(open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, accounts[1]), "unauthorized");

			// check if checkPause returns true
			assert(localLoanToken.checkPause(functionSignature));

			await localLoanToken.setPauser(accounts[0]);
			await localLoanToken.toggleFunctionPause(functionSignature, false);
			await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, accounts[1]);

			// check if checkPause returns false
			expect(await localLoanToken.checkPause(functionSignature)).to.be.false;
		});

		// call toggleFunction with a non-admin address and make sure it fails
		it("Test toggle function pause with non admin should fail", async () => {
			let localLoanToken = loanToken;
			await expectRevert(localLoanToken.toggleFunctionPause("mint(address,uint256)", true, { from: accounts[1] }), "onlyPauser");
		});

		it("Should succeed with larger rate than maxSlippage in positive direction", async () => {
			const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);
			let rate = await priceFeeds.checkPriceDisagreement(WRBTC.address, SUSD.address, wei("1", "ether"), wei("20000", "ether"), 0);
			assert(rate == wei("20000", "ether"));
		});

		it("Should fail with larger rate than maxSlippage in negative direction", async () => {
			const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);
			await expectRevert(
				priceFeeds.checkPriceDisagreement(WRBTC.address, SUSD.address, wei("1", "ether"), wei("1", "ether"), 0),
				"price disagreement"
			);
		});

		it("Initialize loan token proxy from non-admin should fail", async () => {
			const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
			loanTokenLogicLM = initLoanTokenLogic[0];
			loanTokenLogicBeaconLM = initLoanTokenLogic[1];

			loanToken = await LoanToken.new(owner, loanTokenLogicLM.address, sovryn.address, WRBTC.address);
			await loanToken.initialize(SUSD.address, "SUSD", "SUSD"); //iToken

			/** Initialize the loan token logic proxy */
			loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
			await expectRevert(
				loanToken.setBeaconAddress(loanTokenLogicBeaconLM.address, { from: accounts[1] }),
				"LoanTokenLogicProxy:unauthorized"
			);
		});

		it("Should revert if target not active in loan token proxy", async () => {
			/** Deploy LoanTokenLogicBeacon */
			const loanTokenLogicBeaconLM = await LoanTokenLogicBeacon.new();

			/** Deploy LoanTokenLogicProxy */
			loanTokenLogicLM = await LoanTokenLogicProxy.new(loanTokenLogicBeacon.address);

			loanToken = await LoanToken.new(owner, loanTokenLogicLM.address, sovryn.address, WRBTC.address);
			await loanToken.initialize(SUSD.address, "SUSD", "SUSD"); //iToken

			/** Initialize the loan token logic proxy */
			loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
			await loanToken.setBeaconAddress(loanTokenLogicBeaconLM.address);

			/** Use interface of LoanTokenModules */
			loanToken = await ILoanTokenModules.at(loanToken.address);

			await expectRevert(loanToken.assetBalanceOf(owner), "LoanTokenLogicProxy:target not active");
		});

		it("Test set beacon address in loan token logic proxy", async () => {
			const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
			loanTokenLogicLM = initLoanTokenLogic[0];
			loanTokenLogicBeaconLM = initLoanTokenLogic[1];

			/** Deploy New LoanTokenLogicBeacon */
			const newLoanTokenLogicBeaconLM = await LoanTokenLogicBeacon.new();

			await loanTokenLogicLM.setBeaconAddress(newLoanTokenLogicBeaconLM.address);
			expect(await loanTokenLogicLM.beaconAddress()).to.equal(newLoanTokenLogicBeaconLM.address);
		});

		it("Set beacon address from non-owner should fail", async () => {
			const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
			loanTokenLogicLM = initLoanTokenLogic[0];
			loanTokenLogicBeaconLM = initLoanTokenLogic[1];

			/** Deploy New LoanTokenLogicBeacon */
			const newLoanTokenLogicBeaconLM = await LoanTokenLogicBeacon.new();

			await expectRevert(
				loanTokenLogicLM.setBeaconAddress(newLoanTokenLogicBeaconLM.address, { from: accounts[1] }),
				"LoanTokenLogicProxy:unauthorized"
			);
		});

		it("Set beacon address to non contract address should fail", async () => {
			const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
			loanTokenLogicLM = initLoanTokenLogic[0];
			loanTokenLogicBeaconLM = initLoanTokenLogic[1];

			await expectRevert(loanTokenLogicLM.setBeaconAddress(accounts[1]), "Cannot set beacon address to a non-contract address");
		});
	});
});
