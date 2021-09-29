/** Speed optimized on branch hardhatTestRefactor, 2021-09-23
 * Bottlenecks found at beforeEach hook, redeploying token,
 *  protocol and loan on every test.
 *
 * Total time elapsed: 4.9s
 * After optimization: 4.5s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use SUSD as underlying token, instead of custom underlyingToken.
 *   Updated to use WRBTC as collateral token, instead of custom testWrbtc.
 */

const { assert } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectEvent, constants, ether } = require("@openzeppelin/test-helpers");

const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicWrbtc = artifacts.require("LoanTokenLogicWrbtc");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplLocal = artifacts.require("SwapsImplLocal");

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

contract("LoanSettingsEvents", (accounts) => {
	let lender;
	let SUSD, WRBTC;
	let sovryn, loanToken;
	let loanParams, loanParamsId, tx;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		await sovryn.setSovrynProtocolAddress(sovryn.address);

		feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
		await feeds.setRates(SUSD.address, WRBTC.address, ether("0.01"));
		const swaps = await SwapsImplLocal.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([SUSD.address, WRBTC.address], [true, true]);
		await sovryn.setPriceFeedContract(
			feeds.address // priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swaps.address // swapsImpl
		);
		await sovryn.setFeesController(lender);

		loanTokenLogicWrbtc = await LoanTokenLogicWrbtc.new();
		loanToken = await LoanToken.new(lender, loanTokenLogicWrbtc.address, sovryn.address, WRBTC.address);
		await loanToken.initialize(WRBTC.address, "iWRBTC", "iWRBTC"); // iToken
		loanToken = await LoanTokenLogicWrbtc.at(loanToken.address);

		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (lender == (await sovryn.owner())) await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

		await WRBTC.mint(sovryn.address, ether("500"));

		loanParams = {
			id: "0x0000000000000000000000000000000000000000000000000000000000000000",
			active: false,
			owner: constants.ZERO_ADDRESS,
			loanToken: SUSD.address,
			collateralToken: WRBTC.address,
			minInitialMargin: ether("50"),
			maintenanceMargin: ether("15"),
			maxLoanTerm: "2419200",
		};
	}

	before(async () => {
		[lender, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("test LoanSettingsEvents", async () => {
		it("test setupLoanParamsEvents", async () => {
			tx = await sovryn.setupLoanParams([Object.values(loanParams)]);

			await expectEvent(tx, "LoanParamsIdSetup", { owner: lender });
			assert(tx.logs[1]["id"] != "0x0");

			await expectEvent(tx, "LoanParamsSetup", {
				owner: lender,
				loanToken: SUSD.address,
				collateralToken: WRBTC.address,
				minInitialMargin: ether("50"),
				maintenanceMargin: ether("15"),
				maxLoanTerm: "2419200",
			});
			assert(tx.logs[0]["id"] != "0x0");
		});

		it("test disableLoanParamsEvents", async () => {
			tx = await sovryn.setupLoanParams([Object.values(loanParams)]);
			loanParamsId = tx.logs[1].args.id;

			tx = await sovryn.disableLoanParams([loanParamsId], { from: lender });

			await expectEvent(tx, "LoanParamsIdDisabled", { owner: lender });
			assert(tx.logs[1]["id"] != "0x0");

			await expectEvent(tx, "LoanParamsDisabled", {
				owner: lender,
				loanToken: SUSD.address,
				collateralToken: WRBTC.address,
				minInitialMargin: ether("50"),
				maintenanceMargin: ether("15"),
				maxLoanTerm: "2419200",
			});
			assert(tx.logs[0]["id"] != "0x0");
		});
	});
});
