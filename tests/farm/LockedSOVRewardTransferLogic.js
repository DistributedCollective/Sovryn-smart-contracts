const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { etherMantissa, mineBlock, advanceBlocks } = require("../Utils/Ethereum");

const { ZERO_ADDRESS } = constants;
const TOTAL_SUPPLY = etherMantissa(1000000000);

const TestToken = artifacts.require("TestToken");
const LiquidityMiningConfigToken = artifacts.require("LiquidityMiningConfigToken");
const LiquidityMiningLogic = artifacts.require("LiquidityMiningMockup");
const LiquidityMiningProxy = artifacts.require("LiquidityMiningProxy");
const TestLockedSOV = artifacts.require("LockedSOVMockup");
const Wrapper = artifacts.require("RBTCWrapperProxyMockup");
const LockedSOVRewardTransferLogic = artifacts.require("LockedSOVRewardTransferLogic");

describe("LockedSOVRewardTransferLogic", () => {
   
    const name = "Test SOV Token";
	const symbol = "TST";

	const PRECISION = 1e12;

	const rewardTokensPerBlock = new BN(3);
	const startDelayBlocks = new BN(1);
	const numberOfBonusBlocks = new BN(50);

	// The % which determines how much will be unlocked immediately.
	/// @dev 10000 is 100%
	const unlockedImmediatelyPercent = new BN(1000); //10%

	let accounts;
	let root, account1, account2, account3, account4;
	let SOVToken, token1, token2, token3, liquidityMiningConfigToken;
	let liquidityMining, wrapper;
	let rewardTransferLogic, lockedSOVAdmins, lockedSOV;

	before(async () => {
		accounts = await web3.eth.getAccounts();
		[root, account1, account2, account3, account4, ...accounts] = accounts;
	});

	beforeEach(async () => {
		SOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
		token1 = await TestToken.new("Test token 1", "TST-1", 18, TOTAL_SUPPLY);
		token2 = await TestToken.new("Test token 2", "TST-2", 18, TOTAL_SUPPLY);
		token3 = await TestToken.new("Test token 3", "TST-3", 18, TOTAL_SUPPLY);
		liquidityMiningConfigToken = await LiquidityMiningConfigToken.new();
		lockedSOVAdmins = [account1, account2];

		lockedSOV = await TestLockedSOV.new(SOVToken.address, lockedSOVAdmins);

		await deployLiquidityMining();
		
		rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
		await rewardTransferLogic.initialize(lockedSOV.address, unlockedImmediatelyPercent);

		await liquidityMining.setWrapper(wrapper.address);
		await liquidityMining.addRewardToken(SOVToken.address, rewardTokensPerBlock, startDelayBlocks, rewardTransferLogic.address);
	});

    describe("changeLockedSOV", () => {
        it("fails if not an owner or admin", async () => {
            await expectRevert(rewardTransferLogic.changeLockedSOV(SOVToken.address, {from:account1}), "unauthorized");

            await rewardTransferLogic.addAdmin(account1);
            await rewardTransferLogic.changeLockedSOV(SOVToken.address, {from:account1});

        });

        it("fails if invalid address", async () => {
            await rewardTransferLogic.addAdmin(account1);
            await expectRevert(rewardTransferLogic.changeLockedSOV(ZERO_ADDRESS, {from:account1}), "Invalid address");
        });

        it("should set a new LockedSOV", async () => {
            //first check original lockedSOV address
            let lockedSOVAddress = await rewardTransferLogic.lockedSOV();
            expect(lockedSOV.address).equal(lockedSOVAddress);
            
            newLockedSOV = await TestLockedSOV.new(SOVToken.address, lockedSOVAdmins);
            await rewardTransferLogic.addAdmin(account1);
            tx = await rewardTransferLogic.changeLockedSOV(newLockedSOV.address, {from:account1});
            
            //then check new lockedSOV address
            let newLockedSOVAddress = await rewardTransferLogic.lockedSOV();
            expect(newLockedSOV.address).equal(newLockedSOVAddress);

			expectEvent(tx, "LockedSOVChanged", {
				_newAddress: newLockedSOVAddress
			});

        });


    })






    async function deployLiquidityMining() {
		let liquidityMiningLogic = await LiquidityMiningLogic.new();
		let liquidityMiningProxy = await LiquidityMiningProxy.new();
		await liquidityMiningProxy.setImplementation(liquidityMiningLogic.address);
		liquidityMining = await LiquidityMiningLogic.at(liquidityMiningProxy.address);

		wrapper = await Wrapper.new(liquidityMining.address);
	}

	async function mineBlocks(blocks) {
		for (let i = 0; i < blocks; i++) {
			await mineBlock();
		}
	}

});