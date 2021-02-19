const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const {
	encodeParameters,
	etherMantissa,
	mineBlock,
	increaseTime,
	blockNumber,
	setNextBlockTimestamp,
	lastBlock,
} = require("./Utils/Ethereum");

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const SOV_ABI = artifacts.require("SOV");
const TestToken = artifacts.require("TestToken");
const FeeSharingProxy = artifacts.require("FeeSharingProxyMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry");
const OriginInvestorsClaim = artifacts.require("OriginInvestorsClaim");

const ONE_WEEK = new BN(7 * 24 * 60 * 60);
const FOUR_WEEKS = ONE_WEEK.muln(4); //new BN(4 * 7 * 24 * 60 * 60);
const SIX_WEEKS = ONE_WEEK.muln(6); //new BN(6 * 7 * 24 * 60 * 60);

const VESTING_CLIFF = SIX_WEEKS;
const DURATION = VESTING_CLIFF;

const TOTAL_SUPPLY = "100000000000000000000000000";
const ONE_MILLION = "1000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const pricsSats = "2500";

contract("OriginInvestorsClaim", (accounts) => {
	let root, account1, account2, account3, investor1, investor2, investor3;
	let SOV, kickoffTS;
	let staking, stakingLogic, feeSharingProxy;
	let vestingFactory, vestingLogic, vestingRegistry, investorsClaim;
	let investors;
	let amounts, amount1, amount2, amount3;

	function getTimeFromKickoff(offset) {
		return kickoffTS.add(new BN(offset));
	}

	async function checkVestingContractCreated(txHash, investor, cliff, amount) {
		const vestingAddress = await vestingRegistry.getVesting(investor);
		await expectEvent.inTransaction(txHash, vestingRegistry, "VestingCreated", {
			tokenOwner: investor,
			vesting: vestingAddress,
			cliff: cliff,
			duration: cliff,
			amount: amount,
		});
	}

	before(async () => {
		[root, account1, account2, account3, investor1, investor2, investor3, ...accounts] = accounts;
		investors = [investor1, investor2, investor3];
		amount1 = new BN(ONE_MILLION);
		amount2 = amount1.muln(2);
		amount3 = amount1.muln(5);
		amounts = [amount1, amount2, amount3];
		//});

		//beforeEach(async () => {
		SOV = await SOV_ABI.new(TOTAL_SUPPLY);
		cSOV1 = await TestToken.new("cSOV1", "cSOV1", 18, TOTAL_SUPPLY);
		cSOV2 = await TestToken.new("cSOV2", "cSOV2", 18, TOTAL_SUPPLY);

		stakingLogic = await StakingLogic.new(SOV.address);
		staking = await StakingProxy.new(SOV.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		feeSharingProxy = await FeeSharingProxy.new(ZERO_ADDRESS, staking.address);

		vestingLogic = await VestingLogic.new();
		vestingFactory = await VestingFactory.new(vestingLogic.address);
		vestingRegistry = await VestingRegistry.new(
			vestingFactory.address,
			SOV.address,
			[cSOV1.address, cSOV2.address],
			pricsSats,
			staking.address,
			feeSharingProxy.address,
			account1
		);
		await vestingFactory.transferOwnership(vestingRegistry.address);

		kickoffTS = await staking.kickoffTS.call();

		investorsClaim = await OriginInvestorsClaim.new(vestingRegistry.address);

		await SOV.transfer(investorsClaim.address, amount1.add(amount2).add(amount3));
		await vestingRegistry.addAdmin(investorsClaim.address); //TODO: after deploy run addAdmin(OriginInvestorsClaim address)
		await investorsClaim.setInvestorsAmountsList(investors, amounts);
	});

	describe("setInvestorsList", () => {
		it("sets investors list", async () => {
			let tx = await investorsClaim.setInvestorsAmountsList(investors, amounts);
			expectEvent(tx, "InvestorsAmountsListSet", { qty: new BN(amounts.length) });
		});

		it("fails if investors.length != amounts.length", async () => {
			const investorsReduced = investors.slice(1);
			await expectRevert(
				investorsClaim.setInvestorsAmountsList(investorsReduced, amounts),
				"investors.length != claimAmounts.length"
			);
		});

		it("only authorised can whitelist investors", async () => {
			await expectRevert(investorsClaim.setInvestorsAmountsList(investors, amounts, { from: account1 }), "unauthorized");
		});
	});

	describe("process claims", () => {
		it("should create vesting contract within vesting period", async () => {
			const timeFromKickoff = getTimeFromKickoff(ONE_WEEK);
			await setNextBlockTimestamp(timeFromKickoff.toNumber());
			await SOV.transfer(vestingRegistry.address, amount1);
			tx = await investorsClaim.claim({ from: investor1 });
			let txHash = tx.receipt.transactionHash;

			checkVestingContractCreated(txHash, investor1, SIX_WEEKS.sub(ONE_WEEK).subn(1), amount1);

			expect(await investorsClaim.vestingList(investor1)).to.be.true;

			await SOV.transfer(vestingRegistry.address, amount2);
			await setNextBlockTimestamp(getTimeFromKickoff(SIX_WEEKS).subn(1).toNumber());
			tx = await investorsClaim.claim({ from: investor2 });
			//console.log(tx.receipt);
			txHash = tx.receipt.transactionHash;

			checkVestingContractCreated(txHash, investor2, new BN(1), amount2);

			expect(await investorsClaim.vestingList(investor2)).to.be.true;

			//TODO: check vesting created and the user is in the list
		});

		// address1 claims - failure

		it("should get SOV directly when claiming after the cliff", async () => {
			let balance;
			// investor2 claims within cliff - vesting contract created with amounts[1]
			// move time 1 ms past cliff
			await setNextBlockTimestamp((await getTimeFromKickoff(SIX_WEEKS)).addn(1).toNumber());
			await mineBlock();

			balance = await SOV.balanceOf(investor3);
			expect(balance).to.be.bignumber.equal(new BN(0));

			await SOV.transfer(vestingRegistry.address, amount3);
			await investorsClaim.claim({ from: investor3 });
			balance = await SOV.balanceOf(investor3);
			expect(balance).to.be.bignumber.equal(amounts[2]);
		});

		it("can withdraw only once", async () => {
			await expectRevert(investorsClaim.claim({ from: investor3 }), "tokens already withdrawn");
		});

		it("owner should be able to move SOV balances from the contract", async () => {
			const balanceBefore = await SOV.balanceOf(investorsClaim.address);

			await investorsClaim.ownerTtransferBalance(account1);

			expect(await SOV.balanceOf(account1)).to.be.bignumber.equal(balanceBefore);
			expect(await SOV.balanceOf(investorsClaim.address)).to.be.bignumber.equal(new BN(0));
		});

		it("allows to claim only from whitelisted addresses", async () => {
			await expectRevert(investorsClaim.claim({ from: account1 }), "not whitelisted");
		});
	});
});
