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
const DevelopmentVesting = artifacts.require('DevelopmentVestingMockup');

const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const WEEK = new BN(7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "10000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";

contract('DevelopmentVesting:', accounts => {
    const name = 'Test token';
    const symbol = 'TST';

    let root, account1, account2, account3;
    let token, staking, stakingLogic;
    let vesting;
    let kickoffTS;

    let cliff = WEEK;
    let duration = WEEK.mul(new BN(11));
    let frequency = WEEK.mul(new BN(2));

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        stakingLogic = await StakingLogic.new(token.address);
        staking = await StakingProxy.new(token.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);

        vesting = await DevelopmentVesting.new(token.address, root, cliff, duration, frequency);

    });

    describe('constructor:', () => {

        it('sets the expected values', async () => {
            //Check data
            let _sov = await vesting.SOV();
            let _tokenOwner = await vesting.tokenOwner();
            let _cliff = await vesting.cliff();
            let _duration = await vesting.duration();
            let _frequency = await vesting.frequency();

            assert.equal(_sov, token.address);
            assert.equal(_tokenOwner, root);
            assert.equal(_cliff.toString(), cliff);
            assert.equal(_duration.toString(), duration);
            assert.equal(_frequency.toString(), frequency);
        });

        it('fails if the 0 address is passed as SOV address', async () => {
            await expectRevert(DevelopmentVesting.new(ZERO_ADDRESS, root, 10, 100, 30),
                "SOV address invalid");
        });

        it('fails if the 0 address is passed as token owner address', async () => {
            await expectRevert(DevelopmentVesting.new(token.address, ZERO_ADDRESS, 10, 100, 30),
                "token owner address invalid");
        });

        it('fails if the vesting duration is shorter than the cliff', async () => {
            await expectRevert(DevelopmentVesting.new(token.address, root, 100, 99, 100),
                "duration must be bigger than or equal to the cliff");
        });

        it('fails if the vesting duration is shorter than the frequency', async () => {
            await expectRevert(DevelopmentVesting.new(token.address, root,10, 100, 200),
                "frequency is bigger than (duration - cliff)");
        });

    });

    describe('changeSchedule:', () => {

        it('change schedule to unlock tokens', async () => {
            let amount = 1000;
            await token.approve(vesting.address, amount);
            await vesting.vestTokens(amount);

            let unlockedAmount = await vesting.getUnlockedAmount(0);
            expect(unlockedAmount.toNumber()).to.be.equal(0);

            await vesting.changeSchedule(0, 0, 0);

            unlockedAmount = await vesting.getUnlockedAmount(0);
            expect(unlockedAmount.toNumber()).to.be.equal(amount);
        });

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
