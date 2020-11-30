const {expect} = require('chai');
const {expectRevert, expectEvent, constants, BN, balance, time} = require('@openzeppelin/test-helpers');
const {
    address,
    minerStart,
    minerStop,
    unlockedAccount,
    mineBlock,
    etherMantissa,
    etherUnsigned,
    setTime
} = require('../Utils/Ethereum');

const StakingLogic = artifacts.require('Staking');
const StakingProxy = artifacts.require('StakingProxy');
const TestToken = artifacts.require('TestToken');
const Vesting = artifacts.require('Vesting');

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const TOTAL_SUPPLY = "10000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";

contract('Vesting', accounts => {
    const name = 'Test token';
    const symbol = 'TST';

    let root, a1, a2, a3;
    let token, staking;
    let kickoffTS;

    let cliff = "10";
    let duration = "100";

    before(async () => {
        [root, a1, a2, a3, ...accounts] = accounts;
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        stakingLogic = await StakingLogic.new(token.address);
        staking = await StakingProxy.new(token.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);

        await token.transfer(a2, "1000");
        await token.approve(staking.address, "1000", {from: a2});

        kickoffTS = await staking.kickoffTS.call();
    });

    describe('constructor', () => {
        it('sets the expected values', async () => {
            await Vesting.new(token.address, staking.address, root, cliff, duration);
        });

        it('fails if the 0 address is passed as SOV address', async () => {
            await expectRevert(Vesting.new(constants.ZERO_ADDRESS, staking.address, root, cliff, duration), "SOV address invalid");
        });

        it('fails if the 0 address is passed as token owner address', async () => {
            await expectRevert(Vesting.new(token.address, staking.address, constants.ZERO_ADDRESS, cliff, duration), "token owner address invalid");
        });

        it('fails if the 0 address is passed as staking address', async () => {
            await expectRevert(Vesting.new(token.address, constants.ZERO_ADDRESS, root, cliff, duration), "staking address invalid");
        });

        it('fails if the vesting duration is bigger than the max staking duration', async () => {
            await expectRevert(Vesting.new(token.address, staking.address, root, cliff, MAX_DURATION.add(new BN(1))), "duration may not exceed the max duration");
        });

        it('fails if the vesting duration is shorter than the cliff', async () => {
            await expectRevert(Vesting.new(token.address, staking.address, root, 100, 99), "duration must be bigger than or equal to the cliff");
        });
    });

    describe('stakeTokens', () => {
        let vesting;
        it('should stake 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff', async () => {
            vesting = await Vesting.new(token.address, staking.address, root, new BN(26 * 7 * 24 * 60 * 60), new BN(104 * 7 * 24 * 60 * 60));

            await token.approve(vesting.address, ONE_MILLON);
            await vesting.stakeTokens(ONE_MILLON);
        });

        it('should stake the same, but this time the user already possesses a stake', async () => {

        });

        it('should fail to stake twice', async () => {
            await token.approve(vesting.address, ONE_MILLON);
            await expectRevert(vesting.stakeTokens(ONE_MILLON), "stakeTokens can be called only once.");
        });

    });

    describe('withdrawTokens',() => {
        let vesting;
        it('should withdraw unlocked tokens', async () => {

            //Save current amount
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            //Stake
            vesting = await Vesting.new(token.address, staking.address, root, new BN(26 * 7 * 24 * 60 * 60), new BN(104 * 7 * 24 * 60 * 60));

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            //time travel
            await time.increase(new BN(104 * 7 * 24 * 60 * 60));

            //withdraw
            await vesting.withdrawTokens(root);

            //verify amount
            let amount = await token.balanceOf(root);

            assert.equal(previousAmount.sub(new BN(toStake)).toString(), amountAfterStake.toString());
            assert.equal(previousAmount.toString(), amount.toString());

        });

        it('should do nothing if withdrawing a second time', async() => {
            // This part should be tested on staking contract, function getPriorUserStakeByDate
            let previousAmount = await token.balanceOf(root);
            await vesting.withdrawTokens(root);
            let amount = await token.balanceOf(root);

            assert.equal(previousAmount.toString(), amount.toString());
        });

        it('should do nothing if withdrawing before reaching the cliff', async() => {
            let toStake = ONE_MILLON;

            vesting = await Vesting.new(token.address, staking.address, a1, new BN(26 * 7 * 24 * 60 * 60), new BN(104 * 7 * 24 * 60 * 60));

            let previousAmount = await token.balanceOf(root);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            //time travel
            await time.increase(new BN(25 * 7 * 24 * 60 * 60));

            await vesting.withdrawTokens(root, {from: a1});
            let amount = await token.balanceOf(root);

            assert.equal(previousAmount.sub(new BN(toStake)).toString(), amountAfterStake.toString());
            assert.equal(amountAfterStake.toString(), amount.toString());
        });

        it('should fail if the caller is neither owner nor token owner', async() => {
            await expectRevert(vesting.withdrawTokens(root, {from: a2}), "unauthorized");
            await expectRevert(vesting.withdrawTokens(root, {from: a3}), "unauthorized");

            await vesting.withdrawTokens(root, {from: root});
            await vesting.withdrawTokens(root, {from: a1});
        });
    });

    describe('collectDividends', async() => {
        let vesting;
        it('', async() => {
            vesting = await Vesting.new(token.address, staking.address, a1, new BN(26 * 7 * 24 * 60 * 60), new BN(104 * 7 * 24 * 60 * 60));
        });

        it('should fail if the caller is neither owner nor token owner', async() => {
            await expectRevert(vesting.collectDividends({from: a2}), "unauthorized");
            await expectRevert(vesting.collectDividends({from: a3}), "unauthorized");

            await vesting.collectDividends({from: root});
            await vesting.collectDividends({from: a1});
        });
    });

    describe('migrateToNewStakingContract', async() => {
        let vesting;
        it('should set the new staking contract', async() => {

            vesting = await Vesting.new(token.address, staking.address, a1, new BN(26 * 7 * 24 * 60 * 60), new BN(104 * 7 * 24 * 60 * 60));
            //1. set new staking contract address on staking contract

            let newStaking = await StakingProxy.new(token.address);
            await newStaking.setImplementation(stakingLogic.address);
            newStaking = await StakingLogic.at(newStaking.address);

            await staking.setNewStakingContract(newStaking.address);

            //2. call migrateToNewStakingContract
            await vesting.migrateToNewStakingContract();
        });

        it('should fail if there is no new staking contract set', async() => {
            let newStaking = await StakingProxy.new(token.address);
            await newStaking.setImplementation(stakingLogic.address);
            newStaking = await StakingLogic.at(newStaking.address);

            vesting = await Vesting.new(token.address, newStaking.address, a1, new BN(26 * 7 * 24 * 60 * 60), new BN(104 * 7 * 24 * 60 * 60));
            await expectRevert(vesting.migrateToNewStakingContract(), "there is no new staking contract set");
        });

        it('should fail if the caller is neither owner nor token owner', async() => {
            let newStaking = await StakingProxy.new(token.address);
            await newStaking.setImplementation(stakingLogic.address);
            newStaking = await StakingLogic.at(newStaking.address);

            vesting = await Vesting.new(token.address, newStaking.address, a1, new BN(26 * 7 * 24 * 60 * 60), new BN(104 * 7 * 24 * 60 * 60));
            await newStaking.setNewStakingContract(newStaking.address);

            await expectRevert(vesting.migrateToNewStakingContract({from: a2}), "unauthorized");
            await expectRevert(vesting.migrateToNewStakingContract({from: a3}), "unauthorized");

            await vesting.migrateToNewStakingContract();
            await vesting.migrateToNewStakingContract({from: a1});
        });
    })
});