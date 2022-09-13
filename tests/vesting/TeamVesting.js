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

        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(token.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        await token.transfer(a2, "1000");
        await token.approve(staking.address, "1000", { from: a2 });

        kickoffTS = await staking.kickoffTS.call();
    });
    //TODO: where are tests???
});
