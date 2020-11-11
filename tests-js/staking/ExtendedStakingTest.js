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

const TOTAL_SUPPLY = "100000000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DAY = 86400;
const TWO_WEEKS = 1209600;

const DELAY = 86400 * 14;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

        it("Shouldn't be able to stake longer than max duration", async () => {
            let amount = "100";
            let tx = await staking.stake(amount, MAX_DURATION, account1, account1);

            let lockedTS = await getTimeFromKickoff(MAX_DURATION);
            expectEvent(tx, 'TokensStaked', {
                staker: account1,
                amount: amount,
                lockedUntil: lockedTS,
                totalStaked: amount,
            });

            expectEvent(tx, 'DelegateChanged', {
                delegator: account1,
                fromDelegate: ZERO_ADDRESS,
                toDelegate: account1
            });
        });

        it("Sender should be used if zero addresses passed", async () => {
            let amount = "100";
            let tx = await staking.stake(amount, MAX_DURATION, ZERO_ADDRESS, ZERO_ADDRESS);

            let lockedTS = await getTimeFromKickoff(MAX_DURATION);
            expectEvent(tx, 'TokensStaked', {
                staker: root,
                amount: amount,
                lockedUntil: lockedTS,
                totalStaked: amount,
            });

            expectEvent(tx, 'DelegateChanged', {
                delegator: root,
                fromDelegate: ZERO_ADDRESS,
                toDelegate: root
            });

        });

        it("Should be able to stake and delegate for yourself", async () => {
            let amount = "100";
            let duration = TWO_WEEKS;
            let tx = await staking.stake(amount, duration, root, root);

            let lockedTS = await getTimeFromKickoff(duration);

            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserCheckpoints.call(root);
            expect(numUserCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await staking.userCheckpoints.call(root, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            expect(checkpoint.lockedUntil.toString()).to.be.equal(lockedTS.toString());

            //_increaseDailyStake
            let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
            expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
            checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            //_delegate
            let delegator = await staking.delegates.call(root);
            expect(delegator).to.be.equal(root);

            let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(root, lockedTS);
            expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(1);
            checkpoint = await staking.delegateStakingCheckpoints.call(root, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            expectEvent(tx, 'TokensStaked', {
                staker: root,
                amount: amount,
                lockedUntil: lockedTS,
                totalStaked: amount,
            });

            expectEvent(tx, 'DelegateChanged', {
                delegator: root,
                fromDelegate: ZERO_ADDRESS,
                toDelegate: root
            });
        });

        it("Should be able to stake and delegate for another person", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let tx = await staking.stake(amount, duration, account1, account1);

            let lockedTS = await getTimeFromKickoff(duration);

            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserCheckpoints.call(account1);
            expect(numUserCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await staking.userCheckpoints.call(account1, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            expect(checkpoint.lockedUntil.toString()).to.be.equal(lockedTS.toString());

            //_increaseDailyStake
            let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
            expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
            checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            //_delegate
            let delegator = await staking.delegates.call(account1);
            expect(delegator).to.be.equal(account1);

            let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints.call(account1, lockedTS);
            expect(numDelegateStakingCheckpoints.toNumber()).to.be.equal(1);
            checkpoint = await staking.delegateStakingCheckpoints.call(account1, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            expectEvent(tx, 'TokensStaked', {
                staker: account1,
                amount: amount,
                lockedUntil: lockedTS,
                totalStaked: amount,
            });

            expectEvent(tx, 'DelegateChanged', {
                delegator: account1,
                fromDelegate: ZERO_ADDRESS,
                toDelegate: account1
            });
        });

    });

    describe('extendStakingDuration', () => {

        it("Cannot reduce the staking duration", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            await staking.stake(amount, duration, root, root);

            let newTime = await getTimeFromKickoff(TWO_WEEKS);
            await expectRevert(staking.extendStakingDuration(newTime),
                "Staking::extendStakingDuration: cannot reduce the staking duration");
        });

        it("Do not exceed the max duration", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            await staking.stake(amount, duration, root, root);

            let newTime = await getTimeFromKickoff(MAX_DURATION.mul(new BN(2)));
            let tx = await staking.extendStakingDuration(newTime);

            let lockedTS = await getTimeFromKickoff(duration);
            let cuurentTime = await time.latest();
            let newLockedTs = cuurentTime.add(MAX_DURATION);
            expectEvent(tx, 'ExtendedStakingDuration', {
                staker: root,
                previousDate: lockedTS,
                newDate: newLockedTs
            });
        });

        it("Should be able to extend staking duration", async () => {
            let amount = "1000";
            let tx1 = await staking.stake(amount, TWO_WEEKS, root, root);

            let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
            let newLockedTS = await getTimeFromKickoff(TWO_WEEKS * 2);
            let tx2 = await staking.extendStakingDuration(newLockedTS);

            //_decreaseDailyStake
            let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
            expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(2);
            let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal("0");

            //_increaseDailyStake
            numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(newLockedTS);
            expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
            checkpoint = await staking.totalStakingCheckpoints.call(newLockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserCheckpoints.call(root);
            expect(numUserCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await staking.userCheckpoints.call(root, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            expect(checkpoint.lockedUntil.toString()).to.be.equal(lockedTS.toString());
            checkpoint = await staking.userCheckpoints.call(root, 1);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            expect(checkpoint.lockedUntil.toString()).to.be.equal(newLockedTS.toString());

            expectEvent(tx2, 'ExtendedStakingDuration', {
                staker: root,
                previousDate: lockedTS,
                newDate: newLockedTS
            });
        });

    });

    describe('increaseStake', () => {

        it("Amount of tokens to stake needs to be bigger than 0", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            await staking.stake(amount, duration, root, root);

            await expectRevert(staking.increaseStake("0", root),
                "Staking::increaseStake: amount of tokens to stake needs to be bigger than 0");
        });

        it("Amount of tokens to stake needs to be bigger than 0", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            await staking.stake(amount, duration, root, root);

            await token.approve(staking.address, 0);
            await expectRevert(staking.increaseStake(amount, root),
                "invalid transfer");
        });

        it("Shouldn't be able to overflow balance", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            await staking.stake(amount, duration, root, root);

            let maxValue = new BN(2).pow(new BN(96)).sub(new BN(1));
            await expectRevert(staking.increaseStake(maxValue.sub(new BN(100)), root),
                "Staking::increaseStake: balance overflow");
        });

        it("Should be able to increase stake", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let tx1 = await staking.stake(amount, duration, root, root);

            let tx2 = await staking.increaseStake(amount * 2, root);

            let lockedTS = await getTimeFromKickoff(duration);

            //_increaseDailyStake
            let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
            expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(2);
            let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount * 3);

            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserCheckpoints.call(root);
            expect(numUserCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await staking.userCheckpoints.call(root, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            expect(checkpoint.lockedUntil.toString()).to.be.equal(lockedTS.toString());
            checkpoint = await staking.userCheckpoints.call(root, 1);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount * 3);
            expect(checkpoint.lockedUntil.toString()).to.be.equal(lockedTS.toString());

            expectEvent(tx2, 'TokensStaked', {
                staker: root,
                amount: new BN(amount * 2),
                lockedUntil: lockedTS,
                totalStaked: new BN(amount * 3)
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
