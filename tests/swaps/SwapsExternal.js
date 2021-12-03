/** Speed optimized on branch hardhatTestRefactor, 2021-09-30
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 14.5s
 * After optimization: 6.2s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use WRBTC as collateral token, instead of custom testWRBTC token.
 *   Updated to use SUSD as underlying token, instead of custom underlyingToken.
 *   Updated to use the initializer.js functions for protocol token deployment.
 */

const { expectRevert, expectEvent, BN, constants } = require("@openzeppelin/test-helpers");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const LockedSOV = artifacts.require("LockedSOV");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const LoanTokenLogicWrbtc = artifacts.require("LoanTokenLogicWrbtc");
const SwapsExternal = artifacts.require("SwapsExternal");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");

const StakingLogic = artifacts.require("StakingMockup");
const StakingProxy = artifacts.require("StakingProxy");

const FeeSharingLogic = artifacts.require("FeeSharingLogic");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");

const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry3");
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
const { etherGasCost } = require("../Utils/Ethereum.js");

const { ZERO_ADDRESS } = constants;
const wei = web3.utils.toWei;
const hunEth = new BN(wei("100", "ether"));
const TWO_WEEKS = 86400 * 14;
let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.

contract("SwapsExternal", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let lender;
	let SUSD, WRBTC;
	let sovryn, loanToken;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		await sovryn.setSovrynProtocolAddress(sovryn.address);

		SOVToken = await getSOV(sovryn, priceFeeds, SUSD, accounts);

		// Overwritting priceFeeds
		priceFeeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
		await priceFeeds.setRates(SUSD.address, WRBTC.address, wei("1", "ether"));
		const sovrynSwapSimulator = await TestSovrynSwap.new(priceFeeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([SUSD.address, WRBTC.address], [true, true]);

		await sovryn.setFeesController(lender);
		await sovryn.setSwapExternalFeePercent(wei("10", "ether"));

		const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
		loanTokenLogic = initLoanTokenLogic[0];
		loanTokenLogicBeacon = initLoanTokenLogic[1];

		loanToken = await LoanToken.new(lender, loanTokenLogic.address, sovryn.address, WRBTC.address);
		await loanToken.initialize(SUSD.address, name, symbol); // iToken

		/** Initialize the loan token logic proxy */
		loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
		await loanToken.setBeaconAddress(loanTokenLogicBeacon.address);

		/** Use interface of LoanTokenModules */
		loanToken = await ILoanTokenModules.at(loanToken.address);

		// Staking
		let stakingLogic = await StakingLogic.new(SUSD.address);
		staking = await StakingProxy.new(SUSD.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		// FeeSharingProxy
		feeSharingLogic = await FeeSharingLogic.new();
		feeSharingProxyObj = await FeeSharingProxy.new(sovryn.address, staking.address);
		await feeSharingProxyObj.setImplementation(feeSharingLogic.address);
		feeSharingProxy = await FeeSharingLogic.at(feeSharingProxyObj.address);
		await sovryn.setFeesController(feeSharingProxy.address);

		// Set loan pool for wRBTC -- because our fee sharing proxy required the loanPool of wRBTC
		loanTokenLogicWrbtc = await LoanTokenLogicWrbtc.new();
		loanTokenWrbtc = await LoanToken.new(accounts[0], loanTokenLogicWrbtc.address, sovryn.address, WRBTC.address);
		await loanTokenWrbtc.initialize(WRBTC.address, "iWRBTC", "iWRBTC");

		loanTokenWrbtc = await LoanTokenLogicWrbtc.at(loanTokenWrbtc.address);
		const loanTokenAddressWrbtc = await loanTokenWrbtc.loanTokenAddress();
		await sovryn.setLoanPool([loanTokenWrbtc.address], [loanTokenAddressWrbtc]);

		await WRBTC.mint(sovryn.address, wei("500", "ether"));

		// Creating the Vesting Instance.
		vestingLogic = await VestingLogic.new();
		vestingFactory = await VestingFactory.new(vestingLogic.address);
		vestingRegistry = await VestingRegistry.new(
			vestingFactory.address,
			SOVToken.address,
			staking.address,
			feeSharingProxy.address,
			lender // This should be Governance Timelock Contract.
		);
		vestingFactory.transferOwnership(vestingRegistry.address);

		await sovryn.setLockedSOVAddress(
			(await LockedSOV.new(SOVToken.address, vestingRegistry.address, cliff, duration, [lender])).address
		);

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

		await WRBTC.mint(sovryn.address, wei("500", "ether"));
	}

	before(async () => {
		[lender, staker] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("SwapsExternal - Swap External", () => {
		it("Doesn't allow fallback function calls", async () => {
			const swapsExternal = await SwapsExternal.new();
			await expectRevert(
				swapsExternal.send(wei("0.0000000000000001", "ether")),
				"fallback function is not payable and was called with value 100"
			);
			await expectRevert(swapsExternal.sendTransaction({}), "fallback not allowed");
		});

		it("Doesn't allow swaps if source token amount = 0", async () => {
			await expectRevert(
				sovryn.swapExternal(SUSD.address, WRBTC.address, accounts[0], accounts[0], 0, 0, 0, "0x"),
				"sourceTokenAmount == 0"
			);
		});

		it("Doesn't allow swaps without enough allowance", async () => {
			await expectRevert(
				sovryn.swapExternal(SUSD.address, WRBTC.address, accounts[0], accounts[0], hunEth, 0, 0, "0x"),
				"SafeERC20: low-level call failed"
			);
		});

		it("Doesn't allow swaps if token address contract unavailable", async () => {
			await expectRevert(
				sovryn.swapExternal(ZERO_ADDRESS, WRBTC.address, accounts[0], accounts[0], 100, 0, 0, "0x"),
				"call to non-contract"
			);
		});

		it("Doesn't allow swaps if source token address is missing", async () => {
			const assetBalance = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());
			await expectRevert(
				sovryn.swapExternal(ZERO_ADDRESS, WRBTC.address, accounts[0], accounts[0], wei("1", "ether"), 0, 0, "0x", {
					value: wei("1", "ether"),
				}),
				"swap failed"
			);
		});

		it("Doesn't allow swaps if destination token is zero address", async () => {
			const assetBalance = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());
			await expectRevert(sovryn.swapExternal(SUSD.address, ZERO_ADDRESS, accounts[0], accounts[0], 100, 0, 0, "0x"), "swap failed");
		});

		it("Doesn't allow source token mismatch", async () => {
			const assetBalance = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());
			await expectRevert(
				sovryn.swapExternal(SUSD.address, WRBTC.address, accounts[0], accounts[0], wei("1", "ether"), 0, 0, "0x", {
					value: wei("1", "ether"),
				}),
				"sourceToken mismatch"
			);
		});

		it("Doesn't allow source token amount mismatch", async () => {
			const assetBalance = await loanToken.assetBalanceOf(lender);
			await WRBTC.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());
			await expectRevert(
				sovryn.swapExternal(WRBTC.address, SUSD.address, accounts[0], accounts[0], wei("1", "ether"), 0, 0, "0x", {
					value: 100,
				}),
				"sourceTokenAmount mismatch"
			);
		});

		it("Check swapExternal with minReturn > 0 should revert if minReturn is not valid (higher)", async () => {
			const assetBalance = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());
			await expectRevert(
				sovryn.swapExternal(SUSD.address, WRBTC.address, accounts[0], accounts[0], wei("1", "ether"), 0, wei("10", "ether"), "0x"),
				"destTokenAmountReceived too low"
			);
		});

		it("Check swapExternal with minReturn > 0 should revert if minReturn is valid", async () => {
			const assetBalance = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());
			// feeds price is set 0.01, so test minReturn with 0.01 as well for the 1 ether swap
			const tx = await sovryn.swapExternal(
				SUSD.address,
				WRBTC.address,
				accounts[0],
				accounts[0],
				wei("1", "ether"),
				0,
				wei("0.01", "ether"),
				"0x"
			);
			const fields = await sovryn.swapExternal.call(
				SUSD.address,
				WRBTC.address,
				accounts[0],
				accounts[0],
				wei("1", "ether"),
				0,
				wei("0.01", "ether"),
				"0x"
			);
			expectEvent(tx, "ExternalSwap", {
				user: lender,
				sourceToken: SUSD.address,
				destToken: WRBTC.address,
				sourceAmount: wei("1", "ether"),
				destAmount: fields.destTokenAmountReceived.toString(),
			});

			expectEvent(tx, "PayTradingFee", {
				amount: new BN(wei("1", "ether"))
					.mul(new BN(wei("10", "ether")))
					.div(new BN(wei("100", "ether")))
					.toString(),
			});

			let destTokenAmount = await sovryn.getSwapExpectedReturn(SUSD.address, WRBTC.address, wei("1", "ether"));
			const trading_fee_percent = await sovryn.getSwapExternalFeePercent();
			const trading_fee = destTokenAmount.mul(trading_fee_percent).div(hunEth);
			let desTokenAmountAfterFee = destTokenAmount - trading_fee;
			assert.equal(desTokenAmountAfterFee, fields.destTokenAmountReceived.toString());
		});

		it("Should be able to withdraw fees", async () => {
			const assetBalance = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());
			// feeds price is set 0.01, so test minReturn with 0.01 as well for the 1 ether swap
			await sovryn.swapExternal(
				SUSD.address,
				WRBTC.address,
				accounts[0],
				accounts[0],
				wei("1", "ether"),
				0,
				wei("0.01", "ether"),
				"0x"
			);

			const fields = await sovryn.swapExternal.call(
				SUSD.address,
				WRBTC.address,
				accounts[0],
				accounts[0],
				wei("1", "ether"),
				0,
				wei("0.01", "ether"),
				"0x"
			);

			let destTokenAmount = await sovryn.getSwapExpectedReturn(SUSD.address, WRBTC.address, wei("1", "ether"));
			const trading_fee_percent = await sovryn.getSwapExternalFeePercent();
			const trading_fee = destTokenAmount.mul(trading_fee_percent).div(hunEth);
			await SUSD.transfer(sovryn.address, wei("1", "ether"));

			// stake - getPriorTotalVotingPower
			let amount = trading_fee;
			// await SUSD.transfer(lender, amount);
			await SUSD.approve(staking.address, amount, { from: lender });
			let kickoffTS = await staking.kickoffTS.call();
			await staking.stake(amount, kickoffTS.add(new BN(TWO_WEEKS)), lender, lender, { from: lender });

			const tx = await feeSharingProxy.withdrawFees([SUSD.address]);

			let swapFee = amount.mul(trading_fee_percent).div(new BN(wei("100", "ether")));

			// need to sub by swap fee because at this point, protocol will received the trading fee again.
			loanTokenWRBTCBalanceShouldBe = amount.mul(new BN(1)).sub(swapFee);

			expectEvent(tx, "FeeWithdrawn", {
				sender: lender,
				token: loanTokenWrbtc.address,
				amount: loanTokenWRBTCBalanceShouldBe,
			});
		});

		it("Check swapExternal with minReturn > 0 should revert if minReturn is valid", async () => {
			await expectRevert(
				sovryn.checkPriceDivergence(SUSD.address, WRBTC.address, wei("1", "ether"), wei("2", "ether")),
				"destTokenAmountReceived too low"
			);
		});

		it("Swap external using RBTC", async () => {
			const swapper = accounts[2];
			const underlyingBalancePrev = await SUSD.balanceOf(swapper);
			const rbtcBalancePrev = new BN(await web3.eth.getBalance(swapper));
			const assetBalance = await loanToken.assetBalanceOf(swapper);
			const rbtcValueBeingSent = 1e14;
			await SUSD.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());

			const tx = await sovryn.swapExternal(
				WRBTC.address, // source token must be wrbtc
				SUSD.address, // dest token
				swapper, // receiver
				swapper, // return to sender address
				rbtcValueBeingSent, // sourceTokenAmount
				0, // requiredDestTokenAmount
				0, // minReturn (slippage)
				"0x",
				{ value: rbtcValueBeingSent, from: swapper }
			);

			const underlyingBalanceAfter = await SUSD.balanceOf(swapper);
			const rbtcBalanceAfter = new BN(await web3.eth.getBalance(swapper));

			let event_name = "ExternalSwap";
			let decode = decodeLogs(tx.receipt.rawLogs, SwapsExternal, event_name);
			if (!decode.length) {
				throw "Event ExternalSwap is not fired properly";
			}

			const user = decode[0].args["user"];
			const sourceToken = decode[0].args["sourceToken"];
			const destToken = decode[0].args["destToken"];
			const sourceAmount = decode[0].args["sourceAmount"];
			const destAmount = decode[0].args["destAmount"];
			const txFee = new BN((await etherGasCost(tx.receipt)).toString());

			const finalUnderlyingBalance = underlyingBalanceAfter.sub(underlyingBalancePrev);
			const finalRbtcBalance = rbtcBalancePrev.sub(rbtcBalanceAfter);

			expect(user).to.be.equal(swapper);
			expect(sourceToken).to.be.equal(WRBTC.address);
			expect(destToken).to.be.equal(SUSD.address);
			expect(destAmount.toString()).to.be.equal(finalUnderlyingBalance.toString());
			expect(sourceAmount.toString()).to.be.equal(finalRbtcBalance.sub(txFee).toString());
			expect(sourceAmount.toString()).to.be.equal(rbtcValueBeingSent.toString());
		});

		it("Swap external using RBTC should failed if source token amount is not matched with rbtc being sent", async () => {
			const assetBalance = await loanToken.assetBalanceOf(lender);
			const rbtcValueBeingSent = 1e14;
			await SUSD.approve(sovryn.address, assetBalance.add(new BN(wei("10", "ether"))).toString());

			await expectRevert(
				sovryn.swapExternal(
					constants.ZERO_ADDRESS, // source token must be wrbtc
					SUSD.address, // dest token
					lender, // receiver
					lender, // return to sender address
					rbtcValueBeingSent, // sourceTokenAmount
					0, // requiredDestTokenAmount
					0, // minReturn (slippage)
					"0x",
					{ value: 2e14 }
				),
				"sourceTokenAmount mismatch"
			);
		});

		// Should fail to change swap external fee percent by invalid value (more than 100%)
		it("Test set swapExternalFeePercent with invalid value", async () => {
			await expectRevert(sovryn.setSwapExternalFeePercent(wei("101", "ether")), "value too high");
		});
	});
});
