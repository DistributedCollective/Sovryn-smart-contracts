/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * No bottlenecks found. There's no beforeEach hook deploying contracts but
 *   near the end there are 3 tests redeploying VestingRegistry.
 *
 * Total time elapsed: 4.2s
 *
 * Notes: Applied fixture for the 3 tests near the end.
 */

const SOV = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");
const LockedSOV = artifacts.require("LockedSOV");
const StakingLogic = artifacts.require("StakingMockup");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingProxy = artifacts.require("FeeSharingProxyMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry3");

const {
    BN, // Big Number support.
    constants,
    expectRevert, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

// Some constants we would be using in the contract.
let zero = new BN(0);
let zeroAddress = constants.ZERO_ADDRESS;
let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.

contract("Locked SOV (Admin Functions)", (accounts) => {
    let sov, lockedSOV, newLockedSOV, vestingRegistry, vestingLogic, stakingLogic;
    let creator, admin, newAdmin, userOne, userTwo, userThree, userFour, userFive;
    let newVestingRegistry;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Checking if we have enough accounts to test.
        assert.isAtLeast(
            accounts.length,
            8,
            "At least 8 accounts are required to test the contracts."
        );
        [creator, admin, newAdmin, userOne, userTwo, userThree, userFour, userFive] = accounts;

        // Creating the instance of SOV Token.
        sov = await SOV.new("Sovryn", "SOV", 18, zero);
        wrbtc = await TestWrbtc.new();

        // Creating the Staking Instance.
        stakingLogic = await StakingLogic.new(sov.address);
        staking = await StakingProxy.new(sov.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);

        // Creating the FeeSharing Instance.
        feeSharingProxy = await FeeSharingProxy.new(zeroAddress, staking.address);

        // Creating the Vesting Instance.
        vestingLogic = await VestingLogic.new();
        vestingFactory = await VestingFactory.new(vestingLogic.address);
        vestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            sov.address,
            staking.address,
            feeSharingProxy.address,
            creator // This should be Governance Timelock Contract.
        );
        await vestingFactory.transferOwnership(vestingRegistry.address);

        // Creating the instance of newLockedSOV Contract.
        newLockedSOV = await LockedSOV.new(sov.address, vestingRegistry.address, cliff, duration, [
            admin,
        ]);

        // Creating the instance of LockedSOV Contract.
        lockedSOV = await LockedSOV.new(sov.address, vestingRegistry.address, cliff, duration, [
            admin,
        ]);

        // Adding lockedSOV as an admin in the Vesting Registry.
        await vestingRegistry.addAdmin(lockedSOV.address);

        newVestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            sov.address,
            staking.address,
            feeSharingProxy.address,
            creator // This should be Governance Timelock Contract.
        );
    }

    before("Initiating Accounts & Creating Test Token Instance.", async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    it("Admin should be able to add another admin.", async () => {
        await lockedSOV.addAdmin(newAdmin, { from: admin });
    });

    it("Admin should not be able to add zero address as another admin.", async () => {
        await expectRevert(lockedSOV.addAdmin(zeroAddress, { from: admin }), "Invalid Address.");
    });

    it("Admin should not be able to add another admin more than once.", async () => {
        await expectRevert(
            lockedSOV.addAdmin(newAdmin, { from: admin }),
            "Address is already admin."
        );
    });

    it("Admin should be able to remove an admin.", async () => {
        await lockedSOV.removeAdmin(newAdmin, { from: admin });
    });

    it("Admin should not be able to call removeAdmin() with a normal user address.", async () => {
        await expectRevert(
            lockedSOV.removeAdmin(newAdmin, { from: admin }),
            "Address is not an admin."
        );
    });

    it("Admin should not be able to change the cliff and/or duration without changing the vesting registry.", async () => {
        await expectRevert(
            lockedSOV.changeRegistryCliffAndDuration(
                vestingRegistry.address,
                cliff + 1,
                duration + 1,
                { from: admin }
            ),
            "Vesting Registry has to be different for changing duration and cliff."
        );
    });

    it("Admin should be able to change the vestingRegistry, cliff and/or duration.", async () => {
        await loadFixture(deploymentAndInitFixture);
        await lockedSOV.changeRegistryCliffAndDuration(
            newVestingRegistry.address,
            cliff + 1,
            duration + 1,
            { from: admin }
        );
    });

    it("Admin should not be able to change the duration as zero.", async () => {
        await loadFixture(deploymentAndInitFixture);
        await expectRevert(
            lockedSOV.changeRegistryCliffAndDuration(newVestingRegistry.address, cliff + 1, 0, {
                from: admin,
            }),
            "Duration cannot be zero."
        );
    });

    it("Admin should not be able to change the duration higher than 36.", async () => {
        await loadFixture(deploymentAndInitFixture);
        await expectRevert(
            lockedSOV.changeRegistryCliffAndDuration(newVestingRegistry.address, cliff + 1, 100, {
                from: admin,
            }),
            "Duration is too long."
        );
    });

    it("Admin should be able to start migration.", async () => {
        await lockedSOV.startMigration(newLockedSOV.address, { from: admin });
    });

    it("Admin should not be able to start migration with locked sov as zero address.", async () => {
        await expectRevert(
            lockedSOV.startMigration(zeroAddress, { from: admin }),
            "New Locked SOV Address is Invalid."
        );
    });
});
