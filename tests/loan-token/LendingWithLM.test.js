/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * No bottlenecks found, flow runs smoothly on all tests. Deployments
 *   are performed just once at the beginning.
 *
 * Total time elapsed: 5.2s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes:
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use SUSD as underlying token, instead of custom token.
 *   Updated to use WRBTC as collateral token, instead of custom token.
 *   Updated to use SOV as protocol token, instead of custom token.
 */

const { expect } = require("chai");
const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");

const LiquidityMiningLogic = artifacts.require("LiquidityMiningMockup");
const LiquidityMiningProxy = artifacts.require("LiquidityMiningProxy");
const LockedSOV = artifacts.require("LockedSOV");

const TOTAL_SUPPLY = web3.utils.toWei("1000", "ether");

//const { lend_to_the_pool, cash_out_from_the_pool, cash_out_from_the_pool_more_of_lender_balance_should_not_fail } = require("./helpers");
const { lend_to_the_pool, cash_out_from_the_pool, cash_out_from_the_pool_uint256_max_should_withdraw_total_balance } = require("./helpers");

const wei = web3.utils.toWei;

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenLogicWrbtc,
	getLoanTokenWRBTC,
	loan_pool_setup,
	set_demand_curve,
	getPriceFeeds,
	getSovryn,
	decodeLogs,
	getSOV,
} = require("../Utils/initializer.js");

contract("LoanTokenLogicLM", (accounts) => {
	const name = "Test token";
	const symbol = "TST";
	const depositAmount = new BN(wei("400", "ether"));

	let lender, account1, account2;
	let SUSD, WRBTC, SOV;
	let sovryn, loanToken, loanTokenWRBTC;
	let liquidityMining;
	let lockedSOVAdmins, lockedSOV;

	before(async () => {
		[lender, account1, account2, ...accounts] = accounts;
		await deployProtocol();
		await deployLoanTokens();
		await deployLiquidityMining();

		await loanToken.setLiquidityMiningAddress(liquidityMining.address);
		await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMining.address);
		await liquidityMining.add(loanToken.address, 10, false);
		await liquidityMining.add(loanTokenWRBTC.address, 10, true);
	});

	describe("Test lending with liquidity mining", () => {
		it("Should lend to the pool and deposit the pool tokens at the liquidity mining contract", async () => {
			// await lend_to_the_pool(loanToken, lender, SUSD, WRBTC, sovryn);
			await SUSD.approve(loanToken.address, depositAmount);
			const tx = await loanToken.mint(lender, depositAmount, true);
			const userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
			// expected: user pool token balance is 0, but balance of LM contract increased
			expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount);
			// expect the Mint event to mention the lender
			expectEvent(tx, "Mint", {
				minter: lender,
				tokenAmount: depositAmount,
				assetAmount: depositAmount,
			});
		});

		it("Should lend to the pool without depositing the pool tokens at the liquidity mining contract", async () => {
			await SUSD.approve(loanToken.address, depositAmount);
			const tx = await loanToken.mint(lender, depositAmount, false);
			const userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
			// expected: user pool token balance increased by the deposited amount, LM balance stays unchanged
			expect(await loanToken.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount.mul(new BN("2")));
		});

		it("Should remove the pool tokens from the liquidity mining pool and burn them", async () => {
			let userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
			const tx = await loanToken.burn(lender, userInfo.amount, true);
			userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
			// expected: user pool token balance stayed the same but LM balance is 0
			expect(await loanToken.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal("0");
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount);
			// expect the Burn event to mention the lender
			expectEvent(tx, "Burn", {
				burner: lender,
				tokenAmount: depositAmount,
				assetAmount: depositAmount,
			});
		});

		it("Should burn pool tokens without removing them from the LM pool", async () => {
			await loanToken.burn(lender, depositAmount, false);
			expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
			expect(await loanToken.totalSupply()).bignumber.equal("0");
		});
	});

	describe("Test WRBTC lending with liquidity mining", () => {
		it("Should lend to the pool and deposit the pool tokens at the liquidity mining contract", async () => {
			// await lend_to_the_pool(loanToken, lender, SUSD, WRBTC, sovryn);
			const tx = await loanTokenWRBTC.mintWithBTC(lender, true, { value: depositAmount });
			const userInfo = await liquidityMining.getUserInfo(loanTokenWRBTC.address, lender);
			// expected: user pool token balance is 0, but balance of LM contract increased
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount);
			// expect the Mint event to mention the lender
			expectEvent(tx, "Mint", {
				minter: lender,
				tokenAmount: depositAmount,
				assetAmount: depositAmount,
			});
		});

		it("Should lend to the pool without depositing the pool tokens at the liquidity mining contract", async () => {
			await loanTokenWRBTC.mintWithBTC(lender, false, { value: depositAmount });
			const userInfo = await liquidityMining.getUserInfo(loanTokenWRBTC.address, lender);
			// expected: user pool token balance increased by the deposited amount, LM balance stays unchanged
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount.mul(new BN("2")));
		});

		it("Should remove the pool tokens from the liquidity mining pool and burn them", async () => {
			let userInfo = await liquidityMining.getUserInfo(loanTokenWRBTC.address, lender);
			const tx = await loanTokenWRBTC.burnToBTC(lender, userInfo.amount, true);
			userInfo = await liquidityMining.getUserInfo(loanTokenWRBTC.address, lender);
			// expected: user pool token balance stayed the same but LM balance is 0
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal("0");
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount);
			// expect the Burn event to mention the lender
			expectEvent(tx, "Burn", {
				burner: lender,
				tokenAmount: depositAmount,
				assetAmount: depositAmount,
			});
		});

		it("Should burn pool tokens without removing them from the LM pool", async () => {
			await loanTokenWRBTC.burnToBTC(lender, depositAmount, false);
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal("0");
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal("0");
		});
	});

	describe("Test setting the liquidity mining address", () => {
		it("Should be able to set the liquidity mining address", async () => {
			await loanToken.setLiquidityMiningAddress(account2);
			expect(await loanToken.getLiquidityMiningAddress()).to.be.equal(account2);
		});

		it("Should fail to set the liquidity mining address with an unauthorized wallet", async () => {
			await expectRevert(loanToken.setLiquidityMiningAddress(account2, { from: account1 }), "unauthorized");
		});
	});

	async function deployLiquidityMining() {
		lockedSOVAdmins = [lender, account1, account2];
		// account 1 is a dummy value for the vesting registry
		lockedSOV = await LockedSOV.new(SOV.address, account1, 1, 10, lockedSOVAdmins);

		let liquidityMiningLogic = await LiquidityMiningLogic.new();
		let liquidityMiningProxy = await LiquidityMiningProxy.new();
		await liquidityMiningProxy.setImplementation(liquidityMiningLogic.address);
		liquidityMining = await LiquidityMiningLogic.at(liquidityMiningProxy.address);

		// dummy settings
		await liquidityMining.initialize(SOV.address, 10, 1, 1, account1, lockedSOV.address, 0);
	}

	async function deployProtocol() {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		await sovryn.setSovrynProtocolAddress(sovryn.address);

		// Custom tokens
		SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);

		feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
		await feeds.setRates(SUSD.address, WRBTC.address, wei("0.01", "ether"));
		await sovryn.setSupportedTokens([SUSD.address, WRBTC.address], [true, true]);
		await sovryn.setFeesController(lender);
	}

	async function deployLoanTokens() {
		const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
		loanTokenLogicLM = initLoanTokenLogic[0];
		loanTokenLogicBeaconLM = initLoanTokenLogic[1];

		loanToken = await LoanToken.new(lender, loanTokenLogicLM.address, sovryn.address, WRBTC.address);
		await loanToken.initialize(SUSD.address, name, symbol); //iToken

		/** Initialize the loan token logic proxy */
		loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
		await loanToken.setBeaconAddress(loanTokenLogicBeaconLM.address);

		/** Use interface of LoanTokenModules */
		loanToken = await ILoanTokenModules.at(loanToken.address);

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			lender, // address owner; // owner of this object
			SUSD.address, // address loanToken; // the token being loaned
			WRBTC.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		await loanToken.setupLoanParams([params], false);

		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (lender == (await sovryn.owner())) await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

		// --------------- WRBTC -----------------------//

		const initLoanTokenLogicWrbtc = await getLoanTokenLogicWrbtc(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
		loanTokenLogicWrbtc = initLoanTokenLogicWrbtc[0];
		loanTokenLogicBeaconWrbtc = initLoanTokenLogicWrbtc[1];

		loanTokenWRBTC = await LoanToken.new(lender, loanTokenLogicWrbtc.address, sovryn.address, WRBTC.address);
		await loanTokenWRBTC.initialize(WRBTC.address, "iRBTC", "iRBTC");

		/** Initialize the loan token logic proxy */
		loanTokenWRBTC = await ILoanTokenLogicProxy.at(loanTokenWRBTC.address);
		await loanTokenWRBTC.setBeaconAddress(loanTokenLogicBeaconWrbtc.address);

		/** Use interface of LoanTokenModules */
		loanTokenWRBTC = await ILoanTokenModules.at(loanTokenWRBTC.address);

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			lender, // address owner; // owner of this object
			WRBTC.address, // address loanToken; // the token being loaned
			SUSD.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		await loanTokenWRBTC.setupLoanParams([params], false);
		await sovryn.setLoanPool([loanTokenWRBTC.address], [WRBTC.address]);

		// ---------------- SUPPLY FUNDS TO PROTOCOL ---------------------//
		await WRBTC.mint(sovryn.address, wei("500", "ether"));
		await SUSD.mint(sovryn.address, wei("50000", "ether"));
	}
});
