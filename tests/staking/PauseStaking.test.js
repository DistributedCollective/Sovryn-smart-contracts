const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const { getSUSD, getRBTC, getWRBTC, getBZRX, getPriceFeeds, getSovryn } = require("../Utils/initializer.js");
const { address, setNextBlockTimestamp, mineBlock, increaseTime } = require("../Utils/Ethereum");
const EIP712 = require("../Utils/EIP712");
const { getAccountsPrivateKeysBuffer } = require("../Utils/hardhat_utils");

const StakingProxy = artifacts.require("StakingProxy");
const StakingMockup = artifacts.require("StakingMockup");

const SOV = artifacts.require("SOV");

const LoanTokenLogic = artifacts.require("LoanTokenLogicStandard");
const LoanTokenSettings = artifacts.require("LoanTokenSettingsLowerAdmin");
const LoanToken = artifacts.require("LoanToken");

const FeeSharingLogic = artifacts.require("FeeSharingLogic");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");

// Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const Vesting = artifacts.require("TeamVesting");
const VestingLogic = artifacts.require("VestingLogicMockup");

const TOTAL_SUPPLY = "100000000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DAY = 86400;
const TWO_WEEKS = 1209600;

const DELAY = DAY * 14;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("Staking", (accounts) => {
	let root, account1;
	let token, SUSD, WRBTC, staking;
	let sovryn;
	let loanTokenLogic, loanToken;
	let feeSharingProxy;
	let kickoffTS, inOneWeek;

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
		/// @dev This SOV token is not a SOV test token
		///   but a full-fledged SOV token including functionality
		///   like the approveAndCall method.
		token = await SOV.new(TOTAL_SUPPLY);

		// Staking
		let stakingLogic = await StakingMockup.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingMockup.at(staking.address);

		// Upgradable Vesting Registry
		vestingRegistryLogic = await VestingRegistryLogic.new();
		vesting = await VestingRegistryProxy.new();
		await vesting.setImplementation(vestingRegistryLogic.address);
		vesting = await VestingRegistryLogic.at(vesting.address);

		await staking.setVestingRegistry(vesting.address);

		// Loan token
		loanTokenSettings = await LoanTokenSettings.new();
		loanTokenLogic = await LoanTokenLogic.new();
		loanToken = await LoanToken.new(root, loanTokenLogic.address, sovryn.address, WRBTC.address);
		// await loanToken.initialize(SUSD.address, "iSUSD", "iSUSD");
		loanToken = await LoanTokenLogic.at(loanToken.address);

		await sovryn.setLoanPool([loanToken.address], [SUSD.address]);

		//FeeSharingProxy
		let feeSharingLogic = await FeeSharingLogic.new();
		feeSharingProxyObj = await FeeSharingProxy.new(sovryn.address, staking.address);
		await feeSharingProxyObj.setImplementation(feeSharingLogic.address);
		feeSharingProxy = await FeeSharingLogic.at(feeSharingProxyObj.address);
		await sovryn.setFeesController(feeSharingProxy.address);
		await staking.setFeeSharing(feeSharingProxy.address);

		await token.transfer(account1, 1000);
		await token.approve(staking.address, TOTAL_SUPPLY);
		kickoffTS = await staking.kickoffTS.call();
		inOneWeek = kickoffTS.add(new BN(DELAY));
	}

	before(async () => {
		[root, account1, account2, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("pause staking", () => {
		it("should pause staking activities", async () => {
			let tx = await staking.pauseUnpause(true); // Paused
			expectEvent(tx, "StakingPaused", {
				setPaused: true,
			});
			expect(await staking.frozen()).to.be.equal(false); // Must not be freezed when paused
		});

		it("should not pause/unpause when frozen", async () => {
			await staking.freezeUnfreeze(true); // Freezed
			await expectRevert(staking.pauseUnpause(true), "WS04");
		});

		it("fails pausing if sender isn't an owner/pauser", async () => {
			await expectRevert(staking.pauseUnpause(true, { from: account1 }), "WS02"); // WS02 : unauthorized
		});

		it("should not allow staking when paused", async () => {
			await staking.pauseUnpause(true); // Paused
			let amount = "100";
			let lockedTS = await getTimeFromKickoff(MAX_DURATION);
			await expectRevert(staking.stake(amount, lockedTS, ZERO_ADDRESS, ZERO_ADDRESS), "WS03"); // WS03 : paused
		});

		it("should not allow to stakeWithApproval when paused", async () => {
			await staking.pauseUnpause(true); // Paused
			let amount = "100";
			let duration = TWO_WEEKS;
			let lockedTS = await getTimeFromKickoff(duration);

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(0);

			await token.approve(staking.address, 0);
			await token.approve(staking.address, amount * 2, { from: account1 });

			let contract = new web3.eth.Contract(staking.abi, staking.address);
			let sender = root;
			let data = contract.methods.stakeWithApproval(sender, amount, lockedTS, root, root).encodeABI();
			await expectRevert(token.approveAndCall(staking.address, amount, data, { from: sender }), "WS03"); // WS03 : paused
		});

		it("should not allow to extend staking duration when paused", async () => {
			let amount = "1000";
			let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
			let tx1 = await staking.stake(amount, lockedTS, root, root);

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);

			expect(tx1.logs[2].args.lockedUntil.toNumber()).to.be.equal(lockedTS.toNumber());

			let newLockedTS = await getTimeFromKickoff(TWO_WEEKS * 2);
			await staking.pauseUnpause(true); // Paused
			await expectRevert(staking.extendStakingDuration(lockedTS, newLockedTS), "WS03"); // WS03 : paused
		});

		it("should not allow stakesBySchedule when paused", async () => {
			await staking.pauseUnpause(true); // Paused
			let amount = "1000";
			let duration = new BN(MAX_DURATION).div(new BN(2));
			let cliff = new BN(TWO_WEEKS).mul(new BN(2));
			let intervalLength = new BN(10000000);
			await expectRevert(staking.stakesBySchedule(amount, cliff, duration, intervalLength, root, root), "WS03"); // WS03 : paused
		});

		it("should not allow delegating stakes when paused", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			await staking.stake(amount, lockedTS, root, root);

			await staking.withdraw(amount, lockedTS, root);

			await staking.stake(amount, lockedTS, root, root);
			await staking.setDelegateStake(root, lockedTS, 0);

			await staking.pauseUnpause(true); // Paused
			await expectRevert(staking.delegate(account1, lockedTS), "WS03"); // WS03 : paused
		});

		it("should not delegate on behalf of the signatory when paused", async () => {
			[pkbRoot, pkbA1] = getAccountsPrivateKeysBuffer();
			const currentChainId = (await ethers.provider.getNetwork()).chainId;
			const inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));
			const Domain = (staking) => ({ name: "SOVStaking", chainId: currentChainId, verifyingContract: staking.address });
			const Types = {
				Delegation: [
					{ name: "delegatee", type: "address" },
					{ name: "lockDate", type: "uint256" },
					{ name: "nonce", type: "uint256" },
					{ name: "expiry", type: "uint256" },
				],
			};
			const delegatee = root,
				nonce = 0,
				expiry = 10e9,
				lockDate = inThreeYears;
			const { v, r, s } = EIP712.sign(
				Domain(staking),
				"Delegation",
				{
					delegatee,
					lockDate,
					nonce,
					expiry,
				},
				Types,
				pkbA1
			);

			expect(await staking.delegates.call(account1, inThreeYears)).to.be.equal(address(0));

			await staking.pauseUnpause(true); // Paused
			await expectRevert(staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s), "WS03"); // WS03 : paused

			let tx = await staking.pauseUnpause(false); // Unpaused
			expectEvent(tx, "StakingPaused", {
				setPaused: false,
			});

			tx = await staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s);
			expect(tx.gasUsed < 80000);
			expect(await staking.delegates.call(account1, inThreeYears)).to.be.equal(root);
		});
	});

	describe("freeze withdrawal", () => {
		it("should freeze withdrawal", async () => {
			let tx = await staking.freezeUnfreeze(true); // Freeze
			expectEvent(tx, "StakingFrozen", {
				setFrozen: true,
			});
			expect(await staking.paused()).to.be.equal(true); // Must also pause when freezed
			await staking.freezeUnfreeze(false); // Unfreeze
			expect(await staking.paused()).to.be.equal(true); // Must still be paused when unfreezed
		});

		it("fails freezing if sender isn't an owner/pauser", async () => {
			await expectRevert(staking.freezeUnfreeze(true, { from: account1 }), "WS02"); // WS02 : unauthorized
		});

		it("should not allow withdrawal when frozen", async () => {
			let amount = "1000";
			let duration = new BN(TWO_WEEKS).mul(new BN(2));
			let lockedTS = await getTimeFromKickoff(duration);
			let tx1 = await staking.stake(amount, lockedTS, root, root);

			// await setTime(lockedTS);
			setNextBlockTimestamp(lockedTS.toNumber());
			mineBlock();

			let stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toString()).to.be.equal(amount);
			let beforeBalance = await token.balanceOf.call(root);

			await staking.freezeUnfreeze(true); // Freeze
			await expectRevert(staking.withdraw(amount / 2, lockedTS, root), "WS04"); // WS04 : frozen

			await staking.freezeUnfreeze(false); // Unfreeze
			let tx2 = await staking.withdraw(amount / 2, lockedTS, root);

			stakingBalance = await token.balanceOf.call(staking.address);
			expect(stakingBalance.toNumber()).to.be.equal(amount / 2);
			let afterBalance = await token.balanceOf.call(root);
			expect(afterBalance.sub(beforeBalance).toNumber()).to.be.equal(amount / 2);

			// _increaseDailyStake
			let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
			expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(2);
			let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);

			// _writeUserCheckpoint
			let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
			expect(numUserCheckpoints.toNumber()).to.be.equal(2);
			checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
			expect(checkpoint.stake.toString()).to.be.equal(amount);
			checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);

			// _decreaseDelegateStake
			let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(root, lockedTS);
			checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, numDelegateStakingCheckpoints - 1);
			expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
			expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);
			expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(2);

			expectEvent(tx2, "StakingWithdrawn", {
				staker: root,
				amount: new BN(amount / 2),
			});
		});

		it("should not allow governanceWithdrawTokens when frozen", async () => {
			const WEEK = new BN(7 * 24 * 60 * 60);
			let vestingLogic = await VestingLogic.new();
			const ONE_MILLON = "1000000000000000000000000";
			let previousAmount = await token.balanceOf(root);
			let toStake = ONE_MILLON;

			// Stake
			vesting = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				16 * WEEK,
				36 * WEEK,
				feeSharingProxy.address
			);
			vesting = await VestingLogic.at(vesting.address);

			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake);

			await increaseTime(20 * WEEK);
			await token.approve(vesting.address, toStake);
			await vesting.stakeTokens(toStake);

			let amountAfterStake = await token.balanceOf(root);

			await staking.addAdmin(account1);

			await staking.freezeUnfreeze(true); // Freeze
			await expectRevert(staking.governanceWithdrawVesting(vesting.address, root, { from: account1 }), "WS04"); // WS04 : frozen

			await staking.freezeUnfreeze(false); // Unfreeze
			// governance withdraw until duration must withdraw all staked tokens without fees
			let tx = await staking.governanceWithdrawVesting(vesting.address, root, { from: account1 });

			expectEvent(tx, "VestingTokensWithdrawn", {
				vesting: vesting.address,
				receiver: root,
			});

			// verify amount
			let amount = await token.balanceOf(root);

			assert.equal(previousAmount.sub(new BN(toStake).mul(new BN(2))).toString(), amountAfterStake.toString());
			assert.equal(previousAmount.toString(), amount.toString());

			let vestingBalance = await staking.balanceOf(vesting.address);
			expect(vestingBalance).to.be.bignumber.equal(new BN(0));
		});
	});

	describe("add pauser", () => {
		it("adds pauser", async () => {
			let tx = await staking.addPauser(account1);

			expectEvent(tx, "PauserAddedOrRemoved", {
				pauser: account1,
				added: true,
			});

			let isPauser = await staking.pausers(account1);
			expect(isPauser).equal(true);
		});

		it("fails if sender isn't an owner", async () => {
			await expectRevert(staking.addPauser(account1, { from: account1 }), "unauthorized");
		});
	});

	describe("remove pauser", () => {
		it("removes pauser", async () => {
			await staking.addPauser(account1);
			let tx = await staking.removePauser(account1);

			expectEvent(tx, "PauserAddedOrRemoved", {
				pauser: account1,
				added: false,
			});

			let isPauser = await staking.pausers(account1);
			expect(isPauser).equal(false);
		});

		it("fails if sender isn't an owner", async () => {
			await expectRevert(staking.removePauser(account1, { from: account1 }), "unauthorized");
		});
	});

	async function getTimeFromKickoff(delay) {
		let kickoffTS = await staking.kickoffTS.call();
		return kickoffTS.add(new BN(delay));
	}
});
