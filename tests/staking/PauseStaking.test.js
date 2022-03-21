const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getPriceFeeds,
	getSovryn,
} = require("../Utils/initializer.js");
const { address } = require("../Utils/Ethereum");
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
				setPaused: true
			});
		});

		it("should not allow staking when paused", async () => {
			await staking.pauseUnpause(true); // Paused
			let amount = "100";
			let lockedTS = await getTimeFromKickoff(MAX_DURATION);
			await expectRevert(staking.stake(amount, lockedTS, ZERO_ADDRESS, ZERO_ADDRESS), "paused");
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
			await expectRevert(token.approveAndCall(staking.address, amount, data, { from: sender }), "paused");
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
			await expectRevert(staking.extendStakingDuration(lockedTS, newLockedTS), "paused");
		});

		it("should not allow stakesBySchedule when paused", async () => {
			await staking.pauseUnpause(true); // Paused
			let amount = "1000";
			let duration = new BN(MAX_DURATION).div(new BN(2));
			let cliff = new BN(TWO_WEEKS).mul(new BN(2));
			let intervalLength = new BN(10000000);
			await expectRevert(staking.stakesBySchedule(amount, cliff, duration, intervalLength, root, root), "paused");
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
			await expectRevert(staking.delegate(account1, lockedTS), "paused");
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
			await expectRevert(staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s), "paused");

			let tx = await staking.pauseUnpause(false); // Unpaused
			expectEvent(tx, "StakingPaused", {
				setPaused: false
			});

			tx = await staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s);
			expect(tx.gasUsed < 80000);
			expect(await staking.delegates.call(account1, inThreeYears)).to.be.equal(root);
		});
	});

	describe("add pauser", () => {
		it("adds pauser", async () => {
			let tx = await staking.addPauser(account1);

			expectEvent(tx, "PauserAddedOrRemoved", {
				pauser: account1,
				added: true
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
				added: false
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
