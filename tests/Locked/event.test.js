/** Speed optimized on branch hardhatTestRefactor, 2021-09-27
 * No bottlenecks found. There's no beforeEach hook deploying contracts but
 *   there are several mints and approves that can be moved into
 *   the initialization process. Two last tests require redeployments and cannot be
 *   isolated from the previous flow state, so fixture is not appliable.
 *
 * Total time elapsed: 5.1s
 * After optimization: 4.9s
 *
 * Notes: mint and approval moved into before hook w/ effective infinite values.
 */

const SOV = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");
const LockedSOV = artifacts.require("LockedSOV");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxyMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry3");

const {
    BN, // Big Number support.
    expectEvent,
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

contract("Locked SOV (Events)", (accounts) => {
    let sov, staking, lockedSOV, newLockedSOV, vestingRegistry, newVestingRegistry, vestingLogic;
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
        await sov.approve(newLockedSOV.address, infiniteTokens, { from: userOne });
    });

    it("Adding another admin should emit AdminAdded.", async () => {
        let txReceipt = await lockedSOV.addAdmin(newAdmin, { from: admin });
        expectEvent(txReceipt, "AdminAdded", {
            _initiator: admin,
            _newAdmin: newAdmin,
        });
    });

    it("Removing an admin should emit AdminRemoved.", async () => {
        let txReceipt = await lockedSOV.removeAdmin(newAdmin, { from: admin });
        expectEvent(txReceipt, "AdminRemoved", {
            _initiator: admin,
            _removedAdmin: newAdmin,
        });
    });

    it("Changing the vestingRegistry, cliff and/or duration should emit RegistryCliffAndDurationUpdated.", async () => {
        newVestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            sov.address,
            staking.address,
            feeSharingCollectorProxy.address,
            creator // This should be Governance Timelock Contract.
        );
        let txReceipt = await newLockedSOV.changeRegistryCliffAndDuration(
            newVestingRegistry.address,
            cliff + 1,
            duration + 1,
            {
                from: admin,
            }
        );
        expectEvent(txReceipt, "RegistryCliffAndDurationUpdated", {
            _initiator: admin,
            _vestingRegistry: newVestingRegistry.address,
            _cliff: new BN(cliff + 1),
            _duration: new BN(duration + 1),
        });
    });

    it("Depositing Tokens using deposit() to own account should emit Deposited.", async () => {
        let basisPoint = randomValue();
        let txReceipt = await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        expectEvent(txReceipt, "Deposited", {
            _initiator: userOne,
            _userAddress: userOne,
            _sovAmount: new BN(value),
            _basisPoint: new BN(basisPoint),
        });
    });

    it("Depositing Tokens using deposit() to another account should emit Deposited.", async () => {
        let basisPoint = randomValue();
        let txReceipt = await lockedSOV.deposit(userTwo, value, basisPoint, { from: userOne });
        expectEvent(txReceipt, "Deposited", {
            _initiator: userOne,
            _userAddress: userTwo,
            _sovAmount: new BN(value),
            _basisPoint: new BN(basisPoint),
        });
    });

    it("Depositing Tokens using depositSOV() to own account should emit Deposited.", async () => {
        let txReceipt = await lockedSOV.depositSOV(userOne, value, { from: userOne });
        expectEvent(txReceipt, "Deposited", {
            _initiator: userOne,
            _userAddress: userOne,
            _sovAmount: new BN(value),
            _basisPoint: new BN(zero),
        });
    });

    it("Depositing Tokens using depositSOV() to another account should emit Deposited.", async () => {
        let txReceipt = await lockedSOV.depositSOV(userTwo, value, { from: userOne });
        expectEvent(txReceipt, "Deposited", {
            _initiator: userOne,
            _userAddress: userTwo,
            _sovAmount: new BN(value),
            _basisPoint: new BN(zero),
        });
    });

    it("Withdrawing unlocked Tokens to own account using withdraw() should emit Withdrawn.", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await newLockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        let txReceipt = await newLockedSOV.withdraw(zeroAddress, { from: userOne });
        expectEvent(txReceipt, "Withdrawn", {
            _initiator: userOne,
            _userAddress: userOne,
            _sovAmount: new BN(Math.floor(value / 2)),
        });
    });

    it("Withdrawing unlocked Tokens to another account using withdraw() should emit Withdrawn.", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await newLockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        let txReceipt = await newLockedSOV.withdraw(userTwo, { from: userOne });
        expectEvent(txReceipt, "Withdrawn", {
            _initiator: userOne,
            _userAddress: userTwo,
            _sovAmount: new BN(Math.floor(value / 2)),
        });
    });

    it("Using createVestingAndStake() should emit both VestingCreated and TokenStaked.", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        let lockedBal = await lockedSOV.getLockedBalance(userOne);
        let txReceipt = await lockedSOV.createVestingAndStake({ from: userOne });
        let vestingAddr = await vestingRegistry.getVesting(userOne);
        expectEvent(txReceipt, "VestingCreated", {
            _initiator: userOne,
            _userAddress: userOne,
            _vesting: vestingAddr,
        });
        expectEvent(txReceipt, "TokenStaked", {
            _initiator: userOne,
            _vesting: vestingAddr,
            _amount: new BN(lockedBal),
        });
    });

    it("Using createVesting() should emit VestingCreated.", async () => {
        let txReceipt = await lockedSOV.createVesting({ from: userOne });
        let vestingAddr = await vestingRegistry.getVesting(userOne);
        expectEvent(txReceipt, "VestingCreated", {
            _initiator: userOne,
            _userAddress: userOne,
            _vesting: vestingAddr,
        });
    });

    it("Using stakeTokens() should emit TokenStaked.", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        await lockedSOV.createVesting({ from: userOne });
        let vestingAddr = await vestingRegistry.getVesting(userOne);
        let txReceipt = await lockedSOV.stakeTokens({ from: userOne });
        expectEvent(txReceipt, "TokenStaked", {
            _initiator: userOne,
            _vesting: vestingAddr,
            _amount: new BN(Math.ceil(value / 2)),
        });
    });

    it("Starting migration should emit MigrationStarted.", async () => {
        let txReceipt = await lockedSOV.startMigration(newLockedSOV.address, { from: admin });
        expectEvent(txReceipt, "MigrationStarted", {
            _initiator: admin,
            _newLockedSOV: newLockedSOV.address,
        });
    });

    it("Transfering locked balance using transfer() should emit UserTransfered.", async () => {
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });

        // Migratioin started by Admin
        await lockedSOV.startMigration(newLockedSOV.address, { from: admin });

        let txReceipt = await lockedSOV.transfer({ from: userOne });
        expectEvent(txReceipt, "UserTransfered", {
            _initiator: userOne,
            _amount: new BN(Math.ceil(value / 2)),
        });
    });

    it("Using withdrawAndStakeTokens() should emit Withdrawn and TokenStaked.", async () => {
        // Creating the instance of LockedSOV Contract.
        lockedSOV = await LockedSOV.new(sov.address, vestingRegistry.address, cliff, duration, [
            admin,
        ]);

        // Adding lockedSOV as an admin in the Vesting Registry.
        await vestingRegistry.addAdmin(lockedSOV.address);

        let value = randomValue() + 10;
        await sov.mint(userOne, value);
        await sov.approve(lockedSOV.address, value, { from: userOne });

        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        let vestingAddr = await vestingRegistry.getVesting(userOne);
        let txReceipt = await lockedSOV.withdrawAndStakeTokens(userOne, { from: userOne });
        expectEvent(txReceipt, "Withdrawn", {
            _initiator: userOne,
            _userAddress: userOne,
            _sovAmount: new BN(Math.floor(value / 2)),
        });
        expectEvent(txReceipt, "TokenStaked", {
            _initiator: userOne,
            _vesting: vestingAddr,
            _amount: new BN(Math.ceil(value / 2)),
        });
    });

    it("Using withdrawAndStakeTokensFrom() should emit Withdrawn and TokenStaked.", async () => {
        let value = randomValue() + 10;
        await sov.mint(userOne, value);
        await sov.approve(lockedSOV.address, value, { from: userOne });
        let basisPoint = 5000; // 50% will be unlocked, rest will go to locked balance.
        await lockedSOV.deposit(userOne, value, basisPoint, { from: userOne });
        let vestingAddr = await vestingRegistry.getVesting(userOne);
        let txReceipt = await lockedSOV.withdrawAndStakeTokensFrom(userOne, { from: userTwo });
        expectEvent(txReceipt, "Withdrawn", {
            _initiator: userOne,
            _userAddress: userOne,
            _sovAmount: new BN(Math.floor(value / 2)),
        });
        expectEvent(txReceipt, "TokenStaked", {
            _initiator: userOne,
            _vesting: vestingAddr,
            _amount: new BN(Math.ceil(value / 2)),
        });
    });
});
