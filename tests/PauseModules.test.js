/** Speed optimized on branch hardhatTestRefactor, 2021-09-13
 * Greatest bottlenecks found at:
 * 	- fixtureInitialize (3s)
 * 		Due to fixture load and a it contains a large deployment
 * 	- Pause LoanClosingBase test (267ms)
 * 		Due to requiring a call to setup_rollover_test as initialization
 * Total time elapsed: 4s
 *
 * Other minor optimizations:
 *  - removed unused modules and variables:
 *      Wallet, Contract, balance, verify_sov_reward_payment, signers, ethers
 *  - removed two redundant SOV deployments
 *  - reformatted code comments
 *  - reordered external modules apart from local variables
 *
 * Notes:
 * 	Previous optimization by Tyrone adding a waffle fixture (loadFixture)
 *  improved a 20% the code speed:
 * 		reduced total elapsed time from 5s to 4s
 *  Updated to use only the initializer.js functions for protocol deployment.
 *  Updated to use SUSD as underlying token.
 */

const { assert, expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { BN, constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { increaseTime, blockNumber } = require("./Utils/Ethereum");
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

const TestToken = artifacts.require("TestToken");
const LockedSOV = artifacts.require("LockedSOVMockup");
const MockLoanTokenLogic = artifacts.require("MockLoanTokenLogic");
const TestWrbtc = artifacts.require("TestWrbtc");
const LoanToken = artifacts.require("LoanToken");
const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");
const TestCoverage = artifacts.require("TestCoverage");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

contract("Pause Modules", (accounts) => {
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, SOV;
	let loanParams, loanParamsId;
	/// @note https://stackoverflow.com/questions/68182729/implementing-fixtures-with-nomiclabs-hardhat-waffle
	async function fixtureInitialize(_wallets, _provider) {
		SUSD = await getSUSD(); // Underlying Token
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		const loanTokenLogicStandard = await getLoanTokenLogic();
		const loanTokenLogicWrbtc = await getLoanTokenLogicWrbtc();
		loanToken = await getLoanToken(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(loanTokenLogicWrbtc, owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);
		SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);

		loanParams = {
			id: "0x0000000000000000000000000000000000000000000000000000000000000000",
			active: false,
			owner: constants.ZERO_ADDRESS,
			loanToken: SUSD.address,
			collateralToken: loanTokenWRBTC.address,
			minInitialMargin: wei("50", "ether"),
			maintenanceMargin: wei("15", "ether"),
			maxLoanTerm: "2419200",
		};
	}

	before(async () => {
		[owner, trader, referrer, account1, account2, ...accounts] = accounts;
		await loadFixture(fixtureInitialize);
	});

	const setup_rollover_test = async (RBTC, SUSD, accounts, loanToken, set_demand_curve, sovryn) => {
		await set_demand_curve(loanToken);
		await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
		const lender = accounts[0];
		const borrower = accounts[1];
		let tx = await sovryn.togglePaused(false); // Unpaused
		await expectEvent(tx, "TogglePaused", {
			sender: owner,
			oldFlag: true,
			newFlag: false,
		});
		await loanToken.mint(lender, new BN(10).pow(new BN(30)));
		const loan_token_sent = hunEth;
		await SUSD.mint(borrower, loan_token_sent);
		await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });
		const { receipt } = await loanToken.marginTrade(
			"0x0", // loanId  (0 for new loans)
			new BN(2).mul(oneEth), // leverageAmount
			loan_token_sent, // loanTokenSent
			0, // no collateral token sent
			RBTC.address, // collateralTokenAddress
			borrower, // trader,
			0, // slippage
			"0x", // loanDataBytes (only required with ether)
			{ from: borrower }
		);

		const decode = decodeLogs(receipt.rawLogs, LoanOpeningsEvents, "Trade");
		const loan_id = decode[0].args["loanId"];
		const loan = await sovryn.getLoan(loan_id);
		const num = await blockNumber();
		let currentBlock = await web3.eth.getBlock(num);
		const block_timestamp = currentBlock.timestamp;
		const time_until_loan_end = loan["endTimestamp"] - block_timestamp;
		await increaseTime(time_until_loan_end);
		return [borrower, loan, loan_id, parseInt(loan["endTimestamp"])];
	};

	describe("Pause Affiliates", () => {
		it("Should pause setting Affiliates referrer", async () => {
			loanTokenLogic = await MockLoanTokenLogic.new();
			testWrbtc = await TestWrbtc.new();
			doc = await TestToken.new("dollar on chain", "DOC", 18, wei("20000", "ether"));
			loanTokenV1 = await LoanToken.new(owner, loanTokenLogic.address, sovryn.address, testWrbtc.address);
			await loanTokenV1.initialize(doc.address, "SUSD", "SUSD");
			loanTokenV2 = await MockLoanTokenLogic.at(loanTokenV1.address);
			const loanTokenAddress = await loanTokenV1.loanTokenAddress();
			if (owner == (await sovryn.owner())) {
				await sovryn.setLoanPool([loanTokenV2.address], [loanTokenAddress]);
			}
			let tx = await sovryn.togglePaused(true); // Paused
			await expectRevert(sovryn.togglePaused(true), "Can't toggle");
			await expectEvent(tx, "TogglePaused", {
				sender: owner,
				oldFlag: false,
				newFlag: true,
			});
			await expectRevert(loanTokenV2.setAffiliatesReferrer(trader, referrer), "Paused");
		});
	});

	describe("Pause LoanClosingBase", () => {
		it("Test rollover reward payment", async () => {
			// prepare the test
			const [, initial_loan, loan_id] = await setup_rollover_test(RBTC, SUSD, accounts, loanToken, set_demand_curve, sovryn);

			const num = await blockNumber();
			let currentBlock = await web3.eth.getBlock(num);
			const block_timestamp = currentBlock.timestamp;
			const time_until_loan_end = initial_loan["endTimestamp"] - block_timestamp;
			await increaseTime(time_until_loan_end);

			const receiver = accounts[3];
			expect((await RBTC.balanceOf(receiver)).toNumber() == 0).to.be.true;
			let tx = await sovryn.togglePaused(true); // Paused
			await expectEvent(tx, "TogglePaused", {
				sender: owner,
				oldFlag: false,
				newFlag: true,
			});
			await expectRevert(sovryn.rollover(loan_id, "0x", { from: receiver }), "Paused");
		});
	});

	describe("Pause ProtocolSettings", () => {
		it("Should pause setting SOV token address", async () => {
			await expectRevert(sovryn.setSOVTokenAddress(SOV.address), "Paused");
		});

		it("Should pause setting LockedSOV token address", async () => {
			const lockedSOV = await LockedSOV.new(SOV.address, [accounts[0]]);
			await expectRevert(sovryn.setLockedSOVAddress(lockedSOV.address), "Paused");
		});

		it("Should pause setting affiliate fee percent", async () => {
			const affiliateFeePercent = web3.utils.toWei("20", "ether");
			await expectRevert(sovryn.setAffiliateFeePercent(affiliateFeePercent), "Paused");
		});

		it("Should pause setting affiliate fee percent", async () => {
			const affiliateTradingTokenFeePercent = web3.utils.toWei("20", "ether");
			await expectRevert(sovryn.setAffiliateTradingTokenFeePercent(affiliateTradingTokenFeePercent), "Paused");
		});

		it("Should set affiliate fee percent when Unpaused", async () => {
			let tx = await sovryn.togglePaused(false); // Unpaused
			await expectRevert(sovryn.togglePaused(false), "Can't toggle");
			await expectEvent(tx, "TogglePaused", {
				sender: owner,
				oldFlag: true,
				newFlag: false,
			});
			const affiliateTradingTokenFeePercent = web3.utils.toWei("20", "ether");
			const invalidAffiliateTradingTokenFeePercent = web3.utils.toWei("101", "ether");
			// Should revert if set with non owner
			await expectRevert(
				sovryn.setAffiliateTradingTokenFeePercent(affiliateTradingTokenFeePercent, { from: accounts[1] }),
				"unauthorized"
			);
			// Should revert if value too high
			await expectRevert(sovryn.setAffiliateTradingTokenFeePercent(invalidAffiliateTradingTokenFeePercent), "value too high");

			await sovryn.setAffiliateTradingTokenFeePercent(affiliateTradingTokenFeePercent);
			expect((await sovryn.affiliateTradingTokenFeePercent()).toString() == affiliateTradingTokenFeePercent).to.be.true;
		});
	});
	describe("Pause LoanSettings", () => {
		it("Able to setupLoanParams & disableLoanParamsEvents when unpaused", async () => {
			let tx = await sovryn.setupLoanParams([Object.values(loanParams)]);
			loanParamsId = tx.logs[1].args.id;

			tx = await sovryn.disableLoanParams([loanParamsId], { from: owner });

			await expectEvent(tx, "LoanParamsIdDisabled", { owner: owner });
			assert(tx.logs[1]["id"] != "0x0");

			await expectEvent(tx, "LoanParamsDisabled", {
				owner: owner,
				loanToken: SUSD.address,
				collateralToken: loanTokenWRBTC.address,
				minInitialMargin: wei("50", "ether"),
				maintenanceMargin: wei("15", "ether"),
				maxLoanTerm: "2419200",
			});
			assert(tx.logs[0]["id"] != "0x0");
		});

		it("setupLoanParams & disableLoanParamsEvents freezes when protocol is paused", async () => {
			let tx = await sovryn.togglePaused(true); // Paused
			await expectEvent(tx, "TogglePaused", {
				sender: owner,
				oldFlag: false,
				newFlag: true,
			});
			await expectRevert(sovryn.setupLoanParams([Object.values(loanParams)]), "Paused");
		});
	});

	describe("Testing isProtocolPaused()", () => {
		it("isProtocolPaused() returns correct result when toggling pause/unpause", async () => {
			await loadFixture(fixtureInitialize);
			await sovryn.togglePaused(true);
			expect(await sovryn.isProtocolPaused()).to.be.true;

			// Check deterministic result when trying to set current value
			expectRevert.unspecified(sovryn.togglePaused(true));
			expect(await sovryn.isProtocolPaused()).to.be.true;

			// Pause true -> false
			await sovryn.togglePaused(false);
			expect(await sovryn.isProtocolPaused()).to.be.false;
			expectRevert.unspecified(sovryn.togglePaused(false));
			expect(await sovryn.isProtocolPaused()).to.be.false;

			// Pause false -> true
			await sovryn.togglePaused(true);
			expect(await sovryn.isProtocolPaused()).to.be.true;
		});
	});

	describe("Testing Pausable contract", () => {
		it("Pausable function runs if not paused", async () => {
			testCoverage = await TestCoverage.new();
			await testCoverage.dummyPausableFunction();
		});
		it("Pausable function reverts if paused", async () => {
			testCoverage = await TestCoverage.new();
			await testCoverage.togglePause("dummyPausableFunction()", true);
			await expectRevert(testCoverage.dummyPausableFunction(), "unauthorized");
		});
	});
});
