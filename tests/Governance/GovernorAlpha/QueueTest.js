/** Speed optimized on branch hardhatTestRefactor, 2021-09-22
 * Bottlenecks found redeploying staking and governance.
 *
 * Notes:
 * Init deployments (token, staking and gov) has been isolated into the before hook.
 * As there are only two tests, and run independently (hardhat vs ganache) there's not
 * advantage on creating a fixture for the init deployments.
 */

const { expectRevert, BN } = require("@openzeppelin/test-helpers");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

const {
    etherMantissa,
    encodeParameters,
    mineBlock,
    increaseTime,
} = require("../../Utils/Ethereum");
const { deployAndGetIStaking } = require("../../Utils/initializer");
const { ethers } = require("hardhat");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("TimelockHarness");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");
//Upgradable Vesting Registry
const VestingRegistry = artifacts.require("VestingRegistry");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const DELAY = 86400 * 14;

const QUORUM_VOTES = etherMantissa(4000000);
const TOTAL_SUPPLY = etherMantissa(10000000000000); /// @dev increased to share the same value in both tests.

async function enfranchise(token, staking, actor, amount) {
    await token.transfer(actor, amount);
    await token.approve(staking.address, amount, { from: actor });
    let kickoffTS = await staking.kickoffTS.call();
    let stakingDate = kickoffTS.add(new BN(DELAY));
    //Upgradable Vesting Registry
    vestingRegistry = await VestingRegistry.new();
    vesting = await VestingRegistryProxy.new();
    await vesting.setImplementation(vestingRegistry.address);
    vesting = await VestingRegistry.at(vesting.address);

    await staking.setVestingRegistry(vesting.address);
    await staking.stake(amount, stakingDate, actor, actor, { from: actor });
}

contract("GovernorAlpha#queue/1", (accounts) => {
    let root, a1, a2;
    let token, staking, gov;

    before(async () => {
        [root, a1, a2, ...accounts] = accounts;

        const timelock = await Timelock.new(root, DELAY);
        token = await TestToken.new("TestToken", "TST", 18, TOTAL_SUPPLY);

        /// Staking Modules
        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(token.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        gov = await GovernorAlpha.new(timelock.address, staking.address, root, 4, 0);

        await timelock.harnessSetAdmin(gov.address);

        await enfranchise(token, staking, a1, QUORUM_VOTES);
        await mineBlock();
    });

    describe("overlapping actions", () => {
        it("reverts on queueing overlapping actions in same proposal", async () => {
            const targets = [staking.address, staking.address];
            const values = ["0", "0"];
            const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
            const calldatas = [
                encodeParameters(["address"], [root]),
                encodeParameters(["address"], [root]),
            ];

            await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a1 });
            let proposalId1 = await gov.proposalCount.call();
            await mineBlock();

            await gov.castVote(proposalId1, true, { from: a1 });
            await advanceBlocks(10);
            await expectRevert(
                gov.queue(proposalId1),
                "GovernorAlpha::_queueOrRevert: proposal action already queued at eta"
            );
        });

        it("reverts on queueing overlapping actions in different proposals, works if waiting", async () => {
            await enfranchise(token, staking, a2, QUORUM_VOTES);
            //await mineBlock();

            await mine();

            const targets = [staking.address];
            const values = ["0"];
            const signatures = ["getBalanceOf(address)"];
            const calldatas = [encodeParameters(["address"], [root])];

            await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a1 });
            let proposalId1 = await gov.proposalCount.call();

            await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a2 });
            let proposalId2 = await gov.proposalCount.call();
            await mineBlock();

            await gov.castVote(proposalId1, true, { from: a1 });
            await gov.castVote(proposalId2, true, { from: a2 });

            await mine(30);
            await expectRevert(
                gov.queueProposals([proposalId1, proposalId2]),
                "GovernorAlpha::_queueOrRevert: proposal action already queued at eta"
            );

            await gov.queue(proposalId1);
            await ethers.provider.send("evm_increaseTime", [60]);
            await mine();

            await gov.queue(proposalId2);
        });
    });
});

async function advanceBlocks(number) {
    for (let i = 0; i < number; i++) {
        await mineBlock();
    }
}
