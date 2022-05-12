/** Speed optimized on branch hardhatTestRefactor, 2021-10-05
 * No tests found.
 *
 * TODO: Maybe this file should be removed.
 *   Similar code found at:
 *     Sovryn-smart-contracts/tests/staking/StakingTest.js
 *
 * Total time elapsed: 3.6s
 *
 */

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");

const TOTAL_SUPPLY = "10000000000000000000000000";

contract("TeamVesting", (accounts) => {
    const name = "Test token";
    const symbol = "TST";

    let root, a1, a2, a3;
    let token, staking;
    let kickoffTS;

    before(async () => {
        [root, a1, a2, a3, ...accounts] = accounts;
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        let stakingLogic = await StakingLogic.new(token.address);
        staking = await StakingProxy.new(token.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);

        await token.transfer(a2, "1000");
        await token.approve(staking.address, "1000", { from: a2 });

        kickoffTS = await staking.kickoffTS.call();
    });
});
