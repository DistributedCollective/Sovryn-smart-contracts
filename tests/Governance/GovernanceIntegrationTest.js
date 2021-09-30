/** Speed optimized on branch hardhatTestRefactor, 2021-09-23
 * Bottlenecks found at beforeEach hook, redeploying SUSD,
 *  staking and governor on each test.
 *
 * Total time elapsed: 5.7s
 * After optimization: 5.4s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use SUSD as underlying token, instead of custom token.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

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

const { ZERO_ADDRESS } = constants;

const { encodeParameters, etherMantissa, mineBlock, increaseTime } = require("../Utils/Ethereum");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("TimelockHarness");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");

const LoanTokenSettings = artifacts.require("LoanTokenSettingsLowerAdmin");
const LoanToken = artifacts.require("LoanToken");

const QUORUM_VOTES = etherMantissa(4000000);

const TWO_DAYS = 86400 * 2;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

contract("GovernanceIntegration", (accounts) => {
	let root, account1, account2, account3, account4;
	let SUSD, staking, gov, timelock;
	let sovryn;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		await sovryn.setSovrynProtocolAddress(sovryn.address);

		// Staking
		let stakingLogic = await StakingLogic.new(SUSD.address);
		staking = await StakingProxy.new(SUSD.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		// Governor
		timelock = await Timelock.new(root, TWO_DAYS);
		gov = await GovernorAlpha.new(timelock.address, staking.address, root, 4, 0);
		await timelock.harnessSetAdmin(gov.address);

		// Settings
		loanTokenSettings = await LoanTokenSettings.new();
		loanToken = await LoanToken.new(root, loanTokenSettings.address, SUSD.address, SUSD.address);
		loanToken = await LoanTokenSettings.at(loanToken.address);
		await loanToken.transferOwnership(timelock.address);

		await sovryn.transferOwnership(timelock.address);
	}

	before(async () => {
		[root, account1, account2, account3, account4, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("change settings", () => {
		it("Should be able to execute one action", async () => {
			let lendingFeePercentOld = etherMantissa(10).toString();
			let lendingFeePercentNew = etherMantissa(7).toString();

			let proposalData = {
				targets: [sovryn.address],
				values: [0],
				signatures: ["setLendingFeePercent(uint256)"],
				callDatas: [encodeParameters(["uint256"], [lendingFeePercentNew])],
				description: "change settings",
			};

			// old value
			let lendingFeePercent = await sovryn.lendingFeePercent.call();
			expect(lendingFeePercent.toString()).to.be.equal(lendingFeePercentOld);

			// make changes
			await executeProposal(proposalData);

			// new value
			lendingFeePercent = await sovryn.lendingFeePercent.call();
			expect(lendingFeePercent.toString()).to.be.equal(lendingFeePercentNew);
		});

		it("Should be able to execute one action with signature in the call data", async () => {
			let lendingFeePercentOld = etherMantissa(10).toString();
			let lendingFeePercentNew = etherMantissa(7).toString();

			let selector = web3.utils.keccak256("setLendingFeePercent(uint256)").substring(0, 10);
			let callData = encodeParameters(["uint256"], [lendingFeePercentNew]).replace("0x", selector);

			let proposalData = {
				targets: [sovryn.address],
				values: [0],
				signatures: [""],
				callDatas: [callData],
				description: "change settings",
			};

			// old value
			let lendingFeePercent = await sovryn.lendingFeePercent.call();
			expect(lendingFeePercent.toString()).to.be.equal(lendingFeePercentOld);

			// make changes
			await executeProposal(proposalData);

			// new value
			lendingFeePercent = await sovryn.lendingFeePercent.call();
			expect(lendingFeePercent.toString()).to.be.equal(lendingFeePercentNew);
		});

		it("Should be able to execute three actions", async () => {
			let tradingFeePercentOld = etherMantissa(15, 1e16).toString();
			let tradingFeePercentNew = etherMantissa(9, 1e16).toString();

			let proposalData = {
				targets: [sovryn.address, sovryn.address /*, loanToken.address*/],
				values: [0, 0 /*, 0*/],
				signatures: [
					"setTradingFeePercent(uint256)",
					"setLoanPool(address[],address[])",
					/*"setTransactionLimits(address[],uint256[])",*/
				],
				callDatas: [
					encodeParameters(["uint256"], [tradingFeePercentNew]),
					encodeParameters(
						["address[]", "address[]"],
						[
							[account1, account2],
							[account3, account4],
						]
					),
					/*encodeParameters(
						["address[]", "uint256[]"],
						[
							[account1, account2],
							[1111, 2222],
						]
					),*/
				],
				description: "change settings",
			};

			// old values
			let tradingFeePercent = await sovryn.tradingFeePercent.call();
			expect(tradingFeePercent.toString()).to.be.equal(tradingFeePercentOld);

			expect(await sovryn.loanPoolToUnderlying.call(account1)).to.be.equal(ZERO_ADDRESS);
			expect(await sovryn.loanPoolToUnderlying.call(account2)).to.be.equal(ZERO_ADDRESS);
			expect(await sovryn.underlyingToLoanPool.call(account3)).to.be.equal(ZERO_ADDRESS);
			expect(await sovryn.underlyingToLoanPool.call(account4)).to.be.equal(ZERO_ADDRESS);

			// expect((await loanToken.transactionLimit.call(account1)).toNumber()).to.be.equal(0);
			// expect((await loanToken.transactionLimit.call(account2)).toNumber()).to.be.equal(0);

			// make changes
			await executeProposal(proposalData);

			// new values
			tradingFeePercent = await sovryn.tradingFeePercent.call();
			expect(tradingFeePercent.toString()).to.be.equal(tradingFeePercentNew);

			expect(await sovryn.loanPoolToUnderlying.call(account1)).to.be.equal(account3);
			expect(await sovryn.loanPoolToUnderlying.call(account2)).to.be.equal(account4);
			expect(await sovryn.underlyingToLoanPool.call(account3)).to.be.equal(account1);
			expect(await sovryn.underlyingToLoanPool.call(account4)).to.be.equal(account2);

			// expect((await loanToken.transactionLimit.call(account1)).toNumber()).to.be.equal(1111);
			// expect((await loanToken.transactionLimit.call(account2)).toNumber()).to.be.equal(2222);
		});

		it("Shouldn't be able to execute proposal using Timelock directly", async () => {
			await expectRevert(
				timelock.executeTransaction(ZERO_ADDRESS, "0", "", "0x", "0"),
				"Timelock::executeTransaction: Call must come from admin."
			);
		});
	});

	async function executeProposal(proposalData) {
		await SUSD.approve(staking.address, QUORUM_VOTES);
		let kickoffTS = await staking.kickoffTS.call();
		await staking.stake(QUORUM_VOTES, kickoffTS.add(MAX_DURATION), root, root);

		await gov.propose(
			proposalData.targets,
			proposalData.values,
			proposalData.signatures,
			proposalData.callDatas,
			proposalData.description
		);
		let proposalId = await gov.latestProposalIds.call(root);

		await mineBlock();
		await gov.castVote(proposalId, true);

		await advanceBlocks(10);
		await gov.queue(proposalId);

		await increaseTime(TWO_DAYS);
		let tx = await gov.execute(proposalId);

		expectEvent(tx, "ProposalExecuted", {
			id: proposalId,
		});
	}
});

async function advanceBlocks(number) {
	for (let i = 0; i < number; i++) {
		await mineBlock();
	}
}
