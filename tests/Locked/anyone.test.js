/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * No bottlenecks found. There's no beforeEach hook deploying contracts but
 *   there are several mints and approves that can be moved into
 *   the initialization process.
 *
 * Total time elapsed: 5.5s
 * After optimization: 5.1s
 *
 * Notes: mint and approval moved into before hook w/ effective infinite values.
 */

const SOV = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");
const LockedSOV = artifacts.require("LockedSOV");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry3");

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

let value;
const maxRandom = 10000;

/**
 * Function to create a random value.
 * It expects no parameter.
 *
 * @return {number} Random Value.
 */
function randomValue() {
    return Math.floor(Math.random() * maxRandom);
}

contract("Locked SOV (Any User Functions)", (accounts) => {
    let sov, lockedSOV, newLockedSOV, vestingRegistry, vestingLogic;
    let creator, admin, newAdmin, userOne, userTwo, userThree, userFour, userFive;

    before("Initiating Accounts & Creating Test Token Instance.", async () => {
        // Checking if we have enough accounts to test.
        assert.isAtLeast(
            accounts.length,
            8,
            "Alteast 8 accounts are required to test the contracts."
        );
        [creator, admin, newAdmin, userOne, userTwo, userThree, userFour, userFive] = accounts;

        // Creating the instance of SOV Token.
        sov = await SOV.new("Sovryn", "SOV", 18, zero);
        wrbtc = await TestWrbtc.new();

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
        await vestingRegistry.addAdmin(newLockedSOV.address);

        // Creating the instance of LockedSOV Contract.
        lockedSOV = await LockedSOV.new(sov.address, vestingRegistry.address, cliff, duration, [
            admin,
        ]);

        // Adding lockedSOV as an admin in the Vesting Registry.
        await vestingRegistry.addAdmin(lockedSOV.address);

        /// @dev Moved from tests into init code, for speed optimization.
        const infiniteTokens = maxRandom * 100; // A lot of tokens, enough to run all tests w/o extra minting
        value = randomValue() + 10;
        await sov.mint(userOne, infiniteTokens);
        await sov.approve(lockedSOV.address, infiniteTokens, { from: userOne });
    });

    it("Except Admin, no one should be able to add an admin.", async () => {
        await expectRevert(
            lockedSOV.addAdmin(newAdmin, { from: userOne }),
            "Only admin can call this."
        );
    });

    it("Except Admin, no one should be able to remove an admin.", async () => {
        await expectRevert(
            lockedSOV.removeAdmin(admin, { from: userOne }),
            "Only admin can call this."
        );
    });

    it("Except Admin, no one should be able to change the vestingRegistry, cliff and/or duration.", async () => {
        await expectRevert(
            lockedSOV.changeRegistryCliffAndDuration(
                vestingRegistry.address,
                cliff + 1,
                duration + 1,
                { from: userOne }
            ),
            "Only admin can call this."
        );
    });

    it("Anyone could deposit Tokens using deposit().", async () => {
        let basisPoint = randomValue();
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
    });

    it("No one could deposit Tokens using deposit() with 10000 as BasisPoint.", async () => {
        let basisPoint = 10000;
        await expectRevert(
            lockedSOV.deposit(userOne, value, basisPoint, { from: userOne }),
            "Basis Point has to be less than 10000."
        );
    });

    it("Anyone could deposit Tokens using depositSOV().", async () => {
        await lockedSOV.depositSOV(userOne, value, { from: userOne });
    });

    it("Anyone can withdraw unlocked Tokens using withdraw().", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        await lockedSOV.withdraw(zeroAddress, { from: userOne });
    });

    it("Anyone can withdraw unlocked Tokens to another wallet using withdraw().", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        await lockedSOV.withdraw(userTwo, { from: userOne });
    });

    it("Anyone can create a vesting schedule and stake tokens using createVestingAndStake().", async () => {
        let value = randomValue() + 10;
        await sov.mint(userThree, value);
        await sov.approve(lockedSOV.address, value, { from: userThree });
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userThree, value, basisPoint, { from: userThree });
        await lockedSOV.createVestingAndStake({ from: userThree });
    });

    it("No one can use createVestingAndStake() if he does not have any locked sov balance.", async () => {
        await expectRevert(
            newLockedSOV.createVestingAndStake({ from: userOne }),
            "Invalid amount"
        );
    });

    it("Anyone can create a vesting schedule using createVesting() even with no locked sov balance.", async () => {
        await lockedSOV.createVesting({ from: userOne });
    });

    it("Anyone can use stakeTokens() to stake locked sov who already has a vesting contract.", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        await lockedSOV.createVesting({ from: userOne });
        await lockedSOV.stakeTokens({ from: userOne });
    });

    it("No one can use stakeTokens() who already has not created a vesting contract.", async () => {
        let value = randomValue() + 10;
        await sov.mint(userFive, value);
        await sov.approve(lockedSOV.address, value, { from: userFive });
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userFive, value, basisPoint, { from: userFive });
        await expectRevert(
            lockedSOV.stakeTokens({ from: userFive }),
            "function call to a non-contract account"
        );
    });

    it("Anyone can withdraw unlocked and stake locked balance using withdrawAndStakeTokens().", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        await lockedSOV.withdrawAndStakeTokens(userOne, { from: userOne });
    });

    it("Anyone can withdraw unlocked and stake locked balance using withdrawAndStakeTokensFrom().", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        await lockedSOV.withdrawAndStakeTokensFrom(userOne, { from: userTwo });
    });

    it("Except Admin, no one should be able to start migration.", async () => {
        await expectRevert(
            lockedSOV.startMigration(newLockedSOV.address, { from: userOne }),
            "Only admin can call this."
        );
    });

    it("No one can transfer locked balance using transfer() unless migration has started.", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });

        await expectRevert(
            lockedSOV.transfer({ from: userOne }),
            "Migration has not yet started."
        );
    });

    it("Anyone can transfer locked balance using transfer().", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });

        // Migratioin started by Admin
        await lockedSOV.startMigration(newLockedSOV.address, { from: admin });

        await lockedSOV.transfer({ from: userOne });
    });
});
