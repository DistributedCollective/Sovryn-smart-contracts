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

const Staking = artifacts.require('Staking');
const TestToken = artifacts.require('TestToken');

const TOTAL_SUPPLY = "10000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DAY = 86400;
const TWO_WEEKS = 1209600;

const DELAY = 86400 * 14;

contract('Staking', accounts => {
    const name = 'Test token';
    const symbol = 'TST';

    let root, account1, account2, account3;
    let token, staking;

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
    });

    beforeEach(async () => {
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        staking = await Staking.new(token.address);
        await token.transfer(account1, 1000);

        await token.approve(staking.address, TOTAL_SUPPLY);
    });

    describe('stake', () => {

        it("Amount should be positive", async () => {
            await expectRevert(staking.stake(0, DELAY, root, root),
                "amount of tokens to stake needs to be bigger than 0");
        });

        it("Use 'increaseStake' to increase an existing staked position", async () => {
            await staking.stake(100, DELAY, root, root);

            await expectRevert(staking.stake(100, DELAY, root, root),
                "Staking:stake: use 'increaseStake' to increase an existing staked position");
        });

        it("Amount should be approved", async () => {
            await expectRevert(staking.stake(100, DELAY, root, root, {from: account1}),
                "invalid transfer");
        });

        it("Staking period too short", async () => {
            await expectRevert(staking.stake(100, DAY, root, root),
                "Staking::timestampToLockDate: staking period too short");
        });

        it("Should be able to stake and delegate for yourself", async () => {
            let amount = "100";
            let duration = TWO_WEEKS;
            let tx = await staking.stake(amount, duration, root, root);

            let lockedTS = await getTimeFromKickoff(duration);
            expectEvent(tx, 'TokensStaked', {
                staker: root,
                amount: amount,
                lockedUntil: lockedTS,
                totalStaked: amount,
            });
        });

        it("Should be able to stake and delegate for another person", async () => {
            let amount = "100";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let tx = await staking.stake(amount, duration, account1, account1);

            let lockedTS = await getTimeFromKickoff(duration);
            expectEvent(tx, 'TokensStaked', {
                staker: account1,
                amount: amount,
                lockedUntil: lockedTS,
                totalStaked: amount,
            });
        });

        it("Shouldn't be able to stake longer than max duration", async () => {
            let amount = "100";
            let tx = await staking.stake(amount, MAX_DURATION, account1, root);

            let lockedTS = await getTimeFromKickoff(MAX_DURATION);
            expectEvent(tx, 'TokensStaked', {
                staker: account1,
                amount: amount,
                lockedUntil: lockedTS,
                totalStaked: amount,
            });
        });

    });

    describe('timestampToLockDate', () => {
        before(async () => {
            [root, account1, account2, account3, ...accounts] = accounts;

            token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
            staking = await Staking.new(token.address);
        });

        it("Lock date should be start + 1 period", async () => {
            let kickoffTS = await staking.kickoffTS.call();
            let newTime = kickoffTS.add(new BN(TWO_WEEKS));
            await setTime(newTime);

            let result = await staking.timestampToLockDate(newTime);
            expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS);
        });

        it("Lock date should be start + 2 period", async () => {
            let kickoffTS = await staking.kickoffTS.call();
            let newTime = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)).add(new BN(DAY)));
            await setTime(newTime);

            let result = await staking.timestampToLockDate(newTime);
            expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS * 2);
        });

        it("Lock date should be start + 3 period", async () => {
            let kickoffTS = await staking.kickoffTS.call();
            let newTime = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(3)).add(new BN(DAY)));
            await setTime(newTime);

            let result = await staking.timestampToLockDate(newTime);
            expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS * 3);
        });

    });

    async function getTimeFromKickoff(delay) {
        let kickoffTS = await staking.kickoffTS.call();
        return kickoffTS.add(new BN(delay));
    }

});
