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
const StakingMockup = artifacts.require('StakingMockup');

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
    let kickoffTS, inOneWeek;

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
    });

    beforeEach(async () => {
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        
        let stakingLogic = await StakingLogic.new(token.address);
        staking = await StakingProxy.new(token.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);
    
        await token.transfer(account1, 1000);
        await token.approve(staking.address, TOTAL_SUPPLY);
        kickoffTS = await staking.kickoffTS.call();
        inOneWeek = kickoffTS.add(new BN(DELAY));
    });

    describe('stake', () => {

        it("Amount should be positive", async () => {
            await expectRevert(staking.stake(0, inOneWeek, root, root),
                "amount of tokens to stake needs to be bigger than 0");
        });

        it("Use 'increaseStake' to increase an existing staked position", async () => {
            await staking.stake(100, inOneWeek, root, root);

            await expectRevert(staking.stake(100, inOneWeek, root, root),
                "Staking:stake: use 'increaseStake' to increase an existing staked position");
        });

        it("Amount should be approved", async () => {
            await expectRevert(staking.stake(100, inOneWeek, root, root, {from: account1}),
                "invalid transfer");
        });

        it("Staking period too short", async () => {
            await expectRevert(staking.stake(100, await getTimeFromKickoff(DAY), root, root),
                "Staking::timestampToLockDate: staking period too short");
        });

        it("Shouldn't be able to stake longer than max duration", async () => {
            let amount = "100";
            let lockedTS = await getTimeFromKickoff(MAX_DURATION);
            let tx = await staking.stake(amount, lockedTS, account1, account1);
            
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
            let lockedTS = await getTimeFromKickoff(MAX_DURATION);
            let tx = await staking.stake(amount, lockedTS, ZERO_ADDRESS, ZERO_ADDRESS);

            
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
            let lockedTS = await getTimeFromKickoff(duration);
            
            let stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(0);
            let beforeBalance = await token.balanceOf.call(root);

            let tx = await staking.stake(amount, lockedTS, root, root);

            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toString()).to.be.equal(amount);
            let afterBalance = await token.balanceOf.call(root);
            expect(beforeBalance.sub(afterBalance).toString()).to.be.equal(amount);

            

            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
            expect(numUserCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            //_increaseDailyStake
            let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
            expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
            checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            //_delegate
            let delegator = await staking.delegates.call(root, lockedTS);
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
            let lockedTS = await getTimeFromKickoff(duration);
            
            let tx = await staking.stake(amount, lockedTS, account1, account1);

            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(account1, lockedTS);
            expect(numUserCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await staking.userStakingCheckpoints.call(account1, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            //_increaseDailyStake
            let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
            expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(1);
            checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

            //_delegate
            let delegator = await staking.delegates.call(account1, lockedTS);
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
    
        it("Should be able to stake after withdrawing whole amount", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);
            
            await setTime(lockedTS);
    
            let stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toString()).to.be.equal(amount);
    
            await staking.withdraw(amount, lockedTS, root);
    
            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(0);
            
            //stake second time
            lockedTS = await getTimeFromKickoff(duration * 2);
            let tx = await staking.stake(amount * 2, lockedTS, root, root);
    
            
            
            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(amount * 2);
    
            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
            expect(numUserCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount * 2);
    
        });
    
        it("Should be able to stake after withdrawing amount partially", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            
            await staking.stake(amount, lockedTS, root, root);
        
            
            await setTime(lockedTS);
        
            let stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toString()).to.be.equal(amount);
            let beforeBalance = await token.balanceOf.call(root);
        
            await staking.withdraw(amount / 2, lockedTS, root);
        
            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(amount / 2);
            let afterBalance = await token.balanceOf.call(root);
            expect(afterBalance.sub(beforeBalance).toNumber()).to.be.equal(amount / 2);
        
            //increase stake
            let tx = await staking.increaseStake(amount * 2.5, root, lockedTS);
    
            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(amount * 3);
    
            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
            expect(numUserCheckpoints.toNumber()).to.be.equal(3);
            let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 2);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount * 3);
    
        });
    
    });

    describe('extendStakingDuration', () => {

        it("Cannot reduce the staking duration", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);

            let newTime = await getTimeFromKickoff(TWO_WEEKS);
            await expectRevert(staking.extendStakingDuration(lockedTS, newTime),
                "Staking::extendStakingDuration: cannot reduce the staking duration");
        });

        it("Do not exceed the max duration", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);

            let newTime = await getTimeFromKickoff(MAX_DURATION.mul(new BN(2)));
            let tx = await staking.extendStakingDuration(lockedTS, newTime);

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
            let lockedTS = await getTimeFromKickoff(TWO_WEEKS);
            let tx1 = await staking.stake(amount, lockedTS, root, root);

            let stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toString()).to.be.equal(amount);
            let beforeBalance = await token.balanceOf.call(root);
            
            expect(tx1.logs[2].args.lockedUntil.toNumber()).to.be.equal(lockedTS.toNumber());

            let newLockedTS = await getTimeFromKickoff(TWO_WEEKS * 2);
            let tx2 = await staking.extendStakingDuration(lockedTS, newLockedTS);

            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toString()).to.be.equal(amount);
            let afterBalance = await token.balanceOf.call(root);
            expect(beforeBalance.sub(afterBalance).toNumber()).to.be.equal(0);

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
            let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
            expect(numUserCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            checkpoint = await staking.userStakingCheckpoints.call(root,newLockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);

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
            let lockTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockTS, root, root);

            await expectRevert(staking.increaseStake("0", root, lockTS),
                "Staking::increaseStake: amount of tokens to stake needs to be bigger than 0");
        });

        it("Amount of tokens to stake needs to be bigger than 0", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockTS, root, root);

            await token.approve(staking.address, 0);
            await expectRevert(staking.increaseStake(amount, root, lockTS),
                "invalid transfer");
        });

        it("Shouldn't be able to overflow balance", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockTS, root, root);

            let maxValue = new BN(2).pow(new BN(96)).sub(new BN(1));
            await expectRevert(staking.increaseStake(maxValue.sub(new BN(100)), root, lockTS),
                "Staking::increaseStake: balance overflow");
        });

        it("Should be able to increase stake", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            let tx1 = await staking.stake(amount, lockedTS, root, root);

            let stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toString()).to.be.equal(amount);
            let beforeBalance = await token.balanceOf.call(root);

            let tx2 = await staking.increaseStake(amount * 2, root, lockedTS);

            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(amount * 3);
            let afterBalance = await token.balanceOf.call(root);
            expect(beforeBalance.sub(afterBalance).toNumber()).to.be.equal(amount * 2);


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
            let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
            expect(numUserCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 1);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount * 3);

            expectEvent(tx2, 'TokensStaked', {
                staker: root,
                amount: new BN(amount * 2),
                lockedUntil: lockedTS,
                totalStaked: new BN(amount * 3)
            });
        });

    });

    describe('withdraw', () => {

        it("Amount of tokens to be withdrawn needs to be bigger than 0", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);

            await expectRevert(staking.withdraw("0", lockedTS, root),
                "Staking::withdraw: amount of tokens to be withdrawn needs to be bigger than 0");
        });

        it("Shouldn't be able to withdraw when tokens are still locked", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);

            await expectRevert(staking.withdraw(amount, lockedTS, root),
                "Staking::withdraw: tokens are still locked.");
        });

        it("Shouldn't be able to withdraw amount greater than balance", async () => {
            let amount = 1000;
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);

            await setTime(lockedTS);
            await expectRevert(staking.withdraw(amount * 2, lockedTS, root),
                "Staking::withdraw: not enough balance");
        });

        it("Should be able to withdraw", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            let tx1 = await staking.stake(amount, lockedTS, root, root);

            await setTime(lockedTS);

            let stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toString()).to.be.equal(amount);
            let beforeBalance = await token.balanceOf.call(root);

            let tx2 = await staking.withdraw(amount / 2, lockedTS, root);

            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(amount / 2);
            let afterBalance = await token.balanceOf.call(root);
            expect(afterBalance.sub(beforeBalance).toNumber()).to.be.equal(amount / 2);

            //_increaseDailyStake
            let numTotalStakingCheckpoints = await staking.numTotalStakingCheckpoints.call(lockedTS);
            expect(numTotalStakingCheckpoints.toNumber()).to.be.equal(2);
            let checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            checkpoint = await staking.totalStakingCheckpoints.call(lockedTS, 1);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);

            //_writeUserCheckpoint
            let numUserCheckpoints = await staking.numUserStakingCheckpoints.call(root, lockedTS);
            expect(numUserCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx1.receipt.blockNumber);
            expect(checkpoint.stake.toString()).to.be.equal(amount);
            checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 1);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx2.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount / 2);

            expectEvent(tx2, 'TokensWithdrawn', {
                staker: root,
                amount: new BN(amount / 2),
            });
        });
    
        it("Should be able to withdraw second time", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);
        
            await setTime(lockedTS);
        
            let stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toString()).to.be.equal(amount);
        
            await staking.withdraw(amount / 2, lockedTS, root);
        
            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(amount / 2);
    
            await staking.withdraw(amount / 2, lockedTS, root);
    
            stackingbBalance = await token.balanceOf.call(staking.address);
            expect(stackingbBalance.toNumber()).to.be.equal(0);
    
        });
    
    });

    describe('unlockAllTokens', () => {

        it("Only owner should be able to unlock all tokens", async () => {
            await expectRevert(staking.unlockAllTokens({from: account1}),
                "unauthorized");
        });

        it("Should be able to unlock all tokens", async () => {
            let amount = "1000";
            let duration = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedTS = await getTimeFromKickoff(duration);
            await staking.stake(amount, lockedTS, root, root);

            let tx = await staking.unlockAllTokens();

            expectEvent(tx, 'TokensUnlocked', {
                amount: amount,
            });

            await staking.withdraw(amount, lockedTS, root);
        });

    });

    describe('timestampToLockDate', () => {
        before(async () => {
            [root, account1, account2, account3, ...accounts] = accounts;

            token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

            let stakingLogic = await StakingLogic.new(token.address);
            staking = await StakingProxy.new(token.address);
            await staking.setImplementation(stakingLogic.address);
            staking = await StakingLogic.at(staking.address);
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
    
    describe("upgrade:", async () => {
        
        it("Should be able to read correct data after an upgrade", async () => {
            let amount = 100;
            let lockedTS = await getTimeFromKickoff(MAX_DURATION);
            let tx = await staking.stake(amount, lockedTS, root, root);
    
            
            //before upgrade
            let balance = await staking.balanceOf.call(root);
            expect(balance.toNumber()).to.be.equal(amount);
            let checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount);

            //upgrade
            staking = await StakingProxy.at(staking.address);
            let stakingMockup = await StakingMockup.new(token.address);
            await staking.setImplementation(stakingMockup.address);
            staking = await StakingMockup.at(staking.address);
    
            //after upgrade: storage data remained the same
            balance = await staking.balanceOf.call(root);
            expect(balance.toNumber()).to.be.equal(amount);
            checkpoint = await staking.userStakingCheckpoints.call(root, lockedTS, 0);
            expect(checkpoint.fromBlock.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.stake.toNumber()).to.be.equal(amount);
            
            //after upgrade: new method added
            balance = await staking.balanceOf_MultipliedByTwo.call(root);
            expect(balance.toNumber()).to.be.equal(amount * 2);
        });
        
    });
    
    async function getTimeFromKickoff(delay) {
        let kickoffTS = await staking.kickoffTS.call();
        return kickoffTS.add(new BN(delay));
    }

});
