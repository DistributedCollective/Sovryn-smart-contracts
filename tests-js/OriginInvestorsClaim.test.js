const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const { mineBlock, setNextBlockTimestamp } = require("./Utils/Ethereum");

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
const SIX_WEEKS = ONE_WEEK.muln(6); //new BN(6 * 7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "100000000000000000000000000";
const ONE_MILLION = "1000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const pricsSats = "2500";

contract("OriginInvestorsClaim", (accounts) => {
	let root, initializer, account1, investor1, investor2, investor3;
	let SOV, kickoffTS;
	let staking, stakingLogic, feeSharingProxy;
	let vestingFactory, vestingLogic, vestingRegistry;
	let investors;
	let amounts, amount1, amount2, amount3;
	let investorsClaim;

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

	async function createOriginInvestorsClaimContract({
		initializeInvestorsList = false,
		approve = true,
		transfer = false,
		_investors = investors,
		_amounts = amounts,
	}) {
		investorsClaim = await OriginInvestorsClaim.new(vestingRegistry.address);
		if (initializeInvestorsList) {
			await fundContract(approve, transfer, _amounts);
			if (approve) {
				investorsClaim.setInvestorsAmountsList(_investors, _amounts, initializer);
			} else if (transfer) {
				investorsClaim.setInvestorsAmountsList(_investors, _amounts, constants.ZERO_ADDRESS);
			}
		}
	}

	async function fundContract({ approve = true, transfer = false, _amounts = amounts }) {
		const totalReducer = (accumulator, currentValue) => accumulator.add(currentValue);
		const total = _amounts.reduce(totalReducer);
		await SOV.transfer(initializer, total);
		await investorsClaim.authorizedBalanceWithdraw(root); //nullify balance
		if (!approve && !transfer) throw "createOriginInvestorsClaimContract: the contract is not funded";

		if (approve) {
			await SOV.approve(investorsClaim.address, total, { from: initializer });
		} else {
			// transfer
			await SOV.transfer(investorsClaim.address, total, { from: initializer });
		}
	}

	before(async () => {
		[root, initializer, account1, investor1, investor2, investor3, ...accounts] = accounts;
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

		await createOriginInvestorsClaimContract({ initializeInvestorsList: true, approve: true, transfer: false });

		await vestingRegistry.addAdmin(investorsClaim.address); //TODO: after deploy run addAdmin(OriginInvestorsClaim address)
	});

	describe("setInvestorsList", () => {
		beforeEach(async () => {
			await createOriginInvestorsClaimContract({ initializeInvestorsList: false });
			await fundContract({ approve: true, transfer: false });
		});

		it("set investors list", async () => {
			// transfer

			await fundContract({ approve: false, transfer: true });

			let tx = await investorsClaim.setInvestorsAmountsList(investors, amounts, constants.ZERO_ADDRESS);
			expectEvent(tx, "InvestorsAmountsListSet", { qty: new BN(amounts.length), totalAmount: amount1.add(amount2).add(amount3) });

			await verifyAmounts();

			// allowance
			await createOriginInvestorsClaimContract({ initializeInvestorsList: false });
			await fundContract({ approve: true, transfer: false });

			tx = await investorsClaim.setInvestorsAmountsList(investors, amounts, initializer);
			expectEvent(tx, "InvestorsAmountsListSet", { qty: new BN(amounts.length), totalAmount: amount1.add(amount2).add(amount3) });

			await verifyAmounts();

			async function verifyAmounts() {
				for (i = 0; i < investors; i++) {
					amount = await investorsClaim.investorsAmountsList(invertors[i]);
					expect(amount).to.be.bignumber.equal(new BN(amounts[i]), `wrong investors list assignment at index ${i}`);
				}
			}

			//allowance with wrong 0x0 address param
			await createOriginInvestorsClaimContract({ initializeInvestorsList: false });
			await fundContract({ approve: true, transfer: false });
			//await SOV.transfer(root, await SOV.balanceOf(initializer), { from: initializer });

			await expectRevert(
				investorsClaim.setInvestorsAmountsList(investors, amounts, constants.ZERO_ADDRESS),
				"OriginInvestorsClaim::setInvestorsAmountsList: the contract is not enough financed or wrong allowance address passed"
			);
		});

		it("can load investors list only once", async () => {
			await createOriginInvestorsClaimContract({ initializeInvestorsList: true, transfer: true });
			//await investorsClaim.setInvestorsAmountsList(investors, amounts, initializer); // if transferred then allowanceFrom (initializer) doesn't matter
			await expectRevert(
				investorsClaim.setInvestorsAmountsList(investors, amounts, constants.ZERO_ADDRESS),
				"OriginInvestorsClaim::setInvestorsAmountsList: the investors list has already been set"
			);
			await expectRevert(
				investorsClaim.setInvestorsAmountsList(investors, amounts, initializer),
				"OriginInvestorsClaim::setInvestorsAmountsList: the investors list has already been set"
			);
		});

		it("fails if investors.length != amounts.length", async () => {
			const investorsReduced = investors.slice(1);
			await expectRevert(
				investorsClaim.setInvestorsAmountsList(investorsReduced, amounts, initializer),
				"investors.length != claimAmounts.length"
			);
		});

		it("only authorised can whitelist investors", async () => {
			await expectRevert(investorsClaim.setInvestorsAmountsList(investors, amounts, initializer, { from: account1 }), "unauthorized");
		});
	});

	describe.only("process claims", () => {
		before(async () => {
			await createOriginInvestorsClaimContract({ initializeInvestorsList: true });
			await vestingRegistry.addAdmin(investorsClaim.address);
			//await fundContract({ approve: true, transfer: false });
		});
		it("should create vesting contract within vesting period", async () => {
			const timeFromKickoff = getTimeFromKickoff(ONE_WEEK);
			await setNextBlockTimestamp(timeFromKickoff.toNumber());
			tx = await investorsClaim.claim({ from: investor1 });

			await expectEvent(tx.receipt, "ClaimVested", {
				investor: investor1,
				amount: amount1,
			});

			let txHash = tx.receipt.transactionHash;

			checkVestingContractCreated(txHash, investor1, SIX_WEEKS.sub(ONE_WEEK), amount1);

			expect(await investorsClaim.investorsAmountsList(investor1)).to.be.bignumber.equal(new BN(0));

			await setNextBlockTimestamp(getTimeFromKickoff(SIX_WEEKS).subn(1).toNumber());
			tx = await investorsClaim.claim({ from: investor2 });

			await expectEvent(tx.receipt, "ClaimVested", {
				investor: investor2,
				amount: amount2,
			});

			txHash = tx.receipt.transactionHash;

			checkVestingContractCreated(txHash, investor2, new BN(1), amount2);

			expect(await investorsClaim.investorsAmountsList(investor2)).to.be.bignumber.equal(new BN(0));

			//TODO: check vesting created and the user is in the list
		});

		// address1 claims - failure

		it("should get SOV directly when claiming after the cliff", async () => {
			let balance;
			// investor2 claims within cliff - vesting contract created with amounts[1]
			// move time 1 ms past cliff
			await setNextBlockTimestamp((await getTimeFromKickoff(SIX_WEEKS)).addn(100).toNumber());
			await mineBlock();

			balance = await SOV.balanceOf(investor3);
			expect(balance).to.be.bignumber.equal(new BN(0));

			// await SOV.transfer(vestingRegistry.address, amount3);
			tx = await investorsClaim.claim({ from: investor3 });

			await expectEvent(tx.receipt, "ClaimTransferred", {
				investor: investor3,
				amount: amount3,
			});

			balance = await SOV.balanceOf(investor3);
			expect(balance).to.be.bignumber.equal(amount3);
		});

		it("investors with vesting contracts created cannot withdraw here", async () => {
			await expectRevert(
				investorsClaim.claim({ from: investor1 }),
				"OriginInvestorsClaim::onlyWhitelisted: not whitelisted or already claimed"
			);
		});

		it("can withdraw only once", async () => {
			await expectRevert(
				investorsClaim.claim({ from: investor3 }),
				"OriginInvestorsClaim::onlyWhitelisted: not whitelisted or already claimed"
			);
		});

		it("owner should be able to move SOV balances from the contract", async () => {
			const balanceBefore = await SOV.balanceOf(investorsClaim.address);

			await investorsClaim.authorizedBalanceWithdraw(account1);

			expect(await SOV.balanceOf(account1)).to.be.bignumber.equal(balanceBefore);
			expect(await SOV.balanceOf(investorsClaim.address)).to.be.bignumber.equal(new BN(0));
		});

		it("allows to claim only from whitelisted addresses", async () => {
			await expectRevert(investorsClaim.claim({ from: account1 }), "not whitelisted or already claimed");
		});
	});
});
