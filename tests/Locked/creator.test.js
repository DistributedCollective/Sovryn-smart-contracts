/** Speed optimized on branch hardhatTestRefactor, 2021-09-27
 * No bottlenecks found. Tests run fast because they just check single transaction reverts.
 *
 * Total time elapsed: 4.0s
 *
 */

const SOV = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");
const LockedSOV = artifacts.require("LockedSOV");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry");

const {
    BN, // Big Number support.
    expectRevert,
    constants, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");
const { deployAndGetIStaking } = require("../Utils/initializer");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = new BN(0);
let zeroAddress = constants.ZERO_ADDRESS;
let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.

contract("Locked SOV (Creator Functions)", (accounts) => {
    let sov, lockedSOV, newLockedSOV, vestingRegistry, vestingLogic;
    let creator, admin, newAdmin, userOne, userTwo, userThree, userFour, userFive;

    before("Initiating Accounts & Creating Test Token Instance.", async () => {
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
        /// Staking Modules
        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(sov.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        // Creating the FeeSharing Instance.
        feeSharingCollectorProxy = await FeeSharingCollectorProxy.new(
            zeroAddress,
            staking.address
        );

        // Creating the Vesting Instance.
        vestingLogic = await VestingLogic.new();
        vestingFactory = await VestingFactory.new(vestingLogic.address);
        vestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            sov.address,
            staking.address,
            feeSharingCollectorProxy.address,
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
    });

    it("Creator should not be able to create Locked SOV Contract without specifying the sov contract.", async () => {
        await expectRevert(
            LockedSOV.new(zeroAddress, vestingRegistry.address, cliff, duration, [admin]),
            "Invalid SOV Address."
        );
    });

    it("Creator should not be able to create Locked SOV Contract without specifying the vesting registry.", async () => {
        await expectRevert(
            LockedSOV.new(sov.address, zeroAddress, cliff, duration, [admin]),
            "Vesting registry address is invalid."
        );
    });

    it("Creator should not be able to create Locked SOV Contract with duration higher than 36.", async () => {
        await expectRevert(
            LockedSOV.new(sov.address, vestingRegistry.address, cliff, 100, [admin]),
            "Duration is too long."
        );
    });

    it("Except Admin, creator should not be able to add an admin.", async () => {
        await expectRevert(
            lockedSOV.addAdmin(newAdmin, { from: creator }),
            "Only admin can call this."
        );
    });

    it("Except Admin, creator should not be able to remove an admin.", async () => {
        await expectRevert(
            lockedSOV.removeAdmin(admin, { from: creator }),
            "Only admin can call this."
        );
    });

    it("Except Admin, creator should not be able to change the vestingRegistry, cliff and/or duration.", async () => {
        await expectRevert(
            lockedSOV.changeRegistryCliffAndDuration(
                vestingRegistry.address,
                cliff + 1,
                duration + 1,
                { from: creator }
            ),
            "Only admin can call this."
        );
    });

    it("Except Admin, creator should not be able to start migration.", async () => {
        await expectRevert(
            lockedSOV.startMigration(newLockedSOV.address, { from: creator }),
            "Only admin can call this."
        );
    });
});
