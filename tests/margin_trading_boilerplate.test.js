/** Speed optimized on branch hardhatTestRefactor, 2021-09-30
 * Greatest potential bottleneck found on beforeEach hook, redeploying protocol
 *   but there is only one test, so optimization is not effective.
 *
 * Total time elapsed: 4.9s
 *
 * Other minor optimizations:
 * - removed unused modules and lines of code
 *
 * Notes: Applied fixture to avoid potential redeployment and redundant setups.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use WRBTC as collateral token, instead of custom WRBTC.
 *   Updated to use SOV deployment from initializer.js
 */

const { assert } = require("chai");
const { expect, waffle } = require("hardhat");
const { loadFixture } = waffle;
// const hre = require("hardhat"); access to the hardhat engine if needed
// const { encodeParameters, etherMantissa, mineBlock, increaseTime, blockNumber, sendFallback } = require("./utilities/ethereum"); useful utilities

const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const LoanToken = artifacts.require("LoanToken");
const TestToken = artifacts.require("TestToken");

const { constants } = require("@openzeppelin/test-helpers");

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
} = require("./Utils/initializer.js");

contract("Margin Trading with Affiliates boilerplate", (accounts) => {
	let loanTokenLogic;
	let WRBTC;
	let doc;
	let sovryn;
	let loanTokenV2;
	let wei = web3.utils.toWei;

	async function deploymentAndInitFixture(_wallets, _provider) {
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
		doc = await TestToken.new("dollar on chain", "DOC", 18, web3.utils.toWei("20000", "ether"));

		// Loan Pool
		loanTokenLogic = await LoanTokenLogicLM.new();
		loanToken = await LoanToken.new(owner, loanTokenLogic.address, sovryn.address, WRBTC.address);
		await loanToken.initialize(doc.address, "SUSD", "SUSD");
		loanTokenV2 = await LoanTokenLogicLM.at(loanToken.address);
		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (owner == (await sovryn.owner())) {
			await sovryn.setLoanPool([loanTokenV2.address], [loanTokenAddress]);
		}

		// initializing
		await priceFeeds.setRates(doc.address, WRBTC.address, wei("0.01", "ether"));
		await sovryn.setSupportedTokens([doc.address, WRBTC.address], [true, true]);
		await sovryn.setFeesController(owner);

		{
			/**
			struct LoanParams {
				bytes32 id; // id of loan params object
				bool active; // if false, this object has been disabled by the owner and can't be used for future loans
				address owner; // owner of this object
				address loanToken; // the token being loaned
				address collateralToken; // the required collateral token
				uint256 minInitialMargin; // the minimum allowed initial margin
				uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
				uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
			}
		*/
		}
		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			owner, // address owner; // owner of this object
			doc.address, // address loanToken; // the token being loaned
			WRBTC.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		await loanTokenV2.setupLoanParams([params], true);
		await loanTokenV2.setupLoanParams([params], false);

		// setting up interest rates
		const baseRate = wei("1", "ether");
		const rateMultiplier = wei("20.25", "ether");
		const targetLevel = wei("80", "ether");
		const kinkLevel = wei("90", "ether");
		const maxScaleRate = wei("100", "ether");
		await loanTokenV2.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);

		// GIVING SOME DOC tokens to loanToken so that we can borrow from loanToken
		await doc.transfer(loanTokenV2.address, wei("500", "ether"));
		await doc.approve(loanToken.address, web3.utils.toWei("20", "ether"));
	}

	before(async () => {
		[owner, trader, referrer, account1, account2, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	it("Margin trading  with 3X leverage with DOC token and topUp position by 12rwBTC", async () => {
		// Setting up interest rates
		// Giving some WRBTC to sovrynAddress (by minting some WRBTC), so that it can open position in wRBTC.
		await WRBTC.mint(sovryn.address, wei("500", "ether"));

		assert.equal(await sovryn.protocolAddress(), sovryn.address);

		const leverageAmount = web3.utils.toWei("3", "ether");
		const loanTokenSent = web3.utils.toWei("20", "ether");

		await loanTokenV2.marginTrade(
			constants.ZERO_BYTES32, // loanId  (0 for new loans)
			leverageAmount, // leverageAmount
			loanTokenSent, // loanTokenSent
			0, // no collateral token sent
			WRBTC.address, // collateralTokenAddress
			owner, // trader
			//referrer, // affiliates referrer
			0,
			"0x", // loanDataBytes (only required with ether)
			{ from: owner }
		);
		expect(await sovryn.getUserNotFirstTradeFlag(owner), "sovryn.getUserNotFirstTradeFlag(trader) should be true").to.be.true;
	});
});
