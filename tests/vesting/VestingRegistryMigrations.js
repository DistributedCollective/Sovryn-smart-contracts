const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const { mineBlock } = require("../Utils/Ethereum");
const { deployAndGetIStaking } = require("../Utils/initializer");

const StakingProxy = artifacts.require("StakingProxy");
const SOV_ABI = artifacts.require("SOV");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const LockedSOV = artifacts.require("LockedSOV");
const TestToken = artifacts.require("TestToken");
const FourYearVesting = artifacts.require("FourYearVesting");
const FourYearVestingLogic = artifacts.require("FourYearVestingLogic");

const FOUR_WEEKS = new BN(4 * 7 * 24 * 60 * 60);
const TEAM_VESTING_CLIFF = FOUR_WEEKS.mul(new BN(6));
const TEAM_VESTING_DURATION = FOUR_WEEKS.mul(new BN(36));
const TOTAL_SUPPLY = "100000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;
const pricsSats = "2500";
const ONE_MILLON = "1000000000000000000000000";

contract("VestingRegistryMigrations", (accounts) => {
    let root, account1, account2, account3, account4;
    let SOV, lockedSOV;
    let staking, feeSharingCollectorProxy;
    let vesting, vestingFactory, vestingLogic, vestingRegistry;
    let vestingAddress, vestingAddress2, vestingAddress3;
    let vestingTeamAddress, vestingTeamAddress2, vestingTeamAddress3;
    let newVestingAddress, newVestingAddress2, newVestingAddress3;
    let newTeamVestingAddress, newTeamVestingAddress2, newTeamVestingAddress3;
    let fourYearVestingLogic, fourYearVesting;

    let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
    let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.

    before(async () => {
        [root, account1, account2, account3, account4, ...accounts] = accounts;
    });

    beforeEach(async () => {
        SOV = await SOV_ABI.new(TOTAL_SUPPLY);
        cSOV1 = await TestToken.new("cSOV1", "cSOV1", 18, TOTAL_SUPPLY);
        cSOV2 = await TestToken.new("cSOV2", "cSOV2", 18, TOTAL_SUPPLY);

        /// Staking Modules
        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(SOV.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        feeSharingCollectorProxy = await FeeSharingCollectorProxy.new(
            ZERO_ADDRESS,
            staking.address
        );

        vestingLogic = await VestingLogic.new();
        vestingFactory = await VestingFactory.new(vestingLogic.address);

        vestingRegistry = await VestingRegistry.new();
        vesting = await VestingRegistryProxy.new();
        await vesting.setImplementation(vestingRegistry.address);
        vesting = await VestingRegistry.at(vesting.address);
        await staking.setVestingRegistry(vesting.address);

        lockedSOV = await LockedSOV.new(SOV.address, vesting.address, cliff, duration, [root]);
        await vesting.addAdmin(lockedSOV.address);

        // Deploy four year vesting contracts
        fourYearVestingLogic = await FourYearVestingLogic.new();
        fourYearVesting = await FourYearVesting.new(
            fourYearVestingLogic.address,
            SOV.address,
            staking.address,
            account4,
            feeSharingCollectorProxy.address,
            13 * FOUR_WEEKS
        );
        fourYearVesting = await FourYearVestingLogic.at(fourYearVesting.address);
    });

    describe("addDeployedVestings", () => {
        it("fails if the 0 address is passed", async () => {
            await expectRevert(
                vesting.addDeployedVestings([ZERO_ADDRESS], [1]),
                "token owner cannot be 0 address"
            );
        });

        it("fails if the 0 address is passed", async () => {
            await expectRevert(
                vesting.addDeployedVestings([account1], [0]),
                "vesting creation type must be greater than 0"
            );
        });

        it("fails if sender isn't an owner", async () => {
            await expectRevert(
                vesting.addDeployedVestings([account1], [1], { from: account2 }),
                "unauthorized"
            );
        });

        it("adds deployed four year vestings ", async () => {
            // Stake tokens
            await SOV.approve(fourYearVesting.address, ONE_MILLON);

            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await fourYearVesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await fourYearVesting.lastStakingSchedule();
                remainingStakeAmount = await fourYearVesting.remainingStakeAmount();
            }

            // Verify the vesting is created correctly
            let data = await staking.getStakes.call(fourYearVesting.address);
            assert.equal(data.dates.length, 39);
            assert.equal(data.stakes.length, 39);
            expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[38]);

            // Add deployed four year vesting to registry
            let tx = await vesting.addFourYearVestings([account4], [fourYearVesting.address]);
            console.log("gasUsed = " + tx.receipt.gasUsed);

            // Verify that it is added to the registry
            let cliff = FOUR_WEEKS;
            let duration = FOUR_WEEKS.mul(new BN(39));
            let newVestingAddress = await vesting.getVestingAddr(account4, cliff, duration, 4);
            expect(fourYearVesting.address).equal(newVestingAddress);
            expect(await vesting.isVestingAddress(newVestingAddress)).equal(true);

            let vestingAddresses = await vesting.getVestingsOf(account4);
            assert.equal(vestingAddresses.length.toString(), "1");
            assert.equal(vestingAddresses[0].vestingType, 1);
            assert.equal(vestingAddresses[0].vestingCreationType, 4);
            assert.equal(vestingAddresses[0].vestingAddress, newVestingAddress);
        });

        it("fails adding four year vesting if already added", async () => {
            // Add deployed four year vesting to registry
            await vesting.addFourYearVestings([account4], [fourYearVesting.address]);
            await expectRevert(
                vesting.addFourYearVestings([account4], [fourYearVesting.address]),
                "vesting exists"
            );
        });

        it("fails adding four year vesting if array mismatch", async () => {
            await expectRevert(vesting.addFourYearVestings([account4], []), "arrays mismatch");
        });

        it("fails adding four year vesting if token owner is zero address", async () => {
            await expectRevert(
                vesting.addFourYearVestings([ZERO_ADDRESS], [fourYearVesting.address]),
                "token owner cannot be 0 address"
            );
        });

        it("fails adding four year vesting if vesting is zero address", async () => {
            await expectRevert(
                vesting.addFourYearVestings([account4], [ZERO_ADDRESS]),
                "vesting cannot be 0 address"
            );
        });

        it("fails adding four year vesting if sender isn't an owner", async () => {
            await expectRevert(
                vesting.addFourYearVestings([account1], [fourYearVesting.address], {
                    from: account2,
                }),
                "unauthorized"
            );
        });
    });
});
