// For this test, governance contract and multisig wallet will be done by normal wallets.
// They will acts as locked and unlocked owner.

/** Speed optimized on branch hardhatTestRefactor, 2021-10-04
 * Bottleneck found at beforeEach hook, redeploying DevelopmentFund and token on every test.
 *
 * Total time elapsed: 4.8s
 * After optimization: 4.2s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Removed redundant calculations from some tests at the beginning
 */

const DevelopmentFund = artifacts.require("DevelopmentFund");
const TestToken = artifacts.require("TestToken");

const {
    time, // Convert different time units to seconds. Available helpers are: seconds, minutes, hours, days, weeks and years.
    BN, // Big Number support.
    expectEvent, // Assertions for emitted events.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

// Some constants we would be using in the contract.
let zero = new BN(0);
const totalSupply = 1000000;
let releaseInterval = 600; // 10 minutes.
let releaseDuration = [];
let releaseTokenAmount = [];
let totalReleaseTokenAmount = 0;

/**
 * Function to create a random value.
 * It expects no parameter.
 *
 * @return {number} Random Value.
 */
function randomValue() {
    return Math.floor(Math.random() * 1000);
}

/**
 * Function to create a random token amount with 60 items (considering one for each month for 5 years).
 *
 * @returns releaseTokenAmounts The release token amount array.
 */
function createReleaseTokenAmount() {
    let balance = totalSupply;
    let releaseTokenAmounts = [];
    for (let times = 0; times < 60; times++) {
        let newValue = randomValue() * 10; // Get's a number between 0 to 10000.
        balance -= newValue;
        releaseTokenAmounts.push(newValue);
    }
    return releaseTokenAmounts;
}

/**
 * Function to calculate the sum of tokens in a schedule.
 *
 * @param releaseTokenAmounts The release token amount array.
 * @returns totalTokenAmounts The total number of tokens for the release.
 */
function calculateTotalTokenAmount(releaseTokenAmounts) {
    return releaseTokenAmounts.reduce((a, b) => a + b, 0);
}

contract("DevelopmentFund (Events)", (accounts) => {
    let developmentFund, testToken;
    let creator, governance, newGovernance, multisig, newMultisig, safeVault, userOne;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Creating a new release schedule.
        releaseDuration = [];
        // This is run 60 times for mimicking 5 years (12 months * 5), though the interval is small.
        for (let times = 0; times < 60; times++) {
            releaseDuration.push(releaseInterval);
        }

        // Creating a new release token schedule.
        releaseTokenAmount = createReleaseTokenAmount();

        // Creating the contract instance.
        developmentFund = await DevelopmentFund.new(
            testToken.address,
            governance,
            safeVault,
            multisig,
            zero,
            releaseDuration,
            releaseTokenAmount,
            { from: creator }
        );

        // Calculating the total tokens in the release schedule.
        totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);

        // Minting new Tokens.
        await testToken.mint(creator, totalSupply, { from: creator });

        // Approving the development fund to do a transfer on behalf of governance.
        await testToken.approve(developmentFund.address, totalReleaseTokenAmount, {
            from: creator,
        });

        // Marking the contract as active.
        await developmentFund.init({ from: creator });
    }

    before("Initiating Accounts & Creating Test Token Instance.", async () => {
        // Checking if we have enough accounts to test.
        assert.isAtLeast(
            accounts.length,
            7,
            "At least 7 accounts are required to test the contracts."
        );
        [creator, governance, newGovernance, multisig, newMultisig, safeVault, userOne] = accounts;

        // Creating the instance of Test Token.
        testToken = await TestToken.new("TestToken", "TST", 18, zero);
    });

    beforeEach("Creating New Development Fund Instance.", async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    it("Adding a new locked owner should emit NewLockedOwnerAdded event.", async () => {
        let txReceipt = await developmentFund.updateLockedTokenOwner(newGovernance, {
            from: governance,
        });
        expectEvent(txReceipt, "NewLockedOwnerAdded", {
            _initiator: governance,
            _newLockedOwner: newGovernance,
        });
    });

    it("Approving a new Locked Token Owner should emit NewLockedOwnerApproved event.", async () => {
        await developmentFund.updateLockedTokenOwner(newGovernance, { from: governance });
        let txReceipt = await developmentFund.approveLockedTokenOwner({ from: multisig });
        expectEvent(txReceipt, "NewLockedOwnerApproved", {
            _initiator: multisig,
            _oldLockedOwner: governance,
            _newLockedOwner: newGovernance,
        });
    });

    it("Updating the Unlocked Token Owner should emit UnlockedOwnerUpdated event.", async () => {
        let txReceipt = await developmentFund.updateUnlockedTokenOwner(newMultisig, {
            from: governance,
        });
        expectEvent(txReceipt, "UnlockedOwnerUpdated", {
            _initiator: governance,
            _newUnlockedOwner: newMultisig,
        });
    });

    it("Depositing Token should emit the TokenDeposit event.", async () => {
        let value = randomValue() + 1;
        await testToken.mint(userOne, value);
        await testToken.approve(developmentFund.address, value, { from: userOne });
        let txReceipt = await developmentFund.depositTokens(value, { from: userOne });
        expectEvent(txReceipt, "TokenDeposit", {
            _initiator: userOne,
            _amount: new BN(value),
        });
    });

    it("Updating the Release Schedule should emit TokenReleaseChanged event.", async () => {
        await testToken.mint(governance, totalReleaseTokenAmount);
        await testToken.approve(developmentFund.address, totalReleaseTokenAmount, {
            from: governance,
        });
        let txReceipt = await developmentFund.changeTokenReleaseSchedule(
            zero,
            releaseDuration,
            releaseTokenAmount,
            { from: governance }
        );
        expectEvent(txReceipt, "TokenReleaseChanged", {
            _initiator: governance,
            _releaseCount: new BN(60),
        });
    });

    it("Transferring all tokens to safeVault by Unlocked Token Owner should emit LockedTokenTransferByUnlockedOwner event.", async () => {
        let txReceipt = await developmentFund.transferTokensByUnlockedTokenOwner({
            from: multisig,
        });
        expectEvent(txReceipt, "DevelopmentFundExpired");
        expectEvent(txReceipt, "LockedTokenTransferByUnlockedOwner", {
            _initiator: multisig,
            _receiver: safeVault,
            _amount: new BN(totalReleaseTokenAmount),
        });
    });

    it("Withdrawing tokens based on schedule should emit UnlockedTokenWithdrawalByUnlockedOwner event.", async () => {
        await testToken.mint(governance, totalReleaseTokenAmount);
        await testToken.approve(developmentFund.address, totalReleaseTokenAmount, {
            from: governance,
        });
        await developmentFund.changeTokenReleaseSchedule(
            zero,
            releaseDuration,
            releaseTokenAmount,
            { from: governance }
        );

        // Increasing the time to pass atleast one duration.
        await time.increase(releaseDuration[releaseDuration.length - 1] + 1);

        let txReceipt = await developmentFund.withdrawTokensByUnlockedTokenOwner(
            releaseTokenAmount[releaseTokenAmount.length - 1],
            {
                from: multisig,
            }
        );
        expectEvent(txReceipt, "UnlockedTokenWithdrawalByUnlockedOwner", {
            _initiator: multisig,
            _amount: new BN(releaseTokenAmount[releaseTokenAmount.length - 1]),
            _releaseCount: new BN(1),
        });
    });

    it("Transferring all tokens to a receiver by Locked Token Owner should emit LockedTokenTransferByLockedOwner event.", async () => {
        let txReceipt = await developmentFund.transferTokensByLockedTokenOwner(creator, {
            from: governance,
        });
        expectEvent(txReceipt, "DevelopmentFundExpired");
        expectEvent(txReceipt, "LockedTokenTransferByLockedOwner", {
            _initiator: governance,
            _receiver: creator,
            _amount: new BN(totalReleaseTokenAmount),
        });
    });
});
