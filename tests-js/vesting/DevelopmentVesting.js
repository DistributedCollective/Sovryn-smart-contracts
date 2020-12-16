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
const DevelopmentVesting = artifacts.require('DevelopmentVesting');

const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const WEEK = new BN(7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "10000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";

contract('DevelopmentVesting:', accounts => {
    const name = 'Test token';
    const symbol = 'TST';

    let root, account1, account2, account3;
    let token, staking, stakingLogic;
    let developmentVesting;
    let kickoffTS;

    let cliff = "10";
    let duration = "100";

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        stakingLogic = await StakingLogic.new(token.address);
        staking = await StakingProxy.new(token.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);

        // await token.transfer(account2, "1000");
        // await token.approve(staking.address, "1000", {from: account2});
        //
        // kickoffTS = await staking.kickoffTS.call();

        developmentVesting = await DevelopmentVesting.new(token.address, root, cliff, duration);

    });

    describe('constructor:', () => {

        it('sets the expected values', async () => {
            //Check data
            let _sov = await developmentVesting.SOV();
            let _tokenOwner = await developmentVesting.tokenOwner();
            let _cliff = await developmentVesting.cliff();
            let _duration = await developmentVesting.duration();

            assert.equal(_sov, token.address);
            assert.equal(_tokenOwner, root);
            assert.equal(_cliff.toString(), cliff);
            assert.equal(_duration.toString(), duration);
        });

        it('fails if the 0 address is passed as SOV address', async () => {
            await expectRevert(DevelopmentVesting.new(ZERO_ADDRESS, root, cliff, duration),
                "SOV address invalid");
        });

        it('fails if the 0 address is passed as token owner address', async () => {
            await expectRevert(DevelopmentVesting.new(token.address, ZERO_ADDRESS, cliff, duration),
                "token owner address invalid");
        });

        it('fails if the vesting duration is shorter than the cliff', async () => {
            await expectRevert(DevelopmentVesting.new(token.address, root, 100, 99),
                "duration must be bigger than or equal to the cliff");
        });

    });

    describe('changeSchedule:', () => {

    });

    describe('stakeTokens:', () => {

    });

    describe('withdrawTokens:', () => {

    });

    describe('transferLockedTokens:', () => {

    });

    describe('_getAvailableAmount:', () => {

    });

    describe('_getUnlockedAmount:', () => {

    });

});
