/** Speed optimized on branch hardhatTestRefactor, 2021-10-04
 * Bottleneck found at beforeEach hook, redeploying token and staking ... on every test.
 *
 * Total time elapsed: 6.6s
 * After optimization: 5.6s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");

const {
    address,
    mineBlock,
    setNextBlockTimestamp,
    impersonateAccount,
    stopImpersonatingAccount,
    setBalance,
} = require("../Utils/Ethereum");
const {
    deployAndGetIStaking,
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getPriceFeeds,
    getSovryn,
} = require("../Utils/initializer.js");

const EIP712 = require("../Utils/EIP712");
// const EIP712Ethers = require("../Utils/EIP712Ethers");
const { getAccountsPrivateKeysBuffer } = require("../Utils/hardhat_utils");

const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");
const Vesting = artifacts.require("Vesting");
const VestingLogic = artifacts.require("VestingLogic");
const StakingTester = artifacts.require("StakingTester");
//Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const StakingAdminModule = artifacts.require("StakingAdminModule");
const StakingVestingModule = artifacts.require("StakingVestingModule");
const StakingWithdrawModule = artifacts.require("StakingWithdrawModule");
const StakingStakeModule = artifacts.require("StakingStakeModule");

const StakingWrapperMockup = artifacts.require("StakingWrapperMockup");

const FeeSharingCollector = artifacts.require("FeeSharingCollector");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const TOTAL_SUPPLY = "10000000000000000000000000";
const DELAY = 86400 * 14;
const ONE_DAY = 86400;
const TWO_WEEKS = ONE_DAY * 14;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE_DAY_BN = new BN(ONE_DAY);
const TWO_WEEKS_BN = new BN(TWO_WEEKS);

contract("Staking", (accounts) => {
    const name = "Test token";
    const symbol = "TST";

    let root, a1, a2, a3, chainId;
    let pA1;
    let token, staking, sovryn;
    let stakingWrapperMockup;
    let MAX_VOTING_WEIGHT;
    let MAX_DURATION;
    let WEIGHT_FACTOR;

    let kickoffTS, inThreeYears;
    let currentChainId;

    let vestingLogic1, vestingLogic2;
    let vesting;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
        await web3.eth.net.getId();
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        /// Staking Modules
        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(token.address);
        staking = await deployAndGetIStaking(stakingProxy.address);
        stakingWrapperMockup = await StakingWrapperMockup.new(stakingProxy.address, token.address);

        //Upgradable Vesting Registry
        const vestingRegistryLogic = await VestingRegistryLogic.new();
        vesting = await VestingRegistryProxy.new();
        await vesting.setImplementation(vestingRegistryLogic.address);
        vesting = await VestingRegistryLogic.at(vesting.address);

        //FeeSharingCollectorProxy
        let feeSharingCollector = await FeeSharingCollector.new();
        feeSharingCollectorProxyObj = await FeeSharingCollectorProxy.new(
            sovryn.address,
            staking.address
        );
        await feeSharingCollectorProxyObj.setImplementation(feeSharingCollector.address);
        feeSharingCollectorProxy = await FeeSharingCollector.at(
            feeSharingCollectorProxyObj.address
        );
        await staking.setFeeSharing(feeSharingCollectorProxy.address);

        await staking.setVestingRegistry(vesting.address);

        MAX_VOTING_WEIGHT = await staking.getStorageMaxVotingWeight.call();
        MAX_DURATION = await staking.getStorageMaxDurationToStakeTokens();
        WEIGHT_FACTOR = await staking.getStorageWeightFactor();

        kickoffTS = await staking.kickoffTS.call();
        inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));
    }

    before(async () => {
        [root, a1, a2, a3, ...accounts] = accounts;
        [pkbRoot, pkbA1] = getAccountsPrivateKeysBuffer();
        currentChainId = (await ethers.provider.getNetwork()).chainId;

        vestingLogic1 = await VestingLogic.new();
        vestingLogic2 = await VestingLogic.new();
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    // describe("metadata", () => {
    // 	it("has given name", async () => {
    // 		expect(await token.name.call()).to.be.equal(name);
    // 	});
    //
    // 	it("has given symbol", async () => {
    // 		expect(await token.symbol.call()).to.be.equal(symbol);
    // 	});
    // });
    //
    // describe("balanceOf", () => {
    // 	it("grants to initial account", async () => {
    // 		expect((await token.balanceOf.call(root)).toString()).to.be.equal(TOTAL_SUPPLY);
    // 	});
    // });
    //
    // describe("delegateBySig", () => {
    // 	const Domain = (staking) => ({ name: "SOVStaking", chainId: currentChainId, verifyingContract: staking.address });
    // 	const Types = {
    // 		Delegation: [
    // 			{ name: "delegatee", type: "address" },
    // 			{ name: "lockDate", type: "uint256" },
    // 			{ name: "nonce", type: "uint256" },
    // 			{ name: "expiry", type: "uint256" },
    // 		],
    // 	};
    //
    // 	it("reverts if the signatory is invalid", async () => {
    // 		const delegatee = root,
    // 			nonce = 0,
    // 			expiry = 0;
    // 		await expectRevert(
    // 			staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, 0, "0xbad", "0xbad"),
    // 			"Staking::delegateBySig: invalid signature"
    // 		);
    // 	});
    //
    // 	it("reverts if the nonce is bad ", async () => {
    // 		const delegatee = root,
    // 			nonce = 1,
    // 			expiry = 0,
    // 			lockDate = inThreeYears;
    // 		const { v, r, s } = EIP712.sign(
    // 			Domain(staking),
    // 			"Delegation",
    // 			{
    // 				delegatee,
    // 				lockDate,
    // 				nonce,
    // 				expiry,
    // 			},
    // 			Types,
    // 			pkbA1
    // 			//pA1.privateKey
    // 			//unlockedAccount(a1).secretKey
    // 		);
    // 		/*const { v, r, s } = EIP712Ethers.sign(
    // 			Domain(staking),
    // 			"Delegation",
    // 			{
    // 				delegatee,
    // 				lockDate,
    // 				nonce,
    // 				expiry,
    // 			},
    // 			Types,
    // 			pA1
    // 		);*/
    //
    // 		await expectRevert(
    // 			staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s),
    // 			"Staking::delegateBySig: invalid nonce"
    // 		);
    // 	});
    //
    // 	it("reverts if the signature has expired", async () => {
    // 		const delegatee = root,
    // 			nonce = 0,
    // 			expiry = 0,
    // 			lockDate = inThreeYears;
    // 		const { v, r, s } = EIP712.sign(
    // 			Domain(staking),
    // 			"Delegation",
    // 			{
    // 				delegatee,
    // 				lockDate,
    // 				nonce,
    // 				expiry,
    // 			},
    // 			Types,
    // 			pkbA1
    // 		);
    // 		await expectRevert(
    // 			staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s),
    // 			"Staking::delegateBySig: signature expired"
    // 		);
    // 	});
    //
    // 	it("delegates on behalf of the signatory", async () => {
    // 		const delegatee = root,
    // 			nonce = 0,
    // 			expiry = 10e9,
    // 			lockDate = inThreeYears;
    // 		const { v, r, s } = EIP712.sign(
    // 			Domain(staking),
    // 			"Delegation",
    // 			{
    // 				delegatee,
    // 				lockDate,
    // 				nonce,
    // 				expiry,
    // 			},
    // 			Types,
    // 			pkbA1
    // 			//unlockedAccount(a1).secretKey
    // 		);
    //
    // 		expect(await staking.delegates.call(a1, inThreeYears)).to.be.equal(address(0));
    // 		const tx = await staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s);
    // 		expect(tx.gasUsed < 80000);
    // 		expect(await staking.delegates.call(a1, inThreeYears)).to.be.equal(root);
    // 	});
    // });

    describe("stake", () => {
        it("should fail if amount is zero", async () => {
            await expectRevert(
                staking.stake(0, 0, ZERO_ADDRESS, ZERO_ADDRESS),
                "amount needs to be bigger than 0"
            );
        });

        it("should fail if until < block.timestamp", async () => {
            await expectRevert(
                staking.stake(new BN(1000), kickoffTS.add(new BN(1)), ZERO_ADDRESS, ZERO_ADDRESS),
                "Staking::_timestampToLockDate: staking period too short"
            );
        });

        // if delegatee != stakeFor (or 0), stakeFor must be the msg.sender, otherwise the function reverts
        it("should fail if not a message sender trying to delegate votes", async () => {
            let user = accounts[0];
            let delegatee1 = accounts[1];
            let delegatee2 = accounts[2];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            await expectRevert(
                staking.stake(amount, lockedDate, delegatee1, delegatee2, { from: user }),
                "Only stakeFor account is allowed to change delegatee"
            );
        });

        //the function reverts if the stake of stakeFor at until was modified on the same block
        it("should fail if second stake in the same block", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount.mul(new BN(2)));
            await token.approve(stakingWrapperMockup.address, amount.mul(new BN(2)), {
                from: user,
            });

            await expectRevert(
                stakingWrapperMockup.stake2times(amount, lockedDate, user, user, { from: user }),
                "cannot be mined in the same block as last stake"
            );
        });

        //the function reverts if the contract is paused or frozen
        it("should fail if paused", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.stake(0, 0, ZERO_ADDRESS, ZERO_ADDRESS), "paused");
        });

        //the function reverts if the contract is paused or frozen
        it("should fail if frozen", async () => {
            await staking.pauseUnpause(true);
            await expectRevert(staking.stake(0, 0, ZERO_ADDRESS, ZERO_ADDRESS), "paused");
        });

        // if until is not a valid lock date, the lock date prior to until is used
        // the SOV tokens are transferred from the msg.sender to the staking contract
        it("should adjust lock date", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let invalidLockDate = lockedDate.add(new BN(3600));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            let userBalanceBefore = await token.balanceOf(user);
            let stakingBalanceBefore = await token.balanceOf(staking.address);
            let tx = await staking.stake(amount, invalidLockDate, ZERO_ADDRESS, ZERO_ADDRESS, {
                from: user,
            });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            let userBalanceAfter = await token.balanceOf(user);
            let stakingBalanceAfter = await token.balanceOf(staking.address);

            expect(userBalanceBefore.sub(userBalanceAfter)).to.be.equal(amount);
            expect(stakingBalanceAfter.sub(stakingBalanceBefore)).to.be.equal(amount);

            //check getPriorUserStakeByDate
            let priorUserStakeBefore = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockBefore
            );
            let priorUserStakeAfter = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockAfter
            );
            expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "TokensStaked",
                {
                    staker: user,
                    amount: amount,
                    lockedUntil: lockedDate,
                    totalStaked: amount,
                }
            );
        });

        // if until exceeds the maximum duration, the latest valid lock date is used
        it("should use maximum duration if 'until' exceeds it", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(MAX_DURATION);
            let invalidLockDate = lockedDate.add(new BN(86400));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            let tx = await staking.stake(amount, invalidLockDate, ZERO_ADDRESS, ZERO_ADDRESS, {
                from: user,
            });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorUserStakeByDate
            let priorUserStakeBefore = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockBefore
            );
            let priorUserStakeAfter = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockAfter
            );
            expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "TokensStaked",
                {
                    staker: user,
                    amount: amount,
                    lockedUntil: lockedDate,
                    totalStaked: amount,
                }
            );
        });

        // if stakeFor is the 0 address, the tokens are staked for the msg.sender
        // if delegatee is the 0 address, the voting power is delegated to stakeFor
        it("should change stakeFor and delegatee if zero addresses", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            let tx = await staking.stake(amount, lockedDate, ZERO_ADDRESS, ZERO_ADDRESS, {
                from: user,
            });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorUserStakeByDate
            let priorUserStakeBefore = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockBefore
            );
            let priorUserStakeAfter = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockAfter
            );
            expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "TokensStaked",
                {
                    staker: user,
                    amount: amount,
                    lockedUntil: lockedDate,
                    totalStaked: amount,
                }
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "DelegateChanged",
                {
                    delegator: user,
                    lockedUntil: lockedDate,
                    fromDelegate: ZERO_ADDRESS,
                    toDelegate: user,
                }
            );
        });

        // after function execution getPriorTotalStakesForDate returns the updated total stake for until (prior stake + amount)
        // after function execution the correct stake is returned for stakeFor and until by getPriorUserStakeByDate (increased by amount)
        // after function execution the correct delegated stake is returned for delegatee and until by getPriorStakeByDateForDelegatee (increased by amount)
        // after function execution, the delegate at until may not be the 0 address
        it("should stake tokens for user without delegation", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            let tx = await staking.stake(amount, lockedDate, user, user, { from: user });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check delegatee
            let userDelegatee = await staking.delegates(user, lockedDate);
            expect(userDelegatee).to.be.equal(user);

            //check getPriorTotalStakesForDate
            let priorTotalStakeBefore = await staking.getPriorTotalStakesForDate(
                lockedDate,
                blockBefore
            );
            let priorTotalStakeAfter = await staking.getPriorTotalStakesForDate(
                lockedDate,
                blockAfter
            );
            expect(priorTotalStakeAfter.sub(priorTotalStakeBefore)).to.be.equal(amount);

            //check getPriorUserStakeByDate
            let priorUserStakeBefore = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockBefore
            );
            let priorUserStakeAfter = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockAfter
            );
            expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(amount);

            //check getPriorStakeByDateForDelegatee
            let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(
                user,
                lockedDate,
                blockBefore
            );
            let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(
                user,
                lockedDate,
                blockAfter
            );
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "TokensStaked",
                {
                    staker: user,
                    amount: amount,
                    lockedUntil: lockedDate,
                    totalStaked: amount,
                }
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "DelegateChanged",
                {
                    delegator: user,
                    lockedUntil: lockedDate,
                    fromDelegate: ZERO_ADDRESS,
                    toDelegate: user,
                }
            );
        });

        it("should stake tokens for user with delegation", async () => {
            let user = accounts[0];
            let delegatee = accounts[1];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            let tx = await staking.stake(amount, lockedDate, user, delegatee, { from: user });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check delegatee
            let userDelegatee = await staking.delegates(user, lockedDate);
            expect(userDelegatee).to.be.equal(delegatee);

            //check getPriorTotalStakesForDate
            let priorTotalStakeBefore = await staking.getPriorTotalStakesForDate(
                lockedDate,
                blockBefore
            );
            let priorTotalStakeAfter = await staking.getPriorTotalStakesForDate(
                lockedDate,
                blockAfter
            );
            expect(priorTotalStakeAfter.sub(priorTotalStakeBefore)).to.be.equal(amount);

            //check getPriorUserStakeByDate
            let priorUserStakeBefore = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockBefore
            );
            let priorUserStakeAfter = await staking.getPriorUserStakeByDate(
                user,
                lockedDate,
                blockAfter
            );
            expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(amount);

            //check getPriorStakeByDateForDelegatee
            let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(
                delegatee,
                lockedDate,
                blockBefore
            );
            let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(
                delegatee,
                lockedDate,
                blockAfter
            );
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "TokensStaked",
                {
                    staker: user,
                    amount: amount,
                    lockedUntil: lockedDate,
                    totalStaked: amount,
                }
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "DelegateChanged",
                {
                    delegator: user,
                    lockedUntil: lockedDate,
                    fromDelegate: ZERO_ADDRESS,
                    toDelegate: delegatee,
                }
            );
        });

        // if delegatee differs from the previous delegate of stakeFor, getPriorStakeByDateForDelegatee returns the reduced stake ( by the total stake of stakeFor  at until, not just amount) for the previous delegate and until
        it("should change delegatee", async () => {
            let user = accounts[0];
            let delegatee1 = accounts[1];
            let delegatee2 = accounts[2];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount1 = new BN(1000);
            let amount2 = new BN(2000);
            let totalAmount = amount1.add(amount2);
            await token.transfer(user, totalAmount);
            await token.approve(staking.address, totalAmount, { from: user });

            await staking.stake(amount1, lockedDate, user, delegatee1, { from: user });
            let tx = await staking.stake(amount2, lockedDate, user, delegatee2, { from: user });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorStakeByDateForDelegatee - delegatee1
            let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(
                delegatee1,
                lockedDate,
                blockBefore
            );
            let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(
                delegatee1,
                lockedDate,
                blockAfter
            );
            expect(priorDelegateStakeBefore.sub(priorDelegateStakeAfter)).to.be.equal(amount1);

            //check getPriorStakeByDateForDelegatee - delegatee2
            priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(
                delegatee2,
                lockedDate,
                blockBefore
            );
            priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(
                delegatee2,
                lockedDate,
                blockAfter
            );
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(
                amount1.add(amount2)
            );
        });

        it("should update delegate stake after withdraw", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount1 = new BN(1000);
            let amount2 = new BN(2000);
            let totalAmount = amount1.add(amount2);
            await token.transfer(user, totalAmount);
            await token.approve(staking.address, totalAmount, { from: user });

            await staking.stake(amount1, lockedDate, user, user, { from: user });
            await staking.withdraw(amount1, lockedDate, user, { from: user });

            let tx = await staking.stake(amount2, lockedDate, user, user, { from: user });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorStakeByDateForDelegatee - delegatee1
            let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(
                user,
                lockedDate,
                blockBefore
            );
            let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(
                user,
                lockedDate,
                blockAfter
            );
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount2);
        });

        // if stakeFor is a vesting contract, getPriorVestingStakeByDate returns the increased vesting stake for stakeFor and until
        it("should update stake for vesting contracts", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            await staking.addContractCodeHash(user);
            let tx = await staking.stake(amount, lockedDate, user, user, { from: user });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorVestingStakeByDate
            let priorDelegateStakeBefore = await staking.getPriorVestingStakeByDate(
                lockedDate,
                blockBefore
            );
            let priorDelegateStakeAfter = await staking.getPriorVestingStakeByDate(
                lockedDate,
                blockAfter
            );
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount);
        });
    });

    describe("extendStakingDuration", () => {
        //the function reverts if the stake of stakeFor at until was modified on the same block
        it("should fail if extending stake in the same block when staked", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(stakingWrapperMockup.address, amount, {
                from: user,
            });

            await expectRevert(
                stakingWrapperMockup.stakeAndExtend(amount, lockedDate, { from: user }),
                "cannot be mined in the same block as last stake"
            );
        });

        //the function reverts if the contract is paused or frozen
        it("should fail if paused", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.extendStakingDuration(0, 0), "paused");
        });

        //the function reverts if the contract is paused or frozen
        it("should fail if frozen", async () => {
            await staking.pauseUnpause(true);
            await expectRevert(staking.extendStakingDuration(0, 0), "paused");
        });

        it("should fail if previous lock date is 0", async () => {
            let lockedDate = 0;
            let lockedDateNew = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4)));
            await expectRevert(
                staking.extendStakingDuration(lockedDate, lockedDateNew),
                "timestamp < contract creation"
            );
        });

        it("should fail if until is 0", async () => {
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = 0;
            await expectRevert(
                staking.extendStakingDuration(lockedDate, lockedDateNew),
                "timestamp < contract creation"
            );
        });

        //the function reverts if the stake of msg.sender at until is 0
        it("should fail if previous lock date has no stake", async () => {
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4)));
            await expectRevert(
                staking.extendStakingDuration(lockedDate, lockedDateNew),
                "no stakes till the prev lock date"
            );
        });

        //the function reverts if adjusted until < adjusted previousLock
        it("should fail if adjusted until < adjusted previousLock", async () => {
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = lockedDate.sub(new BN(3600));
            lockedDate = lockedDate.sub(new BN(7200));
            await expectRevert(
                staking.extendStakingDuration(lockedDate, lockedDateNew),
                "must increase staking duration"
            );
        });

        //after function execution getPriorUserStakeByDate returns 0 for msg.sender and previousLock
        //after function execution getPriorUserStakeByDate returns the increased stake for msg.sender and until
        //      (prior stake at until + prior stake at previousLock)
        //after function execution getPriorTotalStakesForDate returns the updated total stake for previousLock and until
        //after function execution, the delegate at until may not be the 0 address
        it("should extend staking duration", async () => {
            let user = accounts[0];
            let lockedDateOld = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4)));
            let amount = new BN(5000);
            let amountOld = new BN(3000);
            let totalAmount = amountOld.add(amount);
            await token.transfer(user, totalAmount);
            await token.approve(staking.address, totalAmount, { from: user });

            await staking.stake(amountOld, lockedDateNew, user, user, { from: user });
            await staking.stake(amount, lockedDateOld, user, user, { from: user });

            let tx = await staking.extendStakingDuration(lockedDateOld, lockedDateNew, {
                from: user,
            });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorUserStakeByDate
            let priorUserStakeOld = await staking.getPriorUserStakeByDate(
                user,
                lockedDateOld,
                blockAfter
            );
            expect(priorUserStakeOld).to.be.equal(new BN(0));

            let priorUserStakeNew = await staking.getPriorUserStakeByDate(
                user,
                lockedDateNew,
                blockAfter
            );
            expect(priorUserStakeNew).to.be.equal(totalAmount);

            //check delegatee
            let userDelegateeOld = await staking.delegates(user, lockedDateOld);
            expect(userDelegateeOld).to.be.equal(ZERO_ADDRESS);

            let userDelegateeNew = await staking.delegates(user, lockedDateNew);
            expect(userDelegateeNew).to.be.equal(user);

            //check getPriorTotalStakesForDate
            let priorTotalStakeOldBefore = await staking.getPriorTotalStakesForDate(
                lockedDateOld,
                blockBefore
            );
            let priorTotalStakeOldAfter = await staking.getPriorTotalStakesForDate(
                lockedDateOld,
                blockAfter
            );
            expect(priorTotalStakeOldBefore.sub(priorTotalStakeOldAfter)).to.be.equal(amount);

            let priorTotalStakeNewBefore = await staking.getPriorTotalStakesForDate(
                lockedDateNew,
                blockBefore
            );
            let priorTotalStakeNewAfter = await staking.getPriorTotalStakesForDate(
                lockedDateNew,
                blockAfter
            );
            expect(priorTotalStakeNewAfter.sub(priorTotalStakeNewBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "ExtendedStakingDuration",
                {
                    staker: user,
                    previousDate: lockedDateOld,
                    newDate: lockedDateNew,
                    amountStaked: amount,
                }
            );
        });

        //if until > now + max duration, the stake is extended until the max duration (except previousLock is already max duration)
        it("should extend staking to max duration", async () => {
            let user = accounts[0];
            let lockedDateOld = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = kickoffTS.add(MAX_DURATION.mul(new BN(3)));
            let lockDateMaxDuration = kickoffTS.add(MAX_DURATION);
            let amount = new BN(5000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            await staking.stake(amount, lockedDateOld, user, user, { from: user });

            let tx = await staking.extendStakingDuration(lockedDateOld, lockedDateNew, {
                from: user,
            });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorTotalStakesForDate
            let priorTotalStakeBefore = await staking.getPriorTotalStakesForDate(
                lockDateMaxDuration,
                blockBefore
            );
            let priorTotalStakeAfter = await staking.getPriorTotalStakesForDate(
                lockDateMaxDuration,
                blockAfter
            );
            expect(priorTotalStakeAfter.sub(priorTotalStakeBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "ExtendedStakingDuration",
                {
                    staker: user,
                    previousDate: lockedDateOld,
                    newDate: lockDateMaxDuration,
                    amountStaked: amount,
                }
            );
        });

        //if msg.sender is a vesting contract, getPriorVestingStakeByDate returns the updated vesting stake for previousLock and until
        it("should extend staking duration for vesting contract", async () => {
            let user = accounts[0];
            let lockedDateOld = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4)));
            let amount = new BN(5000);
            let amountOld = new BN(3000);
            let totalAmount = amountOld.add(amount);
            await token.transfer(user, totalAmount);
            await token.approve(staking.address, totalAmount, { from: user });

            await staking.addContractCodeHash(user);
            await staking.stake(amountOld, lockedDateNew, user, user, { from: user });
            await staking.stake(amount, lockedDateOld, user, user, { from: user });

            let tx = await staking.extendStakingDuration(lockedDateOld, lockedDateNew, {
                from: user,
            });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorVestingStakeByDate
            let priorVestingStakeOldBefore = await staking.getPriorVestingStakeByDate(
                lockedDateOld,
                blockBefore
            );
            let priorVestingStakeOldAfter = await staking.getPriorVestingStakeByDate(
                lockedDateOld,
                blockAfter
            );
            expect(priorVestingStakeOldBefore.sub(priorVestingStakeOldAfter)).to.be.equal(amount);

            let priorVestingStakeNewBefore = await staking.getPriorVestingStakeByDate(
                lockedDateNew,
                blockBefore
            );
            let priorVestingStakeNewAfter = await staking.getPriorVestingStakeByDate(
                lockedDateNew,
                blockAfter
            );
            expect(priorVestingStakeNewAfter.sub(priorVestingStakeNewBefore)).to.be.equal(amount);
        });

        //if msg.sender had a delegate for previousLock and no delegate for until, the new stake is delegated to the delegate
        //      at previousLock. therefore getPriorStakeByDateForDelegatee returns the reduced stake for that delegate and
        //      previousLock but increased for until
        it("should extend staking duration using old delegate", async () => {
            let user = accounts[0];
            let delegateOld = accounts[1];
            let lockedDateOld = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4)));
            let amount = new BN(5000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            await staking.stake(amount, lockedDateOld, user, delegateOld, { from: user });

            let tx = await staking.extendStakingDuration(lockedDateOld, lockedDateNew, {
                from: user,
            });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorStakeByDateForDelegatee
            let priorDelegateStakeOldBefore = await staking.getPriorStakeByDateForDelegatee(
                delegateOld,
                lockedDateOld,
                blockBefore
            );
            let priorDelegateStakeOldAfter = await staking.getPriorStakeByDateForDelegatee(
                delegateOld,
                lockedDateOld,
                blockAfter
            );
            let priorDelegateStakeNewBefore = await staking.getPriorStakeByDateForDelegatee(
                delegateOld,
                lockedDateNew,
                blockBefore
            );
            let priorDelegateStakeNewAfter = await staking.getPriorStakeByDateForDelegatee(
                delegateOld,
                lockedDateNew,
                blockAfter
            );
            expect(priorDelegateStakeOldBefore).to.be.equal(amount);
            expect(priorDelegateStakeOldAfter).to.be.equal(0);
            expect(priorDelegateStakeNewBefore).to.be.equal(0);
            expect(priorDelegateStakeNewAfter).to.be.equal(amount);
        });

        //if msg.sender had a delegate for previousLock and a different delegate for until,
        //      the delegate at until remains the delegate at until. therefore getPriorStakeByDateForDelegatee
        //      returns the reduced stake for the old delegate at previousLock and an increased stake for the existing delegate at until
        it("should extend staking duration using delegate for new lock", async () => {
            let user = accounts[0];
            let delegateOld = accounts[1];
            let delegateNew = accounts[2];
            let lockedDateOld = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4)));
            let amountNew = new BN(1000);
            let amountOld = new BN(5000);
            let totalAmount = amountNew.add(amountOld);
            await token.transfer(user, totalAmount);
            await token.approve(staking.address, totalAmount, { from: user });

            await staking.stake(amountOld, lockedDateOld, user, delegateOld, { from: user });
            await staking.stake(amountNew, lockedDateNew, user, delegateNew, { from: user });

            let tx = await staking.extendStakingDuration(lockedDateOld, lockedDateNew, {
                from: user,
            });
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorStakeByDateForDelegatee
            let priorDelegateStakeOldBefore = await staking.getPriorStakeByDateForDelegatee(
                delegateOld,
                lockedDateOld,
                blockBefore
            );
            let priorDelegateStakeOldAfter = await staking.getPriorStakeByDateForDelegatee(
                delegateOld,
                lockedDateOld,
                blockAfter
            );
            expect(priorDelegateStakeOldBefore).to.be.equal(amountOld);
            expect(priorDelegateStakeOldAfter).to.be.equal(new BN(0));

            let priorDelegateStakeNewBefore = await staking.getPriorStakeByDateForDelegatee(
                delegateNew,
                lockedDateNew,
                blockBefore
            );
            let priorDelegateStakeNewAfter = await staking.getPriorStakeByDateForDelegatee(
                delegateNew,
                lockedDateNew,
                blockAfter
            );
            expect(priorDelegateStakeNewBefore).to.be.equal(amountNew);
            expect(priorDelegateStakeNewAfter).to.be.equal(amountNew.add(amountOld));
        });
    });

    describe("setVestingRegistry", () => {
        it("the owner may set the vesting registry if the contract is not frozen", async () => {
            //expect(await staking.frozen()).to.be.false; // sanity check
            const newAddress = address(1337);
            await staking.setVestingRegistry(newAddress);
            expect(await staking.vestingRegistryLogic()).to.be.equal(newAddress);
        });

        it("the owner may not set the vesting registry if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.setVestingRegistry(address(1337)), "paused");
        });

        it("the owner may set the vesting registry if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            const newAddress = address(1337);
            await staking.setVestingRegistry(newAddress);
            expect(await staking.vestingRegistryLogic()).to.be.equal(newAddress);
        });

        it("any other address may not set the vesting registry", async () => {
            await expectRevert(
                staking.setVestingRegistry(address(1337), { from: a1 }),
                "unauthorized"
            );

            await staking.addAdmin(a1);
            // still reverts
            await expectRevert(
                staking.setVestingRegistry(address(1337), { from: a1 }),
                "unauthorized"
            );
        });

        it("it is allowed to set the vesting registry to the 0 address", async () => {
            await staking.setVestingRegistry(address(0));
            expect(await staking.vestingRegistryLogic()).to.be.equal(address(0));
        });

        // "calling vestingRegistryLogic returns _vestingRegistryProxy" is tested implicitly in the above scenarios
    });

    describe("setVestingStakes", () => {
        it("should fail if unauthorized", async () => {
            await expectRevert(staking.setVestingStakes([], [], { from: a1 }), "unauthorized"); // WS01 : unauthorized
        });

        it("should fail if arrays have different length", async () => {
            let lockedDates = [kickoffTS.add(new BN(TWO_WEEKS))];
            let values = [];
            await expectRevert(staking.setVestingStakes(lockedDates, values), "arrays mismatch"); // WS05 : arrays mismatch
        });

        it("should fail if frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.setVestingStakes([], []), "paused"); // WS04 : frozen
        });

        it("should fail if the date is not multiples of 14 days", async () => {
            let lockedDates = [
                kickoffTS.add(new BN(1)),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2))),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4))),
            ];
            let values = [new BN(1000), new BN(30000000000), new BN(500000000000000)];

            await expectRevert(
                staking.setVestingStakes(lockedDates, values),
                "Invalid lock dates: not multiples of 14 days"
            );
        });

        it("should fail if the date less than the kickoff timestamp", async () => {
            let lockedDates = [
                new BN(0),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2))),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4))),
            ];
            let values = [new BN(1000), new BN(30000000000), new BN(500000000000000)];

            await expectRevert(
                staking.setVestingStakes(lockedDates, values),
                "Invalid lock dates: must greater than contract creation timestamp"
            );
        });

        it("should fail if the date duration exceeds the max_duration and lockDate > blockTimestamp", async () => {
            let lockedDates = [kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(100)))];
            let values = [new BN(1000)];

            await expectRevert(
                staking.setVestingStakes(lockedDates, values),
                "Invalid lock dates: exceed max duration"
            );
        });
    });

    describe("stakeBySchedule", () => {
        //the function reverts if the contract is paused or frozen
        it("should fail if paused", async () => {
            await staking.pauseUnpause(true);
            await expectRevert(
                staking.stakeBySchedule(0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS),
                "paused"
            );
        });

        //the function reverts if the contract is paused or frozen
        it("should fail if frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(
                staking.stakeBySchedule(0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS),
                "paused"
            );
        });

        //the function reverts if the amount of staked per interval is 0
        it("should fail if amount is zero", async () => {
            await expectRevert(
                staking.stakeBySchedule(0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS),
                "Invalid amount"
            );
        });

        //the function reverts if intervalLength is 0
        it("should fail if intervalLength is 0", async () => {
            let amount = new BN(1000);
            let cliff = new BN(TWO_WEEKS);
            let intervalLength = 0;
            await expectRevert(
                staking.stakeBySchedule(
                    amount,
                    cliff,
                    intervalLength,
                    0,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS
                ),
                "Invalid interval length"
            );
        });

        //the function reverts if intervalLength is not a multiple of 14 days
        it("should fail if intervalLength is not a multiple of 14 days", async () => {
            let amount = new BN(1000);
            let cliff = new BN(TWO_WEEKS);
            let duration = MAX_DURATION;
            let intervalLength = new BN(TWO_WEEKS).add(new BN(86400));
            await expectRevert(
                staking.stakeBySchedule(
                    amount,
                    cliff,
                    duration,
                    intervalLength,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS
                ),
                "Invalid interval length"
            );
        });

        //the function reverts if duration >= the max duration
        it("should fail if duration >= the max duration", async () => {
            let amount = new BN(1000);
            let cliff = new BN(TWO_WEEKS);
            let duration = MAX_DURATION.mul(new BN(3));
            let intervalLength = new BN(TWO_WEEKS);
            await expectRevert(
                staking.stakeBySchedule(
                    amount,
                    cliff,
                    duration,
                    intervalLength,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS
                ),
                "Invalid duration"
            );
        });

        // if delegatee != stakeFor (or 0), stakeFor must be the msg.sender, otherwise the function reverts
        it("should fail if not a message sender trying to delegate votes", async () => {
            let user = accounts[0];
            let delegatee1 = accounts[1];
            let delegatee2 = accounts[2];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            let cliff = new BN(TWO_WEEKS);
            let duration = MAX_DURATION;
            let intervalLength = new BN(TWO_WEEKS);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            await expectRevert(
                staking.stakeBySchedule(
                    amount,
                    cliff,
                    duration,
                    intervalLength,
                    delegatee1,
                    delegatee2,
                    { from: user }
                ),
                "Only stakeFor account is allowed to change delegatee"
            );
        });

        // the function reverts if stakeFor previously staked for the first staking date in the same block
        it("should fail if second stake in the same block (the first staking date)", async () => {
            let user = accounts[0];
            let cliff = new BN(TWO_WEEKS).mul(new BN(2));
            let duration = new BN(TWO_WEEKS).mul(new BN(4));
            let intervalLength = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedDate = kickoffTS.add(cliff); //the first staking date
            let amount = new BN(1000);
            await token.transfer(user, amount.mul(new BN(2)));
            await token.approve(stakingWrapperMockup.address, amount.mul(new BN(2)), {
                from: user,
            });

            await expectRevert(
                stakingWrapperMockup.stakeAndStakeBySchedule(
                    amount,
                    lockedDate,
                    cliff,
                    duration,
                    intervalLength,
                    user,
                    user,
                    { from: user }
                ),
                "cannot be mined in the same block as last stake"
            );
        });

        //the function reverts if stakeFor previously staked for any other staking date in the same block
        it("should fail if second stake in the same block (other staking date)", async () => {
            let user = accounts[0];
            let cliff = new BN(TWO_WEEKS).mul(new BN(2));
            let duration = new BN(TWO_WEEKS).mul(new BN(20));
            let intervalLength = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedDate = kickoffTS.add(cliff.add(intervalLength.mul(new BN(3)))); //other staking date
            let amount = new BN(1000);
            await token.transfer(user, amount.mul(new BN(2)));
            await token.approve(stakingWrapperMockup.address, amount.mul(new BN(2)), {
                from: user,
            });

            await expectRevert(
                stakingWrapperMockup.stakeAndStakeBySchedule(
                    amount,
                    lockedDate,
                    cliff,
                    duration,
                    intervalLength,
                    user,
                    user,
                    { from: user }
                ),
                "cannot be mined in the same block as last stake"
            );
        });

        it("should fail if start > end", async () => {
            let user = accounts[0];
            let cliff = new BN(TWO_WEEKS * 100); //200 weeks
            let duration = new BN(TWO_WEEKS).mul(new BN(20));
            let intervalLength = new BN(TWO_WEEKS).mul(new BN(2));
            let lockedDate = kickoffTS.add(cliff.add(intervalLength.mul(new BN(3)))); //other staking date
            let amount = new BN(1000);
            await token.transfer(user, amount.mul(new BN(2)));
            await token.approve(staking.address, amount.mul(new BN(2)), {
                from: user,
            });

            await expectRevert(
                staking.stakeBySchedule(amount, cliff, duration, intervalLength, user, user, {
                    from: user,
                }),
                "Invalid schedule"
            );
        });

        //the amount staked per interval is determined by amount / number of intervals
        //the number of intervals to stake for is determined as (a - b) / c, where b is the time between the lock date prior to
        //      or equal to block.timestamp + cliff, a is b + duration and c is intervalLength
        //after function execution, the delegate may nor be the 0 address for any lock date with a positive stake
        //after function execution the correct stake per lock date is returned for stakeFor by getPriorUserStakeByDate
        //after function execution the correct delegated stake is returned for delegatee by getPriorStakeByDateForDelegatee
        //after function execution getPriorTotalStakesForDate returns the updated total stake for each date
        //      (prior stake +  amount staked per interval)
        it("should stake tokens for user using a schedule", async () => {
            let user = accounts[0];
            let delegatee = accounts[1];
            let intervalAmount = new BN(1000);
            let intervalCount = new BN(7);
            let amount = intervalAmount.mul(intervalCount);
            let cliff = new BN(TWO_WEEKS);
            let intervalLength = new BN(TWO_WEEKS);
            let duration = intervalLength.mul(intervalCount);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            let tx = await staking.stakeBySchedule(
                amount,
                cliff,
                duration,
                intervalLength,
                user,
                delegatee,
                { from: user }
            );

            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            let startDate = kickoffTS.add(cliff);
            let endDate = kickoffTS.add(duration);
            for (
                let lockedDate = startDate;
                lockedDate <= endDate;
                lockedDate = lockedDate.add(intervalLength)
            ) {
                //check delegatee
                let userDelegatee = await staking.delegates(user, lockedDate);
                expect(userDelegatee).to.be.equal(delegatee);

                //check getPriorTotalStakesForDate
                let priorTotalStakeBefore = await staking.getPriorTotalStakesForDate(
                    lockedDate,
                    blockBefore
                );
                let priorTotalStakeAfter = await staking.getPriorTotalStakesForDate(
                    lockedDate,
                    blockAfter
                );
                expect(priorTotalStakeAfter.sub(priorTotalStakeBefore)).to.be.equal(
                    intervalAmount
                );

                //check getPriorUserStakeByDate
                let priorUserStakeBefore = await staking.getPriorUserStakeByDate(
                    user,
                    lockedDate,
                    blockBefore
                );
                let priorUserStakeAfter = await staking.getPriorUserStakeByDate(
                    user,
                    lockedDate,
                    blockAfter
                );
                expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(intervalAmount);

                //check getPriorStakeByDateForDelegatee
                let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    lockedDate,
                    blockBefore
                );
                let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    lockedDate,
                    blockAfter
                );
                expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(
                    intervalAmount
                );

                await expectEvent.inTransaction(
                    tx.receipt.rawLogs[0].transactionHash,
                    StakingStakeModule,
                    "TokensStaked",
                    {
                        staker: user,
                        amount: intervalAmount,
                        lockedUntil: lockedDate,
                        totalStaked: intervalAmount,
                    }
                );

                await expectEvent.inTransaction(
                    tx.receipt.rawLogs[0].transactionHash,
                    StakingStakeModule,
                    "DelegateChanged",
                    {
                        delegator: user,
                        lockedUntil: lockedDate,
                        fromDelegate: ZERO_ADDRESS,
                        toDelegate: delegatee,
                    }
                );
            }
        });

        //if delegatee is the 0 address, the stake is delegated to stakeFor
        //if stakeFor is a vesting contract, getPriorVestingStakeByDate
        //      returns the increased vesting stake for stakeFor per lock date
        it("should stake tokens for user with delegation using a schedule", async () => {
            let user = accounts[0];
            let delegatee = accounts[1];
            let intervalAmount = new BN(1000);
            let intervalCount = new BN(7);
            let amount = intervalAmount.mul(intervalCount);
            let cliff = new BN(TWO_WEEKS);
            let intervalLength = new BN(TWO_WEEKS);
            let duration = intervalLength.mul(intervalCount);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            await staking.addContractCodeHash(user);
            let tx = await staking.stakeBySchedule(
                amount,
                cliff,
                duration,
                intervalLength,
                user,
                ZERO_ADDRESS,
                { from: user }
            );

            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            let startDate = kickoffTS.add(cliff);
            let endDate = kickoffTS.add(duration);
            for (
                let lockedDate = startDate;
                lockedDate <= endDate;
                lockedDate = lockedDate.add(intervalLength)
            ) {
                //check delegatee
                let userDelegatee = await staking.delegates(user, lockedDate);
                expect(userDelegatee).to.be.equal(user);

                //check getPriorVestingStakeByDate
                let priorDelegateStakeBefore = await staking.getPriorVestingStakeByDate(
                    lockedDate,
                    blockBefore
                );
                let priorDelegateStakeAfter = await staking.getPriorVestingStakeByDate(
                    lockedDate,
                    blockAfter
                );
                expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(
                    intervalAmount
                );
            }
        });

        //if stakeFor is the 0 address, the function stakes for the msg.sender
        it("should stake tokens for user with delegation using a schedule", async () => {
            let user = accounts[0];
            let delegatee = accounts[1];
            let intervalAmount = new BN(1000);
            let intervalCount = new BN(7);
            let amount = intervalAmount.mul(intervalCount);
            let cliff = new BN(TWO_WEEKS);
            let intervalLength = new BN(TWO_WEEKS);
            let duration = intervalLength.mul(intervalCount);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, { from: user });

            let tx = await staking.stakeBySchedule(
                amount,
                cliff,
                duration,
                intervalLength,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                { from: user }
            );

            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            let startDate = kickoffTS.add(cliff);
            let endDate = kickoffTS.add(duration);
            for (
                let lockedDate = startDate;
                lockedDate <= endDate;
                lockedDate = lockedDate.add(intervalLength)
            ) {
                //check delegatee
                let userDelegatee = await staking.delegates(user, lockedDate);
                expect(userDelegatee).to.be.equal(user);

                //check getPriorUserStakeByDate
                let priorUserStakeBefore = await staking.getPriorUserStakeByDate(
                    user,
                    lockedDate,
                    blockBefore
                );
                let priorUserStakeAfter = await staking.getPriorUserStakeByDate(
                    user,
                    lockedDate,
                    blockAfter
                );
                expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(intervalAmount);
            }
        });
    });

    describe("token balanceOf", () => {
        // NOTE: these don't test the actual balanceOf function, but the balanceOf function of the token contract
        it("grants to initial account", async () => {
            expect((await token.balanceOf.call(root)).toString()).to.be.equal(TOTAL_SUPPLY);
        });
    });

    describe("numCheckpoints", () => {
        it("returns the number of checkpoints for a delegate", async () => {
            let guy = accounts[0];
            await token.transfer(guy, "1000"); // give an account a few tokens for readability
            await expect(
                (await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()
            ).to.be.equal("0");

            await token.approve(staking.address, "1000", { from: guy });
            await staking.stake("100", inThreeYears, a1, a1, { from: guy });
            await expect(
                (await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()
            ).to.be.equal("1");

            await staking.stake("50", inThreeYears, a1, a1, { from: guy });
            await expect(
                (await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()
            ).to.be.equal("2");
        });

        it("does not add more than one checkpoint in a block", async () => {
            let guy = accounts[1];
            await token.transfer(guy, "1000"); // give an account a few tokens for readability
            await expect(
                (await staking.numUserStakingCheckpoints.call(a3, inThreeYears)).toString()
            ).to.be.equal("0");

            await token.approve(staking.address, "1000", { from: guy });

            // TODO: this doesn't work -- t1, t2, t3 and t4 all get mined in different blocks,
            // not in the same block
            // await minerStop();
            let t1 = staking.stake("80", inThreeYears, a3, a3, { from: guy });

            let t2 = staking.delegate(a3, inThreeYears, { from: guy });
            let t3 = token.transfer(a2, 10, { from: guy });
            let t4 = token.transfer(a2, 10, { from: guy });

            // await minerStart();
            t1 = await t1;

            // Some of these might fail but it's ok for our purposes.
            for (const promise of [t2, t3, t4]) {
                try {
                    await promise;
                } catch (e) {
                    // ignore
                }
            }

            await expect(
                (await staking.numUserStakingCheckpoints.call(a3, inThreeYears)).toString()
            ).to.be.equal("1");

            let checkpoint0 = await staking.userStakingCheckpoints.call(a3, inThreeYears, 0);
            await expect(checkpoint0.fromBlock.toString()).to.be.equal(
                t1.receipt.blockNumber.toString()
            );
            await expect(checkpoint0.stake.toString()).to.be.equal("80");

            let checkpoint1 = await staking.userStakingCheckpoints.call(a3, inThreeYears, 1);
            await expect(checkpoint1.fromBlock.toString()).to.be.equal("0");
            await expect(checkpoint1.stake.toString()).to.be.equal("0");

            let checkpoint2 = await staking.userStakingCheckpoints.call(a3, inThreeYears, 2);
            await expect(checkpoint2.fromBlock.toString()).to.be.equal("0");
            await expect(checkpoint2.stake.toString()).to.be.equal("0");

            await token.approve(staking.address, "20", { from: a2 });
            let t5 = await staking.stake("20", inThreeYears, a3, a3, { from: a2 });

            await expect(
                (await staking.numUserStakingCheckpoints.call(a3, inThreeYears)).toString()
            ).to.be.equal("2");

            checkpoint1 = await staking.userStakingCheckpoints.call(a3, inThreeYears, 1);
            await expect(checkpoint1.fromBlock.toString()).to.be.equal(
                t5.receipt.blockNumber.toString()
            );
            await expect(checkpoint1.stake.toString()).to.be.equal("100");
        });
    });

    describe("getPriorVotes", () => {
        let amount = "1000";

        it("the function reverts if blockNumber >= current block", async () => {
            let time = kickoffTS.add(new BN(DELAY));
            await expectRevert(staking.getPriorVotes.call(a1, 5e10, time), "not determined yet"); // WS11 : not determined yet
        });

        it("if account has no stakes at blockNumber or date, the function returns 0", async () => {
            expect((await staking.getPriorVotes.call(a1, 0, kickoffTS)).toString()).to.be.equal(
                "0"
            );
            // This is tested with more detail in other tests.
        });

        it("returns the latest block if >= last checkpoint block", async () => {
            await token.approve(staking.address, amount);
            let t1 = await staking.stake(amount, inThreeYears, a1, a1);
            await mineBlock();
            await mineBlock();

            let amountWithWeight = getAmountWithWeightMaxDuration(amount);
            expect(
                (
                    await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber), kickoffTS)
                ).toString()
            ).to.be.equal(amountWithWeight.toString());
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t1.receipt.blockNumber + 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal(amountWithWeight.toString());
        });

        it("returns zero if < first checkpoint block", async () => {
            await mineBlock();
            await token.approve(staking.address, amount);
            let t1 = await staking.stake(amount, inThreeYears, a1, a1);
            await mineBlock();
            await mineBlock();

            let amountWithWeight = getAmountWithWeightMaxDuration(amount);
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t1.receipt.blockNumber - 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal("0");
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t1.receipt.blockNumber + 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal(amountWithWeight.toString());
        });

        it("generally returns the voting balance at the appropriate checkpoint", async () => {
            await token.approve(staking.address, "1000");
            await staking.stake("1000", inThreeYears, root, root);
            const t1 = await staking.delegate(a1, inThreeYears);
            await mineBlock();
            await mineBlock();
            await token.transfer(a2, 10);
            await token.approve(staking.address, "10", { from: a2 });
            const t2 = await staking.stake("10", inThreeYears, a1, a1, { from: a2 });
            await mineBlock();
            await mineBlock();
            await token.transfer(a3, 101);
            await token.approve(staking.address, "101", { from: a3 });
            const t3 = await staking.stake("101", inThreeYears, a1, a1, { from: a3 });
            await mineBlock();
            await mineBlock();

            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t1.receipt.blockNumber - 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal("0");
            expect(
                (
                    await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber), kickoffTS)
                ).toString()
            ).to.be.equal(getAmountWithWeightMaxDuration("1000").toString());
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t1.receipt.blockNumber + 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal(getAmountWithWeightMaxDuration("1000").toString());
            expect(
                (
                    await staking.getPriorVotes.call(a1, new BN(t2.receipt.blockNumber), kickoffTS)
                ).toString()
            ).to.be.equal(getAmountWithWeightMaxDuration("1010").toString());
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t2.receipt.blockNumber + 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal(getAmountWithWeightMaxDuration("1010").toString());
            expect(
                (
                    await staking.getPriorVotes.call(a1, new BN(t3.receipt.blockNumber), kickoffTS)
                ).toString()
            ).to.be.equal(getAmountWithWeightMaxDuration("1111").toString());
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t3.receipt.blockNumber + 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal(getAmountWithWeightMaxDuration("1111").toString());
        });

        it("the function returns the voting power (not the stake!) of account at the given date and blockNumber", async () => {
            // this also tests the formula
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const amount1 = new BN("1000");
            const amount2 = new BN("50");
            const stakeBlockNumber1 = await initializeStake(stakeDate, amount1);
            const stakeBlockNumber2 = await initializeStake(stakeDate, amount2);

            // test only the first stake visible
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber1, stakeDate)
            ).to.be.bignumber.equal(getAmountWithWeight(amount1, stakeDate, stakeDate));
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber1, kickoffTS)
            ).to.be.bignumber.equal(getAmountWithWeight(amount1, stakeDate, kickoffTS));
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber1, stakeDate.add(TWO_WEEKS_BN))
            ).to.be.bignumber.equal("0");
            // test both stakes visible
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber2, stakeDate)
            ).to.be.bignumber.equal(
                getAmountWithWeight(amount1.add(amount2), stakeDate, stakeDate)
            );
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber2, kickoffTS)
            ).to.be.bignumber.equal(
                getAmountWithWeight(amount1.add(amount2), stakeDate, kickoffTS)
            );
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber2, stakeDate.add(TWO_WEEKS_BN))
            ).to.be.bignumber.equal("0");
        });

        it("if there are stakes for several users at date and blockNumber, the function returns only the voting power of account", async () => {
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const amount1 = new BN("98");
            const amount2 = new BN("75");
            await initializeStake(stakeDate, amount1, a1);
            const stakeBlockNumber = await initializeStake(stakeDate, amount2, a2);

            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber, stakeDate)
            ).to.be.bignumber.equal(getAmountWithWeight(amount1, stakeDate, stakeDate));
            expect(
                await staking.getPriorVotes(a2, stakeBlockNumber, stakeDate)
            ).to.be.bignumber.equal(getAmountWithWeight(amount2, stakeDate, stakeDate));
            expect(
                await staking.getPriorVotes(a3, stakeBlockNumber, stakeDate)
            ).to.be.bignumber.equal("0");
        });

        it("if account has stakes on multiple dates, the function only returns the voting power associated with date", async () => {
            const stakeDate1 = kickoffTS.add(TWO_WEEKS_BN);
            const stakeDate2 = stakeDate1.add(TWO_WEEKS_BN);
            const amount1 = new BN("1000");
            const amount2 = new BN("50");
            await initializeStake(stakeDate1, amount1);
            const stakeBlockNumber = await initializeStake(stakeDate2, amount2);

            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber, stakeDate1)
            ).to.be.bignumber.equal(
                getAmountWithWeight(amount1, stakeDate1, stakeDate1).add(
                    getAmountWithWeight(amount2, stakeDate2, stakeDate1)
                )
            );
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber, stakeDate2)
            ).to.be.bignumber.equal(getAmountWithWeight(amount2, stakeDate2, stakeDate2));
        });

        // "the voting power is returned correctly as stake[date] * weight[date] according to the formula" is tested
        // implicitly in the above cases

        it("if date is not a valid lock date, the function will return the voting power of account at the closest lock date prior to date", async () => {
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const amount = new BN("1000");
            const stakeBlockNumber = await initializeStake(stakeDate, amount);

            // sanity check
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber, stakeDate)
            ).to.be.bignumber.equal(getAmountWithWeight(amount, stakeDate, stakeDate));

            // these will be rounded back to to stakeDate
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber, stakeDate.add(new BN(1)))
            ).to.be.bignumber.equal(getAmountWithWeight(amount, stakeDate, stakeDate));
            expect(
                await staking.getPriorVotes(
                    a1,
                    stakeBlockNumber,
                    stakeDate.add(TWO_WEEKS_BN.sub(new BN(1)))
                )
            ).to.be.bignumber.equal(getAmountWithWeight(amount, stakeDate, stakeDate));

            // this is a valid lock date (stakeDate + 2 weeks) e.g. no stake visible
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber, stakeDate.add(TWO_WEEKS_BN))
            ).to.be.bignumber.equal("0");

            // in these, start date will be rounded to stakeDate - 2 weeks
            expect(
                await staking.getPriorVotes(a1, stakeBlockNumber, stakeDate.sub(new BN(1)))
            ).to.be.bignumber.equal(
                getAmountWithWeight(amount, stakeDate, stakeDate.sub(TWO_WEEKS_BN))
            );
            expect(
                await staking.getPriorVotes(
                    a1,
                    stakeBlockNumber,
                    stakeDate.sub(TWO_WEEKS_BN).add(new BN(1))
                )
            ).to.be.bignumber.equal(
                getAmountWithWeight(amount, stakeDate, stakeDate.sub(TWO_WEEKS_BN))
            );

            // this will be stakeDate - 4 weeks
            expect(
                await staking.getPriorVotes(
                    a1,
                    stakeBlockNumber,
                    stakeDate.sub(TWO_WEEKS_BN).sub(new BN(1))
                )
            ).to.be.bignumber.equal(
                getAmountWithWeight(amount, stakeDate, stakeDate.sub(TWO_WEEKS_BN.mul(new BN(2))))
            );
        });
    });

    describe("addAdmin", () => {
        it("the owner may add an admin if the contract is not frozen", async () => {
            expect(await staking.admins(a1)).to.be.false; // sanity check

            const tx = await staking.addAdmin(a1);
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "AdminAdded",
                {
                    admin: a1,
                }
            );
            expect(await staking.admins(a1)).to.be.true;
        });

        it("the owner may not add an admin if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.addAdmin(a1), "paused");
        });

        it("the owner may add an admin if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.addAdmin(a1);
            expect(await staking.admins(a1)).to.be.true;
        });

        it("any other address may not add an admin", async () => {
            await expectRevert(staking.addAdmin(a1, { from: a1 }), "unauthorized");
            await staking.addAdmin(a1);
            await expectRevert(staking.addAdmin(a2, { from: a1 }), "unauthorized");
        });

        it("it is not allowed to add the 0 address as an admin", async () => {
            await expectRevert(
                staking.addAdmin(address(0)),
                "cannot add the zero address as an admin"
            );
        });
    });

    describe("removeAdmin", () => {
        it("the owner may remove an admin if the contract is not frozen", async () => {
            await staking.addAdmin(a1);
            let tx = await staking.removeAdmin(a1);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "AdminRemoved",
                {
                    admin: a1,
                }
            );

            let isAdmin = await staking.admins(a1);
            expect(isAdmin).equal(false);
        });

        it("the owner may not remove an admin if the contract is frozen", async () => {
            await staking.addAdmin(a1);
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.removeAdmin(a1), "paused");
        });

        it("the owner may remove an admin if the contract is paused", async () => {
            await staking.addAdmin(a1);
            await staking.pauseUnpause(true);
            await staking.removeAdmin(a1);
            expect(await staking.admins(a1)).to.be.false;
        });

        it("any other address may not remove an admin", async () => {
            await expectRevert(staking.removeAdmin(a1, { from: a1 }), "unauthorized");
            await staking.addAdmin(a1);
            await expectRevert(staking.removeAdmin(a2, { from: a1 }), "unauthorized");
        });

        it("reverts if _admin is not an admin", async () => {
            await expectRevert(staking.removeAdmin(a1), "address is not an admin");
        });
    });

    describe("addPauser", () => {
        it("the owner may add a pauser if the contract is not frozen", async () => {
            expect(await staking.pausers(a1)).to.be.false; // sanity check

            const tx = await staking.addPauser(a1);
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "PauserAddedOrRemoved",
                {
                    pauser: a1,
                    added: true,
                }
            );
            expect(await staking.pausers(a1)).to.be.true;
        });

        it("the owner may not add a pauser if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.addPauser(a1), "paused");
        });

        it("the owner may add a  pauser if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.addPauser(a1);
            expect(await staking.pausers(a1)).to.be.true;
        });

        it("any other address may not add a pauser", async () => {
            await expectRevert(staking.addPauser(a1, { from: a1 }), "unauthorized");
            await staking.addAdmin(a1);
            await expectRevert(staking.addPauser(a2, { from: a1 }), "unauthorized");
        });

        it("it is not allowed to add the 0 address as a pauser", async () => {
            await expectRevert(
                staking.addPauser(address(0)),
                "cannot add the zero address as a pauser"
            );
        });
    });

    describe("removePauser", () => {
        it("the owner may remove a pauser if the contract is not frozen", async () => {
            await staking.addPauser(a1);

            const tx = await staking.removePauser(a1);
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "PauserAddedOrRemoved",
                {
                    pauser: a1,
                    added: false,
                }
            );
            expect(await staking.pausers(a1)).to.be.false;
        });

        it("the owner may not remove a pauser if the contract is frozen", async () => {
            await staking.addPauser(a1);
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.removePauser(a1), "paused");
        });

        it("the owner may remove a pauser if the contract is paused", async () => {
            await staking.addPauser(a1);
            await staking.pauseUnpause(true);
            await staking.removePauser(a1);
            expect(await staking.pausers(a1)).to.be.false;
        });

        it("any other address may not remove a pauser", async () => {
            await staking.addPauser(a1);
            await expectRevert(staking.removePauser(a1, { from: a1 }), "unauthorized");
            await staking.addAdmin(a2);
            await expectRevert(staking.removePauser(a1, { from: a2 }), "unauthorized");
        });

        it("reverts if _pauser is not a pauser", async () => {
            await expectRevert(staking.removePauser(a1), "address is not a pauser");
        });
    });

    describe("pauseUnpause", () => {
        it("the owner may pause/unpause if the contract is not frozen", async () => {
            expect(await staking.paused()).to.be.false; // sanity check

            let tx = await staking.pauseUnpause(true);
            expect(await staking.paused()).to.be.true;

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "StakingPaused",
                {
                    setPaused: true,
                }
            );

            tx = await staking.pauseUnpause(false);
            expect(await staking.paused()).to.be.false;

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "StakingPaused",
                {
                    setPaused: false,
                }
            );
        });

        it("the owner may not pause/unpause if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.pauseUnpause(true), "paused");

            await staking.freezeUnfreeze(false);
            await staking.pauseUnpause(true);

            await staking.freezeUnfreeze(true);
            await expectRevert(staking.pauseUnpause(false), "paused");
        });

        it("a pauser different from the owner may pause/unpause if the contract is not frozen", async () => {
            await staking.addPauser(a2);

            await staking.pauseUnpause(true, { from: a2 });
            expect(await staking.paused()).to.be.true;

            await staking.pauseUnpause(false, { from: a2 });
            expect(await staking.paused()).to.be.false;
        });

        it("any other address may not pause/unpause", async () => {
            await expectRevert(staking.pauseUnpause(true, { from: a1 }), "unauthorized");
            await expectRevert(staking.pauseUnpause(false, { from: a1 }), "unauthorized");
            await staking.addAdmin(a1);
            await expectRevert(staking.pauseUnpause(true, { from: a1 }), "unauthorized");
            await expectRevert(staking.pauseUnpause(false, { from: a1 }), "unauthorized");
        });
    });

    describe("freezeUnfreeze", () => {
        it("the owner may freeze/unfreeze if the contract is not frozen", async () => {
            expect(await staking.frozen()).to.be.false; // sanity check
            expect(await staking.paused()).to.be.false; // sanity check

            let tx = await staking.freezeUnfreeze(true);
            expect(await staking.frozen()).to.be.true;
            expect(await staking.paused()).to.be.true; // freezing also pauses

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "StakingFrozen",
                {
                    setFrozen: true,
                }
            );
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "StakingPaused",
                {
                    setPaused: true,
                }
            );

            tx = await staking.freezeUnfreeze(false);
            expect(await staking.frozen()).to.be.false;
            expect(await staking.paused()).to.be.true; // unfreezing doesn't unpause

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "StakingFrozen",
                {
                    setFrozen: false,
                }
            );
        });

        it("the owner may unfreeze if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            expect(await staking.frozen()).to.be.true;
            await staking.freezeUnfreeze(false);
            expect(await staking.frozen()).to.be.false;
        });

        it("the owner may freeze/unfreeze if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.freezeUnfreeze(true);
            expect(await staking.frozen()).to.be.true;
            expect(await staking.paused()).to.be.true;

            await staking.freezeUnfreeze(false);
            expect(await staking.frozen()).to.be.false;
        });

        it("a pauser different from the owner may freeze/unfreeze", async () => {
            await staking.addPauser(a2);

            await staking.freezeUnfreeze(true, { from: a2 });
            expect(await staking.frozen()).to.be.true;
            expect(await staking.paused()).to.be.true;

            await staking.freezeUnfreeze(false, { from: a2 });
            expect(await staking.frozen()).to.be.false;
        });

        it("another contract may not freeze/unfreeze", async () => {
            await expectRevert(staking.freezeUnfreeze(true, { from: a1 }), "unauthorized");
            await staking.addAdmin(a1);
            await expectRevert(staking.freezeUnfreeze(true, { from: a1 }), "unauthorized");
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.freezeUnfreeze(false, { from: a1 }), "unauthorized");
        });

        it("freezing/unfreezing to the same state as before will revert", async () => {
            await expectRevert(
                staking.freezeUnfreeze(false),
                "Cannot freeze/unfreeze to the same state"
            );
            await staking.freezeUnfreeze(true);
            await expectRevert(
                staking.freezeUnfreeze(true),
                "Cannot freeze/unfreeze to the same state"
            );
        });
    });

    describe("addContractCodeHash", () => {
        let randomContract;
        let randomContractCodeHash;

        beforeEach(async () => {
            // It doesn't matter what this contract is, but it must be a contract that is deployed
            randomContract = await TestToken.new("fake", "fake", 0, 0);
            randomContractCodeHash = web3.utils.soliditySha3(
                await web3.eth.getCode(randomContract.address)
            );
        });

        it("the owner may add a vesting code hash if the contract is not frozen", async () => {
            // sanity checks
            expect(await staking.isVestingContract(randomContract.address)).to.be.false;
            expect(await staking.frozen()).to.be.false; // sanity check

            let tx = await staking.addContractCodeHash(randomContract.address);
            expect(await staking.isVestingContract(randomContract.address)).to.be.true;

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingVestingModule,
                "ContractCodeHashAdded",
                {
                    hash: randomContractCodeHash,
                }
            );
        });

        it("the owner may not add a vesting code hash if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.addContractCodeHash(randomContract.address), "paused");
        });

        it("the owner may add a vesting code hash if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.addContractCodeHash(randomContract.address);
            expect(await staking.isVestingContract(randomContract.address)).to.be.true;
        });

        it("other accounts cannot add a vesting code hash", async () => {
            await expectRevert(
                staking.addContractCodeHash(randomContract.address, { from: a2 }),
                "unauthorized"
            );
        });

        it("an admin other than the owner may add a vesting code hash if the contract is not frozen", async () => {
            await staking.addAdmin(a2);

            await staking.addContractCodeHash(randomContract.address, { from: a2 });
            expect(await staking.isVestingContract(randomContract.address)).to.be.true;
        });
    });

    describe("removeContractCodeHash", () => {
        let randomContract;
        let randomContractCodeHash;

        beforeEach(async () => {
            // It doesn't matter what this contract is, but it must be a contract that is deployed
            randomContract = await TestToken.new("fake", "fake", 0, 0);
            randomContractCodeHash = web3.utils.soliditySha3(
                await web3.eth.getCode(randomContract.address)
            );
        });

        it("the owner may remove a vesting code hash if the contract is not frozen", async () => {
            // sanity checks
            await staking.addContractCodeHash(randomContract.address);
            expect(await staking.isVestingContract(randomContract.address)).to.be.true;
            expect(await staking.frozen()).to.be.false; // sanity check

            let tx = await staking.removeContractCodeHash(randomContract.address);
            expect(await staking.isVestingContract(randomContract.address)).to.be.false;

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingVestingModule,
                "ContractCodeHashRemoved",
                {
                    hash: randomContractCodeHash,
                }
            );
        });

        it("the owner may not remove a vesting code hash if the contract is frozen", async () => {
            await staking.addContractCodeHash(randomContract.address);
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.removeContractCodeHash(randomContract.address), "paused");
        });

        it("the owner may remove a vesting code hash if the contract is paused", async () => {
            await staking.addContractCodeHash(randomContract.address);
            await staking.pauseUnpause(true);
            await staking.removeContractCodeHash(randomContract.address);
            expect(await staking.isVestingContract(randomContract.address)).to.be.false;
        });

        it("an admin other than the owner may remove a vesting code hash if the contract is not frozen", async () => {
            await staking.addContractCodeHash(randomContract.address);
            await staking.addAdmin(a2);

            await staking.removeContractCodeHash(randomContract.address, { from: a2 });
            expect(await staking.isVestingContract(randomContract.address)).to.be.false;
        });

        it("other accounts cannot remove a vesting code hash", async () => {
            await staking.addContractCodeHash(randomContract.address);
            await expectRevert(
                staking.removeContractCodeHash(randomContract.address, { from: a2 }),
                "unauthorized"
            );
        });

        it("reverts if vesting is not actually a registered vesting contract code hash", async () => {
            await expectRevert(
                staking.removeContractCodeHash(randomContract.address),
                "not a registered vesting code hash"
            );
        });
    });

    describe("setNewStakingContract", () => {
        it("the owner may set the new staking contract if the contract is not frozen", async () => {
            expect(await staking.frozen()).to.be.false; // sanity check

            await staking.setNewStakingContract(a2);
            expect(await staking.newStakingContract()).to.equal(a2);
        });

        it("the owner may not set the new staking contract if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.setNewStakingContract(a2), "paused");
        });

        it("the owner may set the new staking contract if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.setNewStakingContract(a2);
            expect(await staking.newStakingContract()).to.equal(a2);
        });

        it("any other address may not set the new staking contract", async () => {
            await expectRevert(staking.setNewStakingContract(a2, { from: a2 }), "unauthorized");
        });

        it("it is not allowed to set the new staking contract to the 0 address", async () => {
            await expectRevert(
                staking.setNewStakingContract(ZERO_ADDRESS),
                "can't reset the new staking contract to 0"
            );
        });

        it("calling newStakingContract returns _newStakingContract", async () => {
            await staking.setNewStakingContract(a2);
            expect(await staking.newStakingContract()).to.equal(a2);
        });
    });

    describe("setFeeSharing", () => {
        it("the owner may set the fee sharing contract if the contract is not frozen", async () => {
            expect(await staking.frozen()).to.be.false; // sanity check

            await staking.setFeeSharing(a2);
            expect(await staking.feeSharing()).to.equal(a2);
        });

        it("the owner may not set the fee sharing contract if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.setFeeSharing(a2), "paused");
        });

        it("the owner may set the fee sharing contract if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.setFeeSharing(a2);
            expect(await staking.feeSharing()).to.equal(a2);
        });

        it("any other address may not set the fee sharing contract", async () => {
            await expectRevert(staking.setFeeSharing(a2, { from: a2 }), "unauthorized");
        });

        it("it is not allowed to set the fee sharing contract to the 0 address", async () => {
            await expectRevert(
                staking.setFeeSharing(ZERO_ADDRESS),
                "FeeSharing address shouldn't be 0"
            );
        });

        it("calling feeSharing returns _feeSharing", async () => {
            await staking.setFeeSharing(a2);
            expect(await staking.feeSharing()).to.equal(a2);
        });
    });

    describe("setWeightScaling", () => {
        let MIN_WEIGHT_SCALING;
        let MAX_WEIGHT_SCALING;

        beforeEach(async () => {
            const ret = await staking.getStorageRangeForWeightScaling();
            MIN_WEIGHT_SCALING = ret.minWeightScaling.toNumber();
            MAX_WEIGHT_SCALING = ret.maxWeightScaling.toNumber();
        });

        it("the owner may set the scaling weight if the contract is not frozen", async () => {
            expect(await staking.frozen()).to.be.false; // sanity check

            await staking.setWeightScaling(5);
            expect(await staking.weightScaling()).to.bignumber.equal("5");
        });

        it("the owner may not set the scaling weight if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.setWeightScaling(5), "paused");
        });

        it("the owner may set the scaling weight if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.setWeightScaling(6);
            expect(await staking.weightScaling()).to.bignumber.equal("6");
        });

        it("any other address may not set the scaling weight", async () => {
            await expectRevert(staking.setWeightScaling(5, { from: a2 }), "unauthorized");
            // add a2 as admin and try again
            await staking.addAdmin(a2);
            await expectRevert(staking.setWeightScaling(5, { from: a2 }), "unauthorized");
        });

        it("it is not allowed to set the scaling weight lower than MIN_WEIGHT_SCALING", async () => {
            await expectRevert(
                staking.setWeightScaling(MIN_WEIGHT_SCALING - 1),
                "scaling doesn't belong to range [1, 9]"
            ); //S18
            // test boundary
            await staking.setWeightScaling(MIN_WEIGHT_SCALING);
            expect(await staking.weightScaling()).to.bignumber.equal(
                MIN_WEIGHT_SCALING.toString()
            );
        });

        it("it is not allowed to set the scaling weight higher than MAX_WEIGHT_SCALING", async () => {
            await expectRevert(
                staking.setWeightScaling(MAX_WEIGHT_SCALING + 1),
                "scaling doesn't belong to range [1, 9]"
            ); //S18
            // test boundary
            await staking.setWeightScaling(MAX_WEIGHT_SCALING);
            expect(await staking.weightScaling()).to.bignumber.equal(
                MAX_WEIGHT_SCALING.toString()
            );
        });
    });

    describe("vesting stakes", () => {
        it("should set vesting stakes", async () => {
            let guy = accounts[0];
            let lockedDates = [
                kickoffTS.add(new BN(TWO_WEEKS)),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2))),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4))),
            ];
            let values = [new BN(1000), new BN(30000000000), new BN(500000000000000)];
            let totalStaked = values[0].add(values[1]).add(values[2]);
            await token.transfer(guy, totalStaked); // give an account a few tokens for readability
            await token.approve(staking.address, totalStaked, { from: guy });

            // stake for exact date
            await Promise.all([
                staking.stake(values[0], lockedDates[0], a1, a1, { from: guy }),
                staking.stake(values[1], lockedDates[1], a1, a1, { from: guy }),
                staking.stake(values[2], lockedDates[2], a1, a1, { from: guy }),
            ]);

            let tx = await staking.setVestingStakes(lockedDates, values);
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());

            for (let i = 0; i < lockedDates.length; i++) {
                let numCheckpoints = await staking.numVestingCheckpoints.call(lockedDates[i]);
                expect(numCheckpoints).to.be.bignumber.equal(new BN(1));
                let value = await staking.vestingCheckpoints.call(lockedDates[i], 0);
                expect(value.stake).to.be.bignumber.equal(values[i]);
                expect(value.fromBlock).to.be.bignumber.equal(txBlockNumber.sub(new BN(1)));

                await expectEvent.inTransaction(
                    tx.receipt.rawLogs[0].transactionHash,
                    StakingVestingModule,
                    "VestingStakeSet",
                    {
                        lockedTS: lockedDates[i],
                        value: values[i],
                    }
                );
            }
        });

        it("should set vesting stakes if lockedDate < blockTimestamp", async () => {
            let guy = accounts[0];
            let lockedDates = [
                kickoffTS.add(new BN(TWO_WEEKS)),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2))),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4))),
            ];
            let values = [new BN(1000), new BN(30000000000), new BN(500000000000000)];
            let totalStaked = values[0].add(values[1]).add(values[2]);
            await token.transfer(guy, totalStaked); // give an account a few tokens for readability
            await token.approve(staking.address, totalStaked, { from: guy });

            // stake for exact date
            await Promise.all([
                staking.stake(values[0], lockedDates[0], a1, a1, { from: guy }),
                staking.stake(values[1], lockedDates[1], a1, a1, { from: guy }),
                staking.stake(values[2], lockedDates[2], a1, a1, { from: guy }),
            ]);

            await time.increase(2592000); // increase timestamp 30 days, so that lockedDates will be < blockTimestamp
            let tx = await staking.setVestingStakes(lockedDates, values);
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());

            for (let i = 0; i < lockedDates.length; i++) {
                let numCheckpoints = await staking.numVestingCheckpoints.call(lockedDates[i]);
                expect(numCheckpoints).to.be.bignumber.equal(new BN(1));
                let value = await staking.vestingCheckpoints.call(lockedDates[i], 0);
                expect(value.stake).to.be.bignumber.equal(values[i]);
                expect(value.fromBlock).to.be.bignumber.equal(txBlockNumber.sub(new BN(1)));

                await expectEvent.inTransaction(
                    tx.receipt.rawLogs[0].transactionHash,
                    StakingVestingModule,
                    "VestingStakeSet",
                    {
                        lockedTS: lockedDates[i],
                        value: values[i],
                    }
                );
            }
        });

        it("should set vesting stakes (using the last existing checkpoint blockNumber", async () => {
            let guy = accounts[0];
            let lockedDates = [
                kickoffTS.add(new BN(TWO_WEEKS)),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2))),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4))),
            ];
            let values = [new BN(1000), new BN(30000000000), new BN(500000000000000)];
            let totalStaked = values[0].mul(new BN(2)).add(values[1]).add(values[2]);
            await token.transfer(guy, totalStaked); // give an account a few tokens for readability
            await token.approve(staking.address, totalStaked, { from: guy });

            // stake for exact date
            await Promise.all([
                staking.stake(values[0], lockedDates[0], a1, a1, { from: guy }),
                staking.stake(values[1], lockedDates[1], a1, a1, { from: guy }),
                staking.stake(values[2], lockedDates[2], a1, a1, { from: guy }),
            ]);

            let tx = await staking.setVestingStakes(lockedDates, values);
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());

            for (let i = 0; i < lockedDates.length; i++) {
                let numCheckpoints = await staking.numVestingCheckpoints.call(lockedDates[i]);
                expect(numCheckpoints).to.be.bignumber.equal(new BN(1));
                let value = await staking.vestingCheckpoints.call(lockedDates[i], 0);
                expect(value.stake).to.be.bignumber.equal(values[i]);
                expect(value.fromBlock).to.be.bignumber.equal(txBlockNumber.sub(new BN(1)));

                await expectEvent.inTransaction(
                    tx.receipt.rawLogs[0].transactionHash,
                    StakingVestingModule,
                    "VestingStakeSet",
                    {
                        lockedTS: lockedDates[i],
                        value: values[i],
                    }
                );
            }

            // set another vesting stakes
            tx = await staking.setVestingStakes([lockedDates[0]], [values[0]]);
            const previousVestingCheckpoint = await staking.vestingCheckpoints.call(
                lockedDates[0],
                0
            );

            numCheckpoints = await staking.numVestingCheckpoints.call(lockedDates[0]);
            expect(numCheckpoints).to.be.bignumber.equal(new BN(2));
            value = await staking.vestingCheckpoints.call(lockedDates[0], numCheckpoints - 1);
            expect(value.stake).to.be.bignumber.equal(values[0]);
            expect(value.fromBlock).to.be.bignumber.equal(
                new BN(previousVestingCheckpoint.fromBlock).add(new BN(1))
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingVestingModule,
                "VestingStakeSet",
                {
                    lockedTS: lockedDates[0],
                    value: values[0],
                }
            );
        });

        it("should revert to withdraw the staked by registered vesting contract before the vesting stake is set properly", async () => {
            let guy = accounts[0];
            let lockedDates = [kickoffTS.add(new BN(TWO_WEEKS))];
            let values = [new BN(1000)];
            let totalStaked = values[0].mul(new BN(2));
            await token.transfer(guy, totalStaked); // give an account a few tokens for readability
            await token.approve(staking.address, totalStaked, { from: guy });

            // stake for exact date
            await Promise.all([staking.stake(values[0], lockedDates[0], a1, a1, { from: guy })]);

            await vesting.addFourYearVestings([token.address], [a1]);

            setNextBlockTimestamp(lockedDates[0].toNumber());

            await expectRevert(
                staking.withdraw(values[0], lockedDates[0], root, { from: a1 }),
                "CP02"
            ); // underflow vesting stake
        });

        it("should succesfully withdraw the staked by registered vesting contract after the vesting stake is set properly", async () => {
            let guy = accounts[0];
            let lockedDates = [kickoffTS.add(new BN(TWO_WEEKS))];
            let values = [new BN(1000)];
            let totalStaked = values[0].mul(new BN(2));
            await token.transfer(guy, totalStaked); // give an account a few tokens for readability
            await token.approve(staking.address, totalStaked, { from: guy });

            // stake for exact date
            await Promise.all([staking.stake(values[0], lockedDates[0], a1, a1, { from: guy })]);

            await vesting.addFourYearVestings([token.address], [a1]);

            await staking.setVestingStakes(lockedDates, values);

            setNextBlockTimestamp(lockedDates[0].toNumber());

            await staking.withdraw(values[0], lockedDates[0], a1, { from: a1 });
        });
    });

    describe("setMaxVestingWithdrawIterations", () => {
        it("the owner may set max vesting iterations if the contract is not frozen", async () => {
            const oldMaxWithdrawIterations = await staking.getMaxVestingWithdrawIterations();
            const newMaxWithdrawIterations = new BN(20);
            const tx = await staking.setMaxVestingWithdrawIterations(newMaxWithdrawIterations);
            expect((await staking.getMaxVestingWithdrawIterations()).toString()).to.equal(
                newMaxWithdrawIterations.toString()
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "MaxVestingWithdrawIterationsUpdated",
                {
                    oldMaxIterations: oldMaxWithdrawIterations.toString(),
                    newMaxIterations: newMaxWithdrawIterations.toString(),
                }
            );
        });

        it("should fail if unauthorized", async () => {
            const newMaxWithdrawIterations = 20;
            await expectRevert(
                staking.setMaxVestingWithdrawIterations(newMaxWithdrawIterations, { from: a1 }),
                "unauthorized"
            );
        });

        it("should fail for 0 max iterations maxWithdrawIterations", async () => {
            const newMaxWithdrawIterations = 0;
            await expectRevert(
                staking.setMaxVestingWithdrawIterations(newMaxWithdrawIterations),
                "Invalid max iterations"
            );
        });

        it("the owner may not set max vesting iterations if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.setMaxVestingWithdrawIterations(20), "paused");
        });

        it("the owner may set max vesting iterations if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.setMaxVestingWithdrawIterations(21);
            expect(await staking.getMaxVestingWithdrawIterations()).to.bignumber.equal("21");
        });

        it("an admin other than the owner may set max vesting iterations if the contract is not frozen", async () => {
            await staking.addAdmin(a2);
            await staking.setMaxVestingWithdrawIterations(22, { from: a2 });
            expect(await staking.getMaxVestingWithdrawIterations()).to.bignumber.equal("22");
        });
    });

    describe("isVestingContract", () => {
        let randomContract;
        let randomContractCodeHash;

        beforeEach(async () => {
            // It doesn't matter what this contract is, but it must be a contract that is deployed
            randomContract = await TestToken.new("fake", "fake", 0, 0);
            randomContractCodeHash = web3.utils.soliditySha3(
                await web3.eth.getCode(randomContract.address)
            );
        });

        it("returns true if the code hash of stakerAddress is registered as a vesting contract", async () => {
            await staking.addContractCodeHash(a1);
            expect(await staking.isVestingContract(a1)).to.be.true;
        });

        it("returns true if is registered stakerAddress as a vesting contract on the vesting registry", async () => {
            await vesting.addFourYearVestings([address(1337)], [a1]);
            expect(await staking.isVestingContract(a1)).to.be.true;
        });

        it("returns false if none of the two is the case", async () => {
            expect(await staking.isVestingContract(a1)).to.be.false;
        });
    });

    describe("computeWeightByDate", () => {
        it("if date < startDate, the function reverts", async () => {
            await expectRevert(staking.computeWeightByDate(1, 2), "date < startDate");
            await staking.computeWeightByDate(1, 1); // no revert
        });

        it("if date - startDate > max duration, the function reverts", async () => {
            let startDate = new BN(1000);
            let date = startDate.add(MAX_DURATION).add(new BN(1));

            await expectRevert(
                staking.computeWeightByDate(date, startDate),
                "remaining time > max duration"
            );

            date = date.sub(new BN(1));
            await staking.computeWeightByDate(date, startDate); // no revert
        });

        it("calculates the weight according to the formula for all lock dates (passed as date) from startDate until startDate + max duration", async () => {
            const MAX_DURATION = await staking.MAX_DURATION();

            let startDate = await staking.kickoffTS();
            let date = startDate;
            while (date.lte(startDate.add(MAX_DURATION))) {
                const weight = await staking.computeWeightByDate(date, startDate);
                const expectedWeight = getWeight(date, startDate);
                expect(weight).to.be.bignumber.equal(expectedWeight);
                date = date.add(TWO_WEEKS_BN);
            }

            // couple of sanity checks for the boundaries
            expect(await staking.computeWeightByDate(startDate, startDate)).to.be.bignumber.equal(
                new BN(10)
            );
            expect(
                await staking.computeWeightByDate(startDate.add(MAX_DURATION), startDate)
            ).to.be.bignumber.equal(new BN(100));
        });
    });

    describe("timestampToLockDate", () => {
        it("if timestamp is a valid lock date, timestamp is returned", async () => {
            // kickoffTS is a valid lock date
            expect(await staking.timestampToLockDate(kickoffTS)).to.be.bignumber.equal(kickoffTS);

            // periods of two weeks after kickoff are valid lock dates
            let timestamp = kickoffTS.add(TWO_WEEKS_BN);
            expect(await staking.timestampToLockDate(timestamp)).to.be.bignumber.equal(timestamp);
            timestamp = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            expect(await staking.timestampToLockDate(timestamp)).to.be.bignumber.equal(timestamp);
            timestamp = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(1337)));
            expect(await staking.timestampToLockDate(timestamp)).to.be.bignumber.equal(timestamp);
        });

        it("if timestamp is not a valid lock date, the function will return the closest lock date prior to timestamp ", async () => {
            // test boundaries
            let expectedLockDate = kickoffTS;
            let timestamp = expectedLockDate.add(new BN(1));
            expect(await staking.timestampToLockDate(timestamp)).to.be.bignumber.equal(
                expectedLockDate
            );

            timestamp = expectedLockDate.add(TWO_WEEKS_BN).sub(new BN(1));
            expect(await staking.timestampToLockDate(timestamp)).to.be.bignumber.equal(
                expectedLockDate
            );

            expectedLockDate = kickoffTS.add(TWO_WEEKS_BN);
            timestamp = expectedLockDate.add(new BN(1));
            expect(await staking.timestampToLockDate(timestamp)).to.be.bignumber.equal(
                expectedLockDate
            );

            // test some valid lock date plus one week
            expectedLockDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(1337)));
            timestamp = expectedLockDate.add(ONE_DAY_BN.mul(new BN(7)));
            expect(await staking.timestampToLockDate(timestamp)).to.be.bignumber.equal(
                expectedLockDate
            );
        });

        it("if timestamp lies before the kickoff date, the function reverts", async () => {
            const timestamp = kickoffTS.sub(new BN(1));
            await expectRevert(
                staking.timestampToLockDate(timestamp),
                "timestamp < contract creation"
            );
        });

        it("the gas cost should be reduced", async () => {
            const cost = await staking.timestampToLockDate.estimateGas(kickoffTS);
            // 35255 is the original gas cost with reading kicoffTS 3 times from the storage, so it should be lower
            // than that
            expect(cost).to.be.lessThan(35255);
        });
    });

    describe("getPriorUserStakeByDate", () => {
        it("if blockNumber lies in the past, the function returns the amount of tokens account has staked until date at blockNumber", async () => {
            // preparation
            const user = a1;
            await token.transfer(user, "1000");
            await token.approve(staking.address, "1000", { from: user });
            const stakeDate = inThreeYears;

            // staking
            const stakeTx = await staking.stake("100", stakeDate, user, user, { from: user });
            const stakeBlockNumber = stakeTx.receipt.blockNumber;
            // weirdly, we have to mine a block, because blockNumber needs to be in the past or it'll revert
            await mineBlock();

            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate, stakeBlockNumber)
            ).to.be.bignumber.eq("100");
            expect(
                await staking.getPriorUserStakeByDate(
                    user,
                    stakeDate.sub(TWO_WEEKS_BN),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");
            expect(
                await staking.getPriorUserStakeByDate(
                    user,
                    stakeDate.add(TWO_WEEKS_BN),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate, stakeBlockNumber - 1)
            ).to.be.bignumber.eq("0");
        });

        it("if blockNumber lies in the past, the function returns the amount of tokens account has staked until date at blockNumber (multiple stakes)", async () => {
            // preparation
            const user = a1;
            await token.transfer(user, "1000");
            await token.approve(staking.address, "1000", { from: user });
            const stakeDate1 = inThreeYears;

            // stake 1st time
            const stakeTx1 = await staking.stake("100", stakeDate1, user, user, { from: user });
            const stakeBlockNumber1 = stakeTx1.receipt.blockNumber;
            await mineBlock();

            // this works as expected
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate1, stakeBlockNumber1)
            ).to.be.bignumber.eq("100");

            // stake 2nd time
            const stakeDate2 = kickoffTS.add(TWO_WEEKS_BN); // this is before stakeDate
            const stakeTx2 = await staking.stake("50", stakeDate2, user, user, { from: user });
            const stakeBlockNumber2 = stakeTx2.receipt.blockNumber; // this is after stakeBlockNumber
            await mineBlock();

            // data from the stakeBlockNumber1 and stakeDate1 is unchanged as expected
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate1, stakeBlockNumber1)
            ).to.be.bignumber.eq("100");

            // stake for stakeDate1 with the new blockNumber is still unchanged
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate1, stakeBlockNumber2)
            ).to.be.bignumber.eq("100");

            // new date and block number only returns that stake
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate2, stakeBlockNumber2)
            ).to.be.bignumber.eq("50");

            // new date and old block number returns nothing, because stakeBlockNumber1 < stakeBlockNumber2
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate2, stakeBlockNumber1)
            ).to.be.bignumber.eq("0");

            // stake 3rd time
            const stakeDate3 = stakeDate1;
            const stakeTx3 = await staking.stake("20", stakeDate3, user, user, { from: user });
            const stakeBlockNumber3 = stakeTx3.receipt.blockNumber;
            await mineBlock();

            // this should show the combined amount because stakeDate3 == stakeDate1
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate3, stakeBlockNumber3)
            ).to.be.bignumber.eq("120");

            // this should still show the old amount
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate3, stakeBlockNumber1)
            ).to.be.bignumber.eq("100");
        });

        it("if blockNumber  >= the current block number, the function reverts", async () => {
            const blockNumber = await web3.eth.getBlockNumber();
            await expectRevert(
                staking.getPriorUserStakeByDate(a1, kickoffTS, blockNumber),
                "not determined"
            );
            await expectRevert(
                staking.getPriorUserStakeByDate(a1, kickoffTS, blockNumber + 1),
                "not determined"
            );
        });

        it("if date is not a valid lock date, the function will return account’s stake at the closest lock date AFTER date", async () => {
            const user = a1;
            await token.transfer(user, "100");
            await token.approve(staking.address, "100", { from: user });
            const stakeDate = inThreeYears;
            const stakeTx = await staking.stake("100", stakeDate, user, user, { from: user });
            const stakeBlockNumber = stakeTx.receipt.blockNumber;
            await mineBlock();

            // sanity check, should work or the next tests are invalid
            expect(
                await staking.getPriorUserStakeByDate(user, stakeDate, stakeBlockNumber)
            ).to.be.bignumber.eq("100");

            // these adjust to stakeDate
            expect(
                await staking.getPriorUserStakeByDate(
                    user,
                    stakeDate.sub(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("100");
            expect(
                await staking.getPriorUserStakeByDate(
                    user,
                    stakeDate.sub(TWO_WEEKS_BN).add(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("100");

            // these adjust to the next lock date after stakeDate
            expect(
                await staking.getPriorUserStakeByDate(
                    user,
                    stakeDate.add(TWO_WEEKS_BN).sub(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");
            expect(
                await staking.getPriorUserStakeByDate(
                    user,
                    stakeDate.add(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");

            // this adjusts to the previous lock date from stakeDate
            expect(
                await staking.getPriorUserStakeByDate(
                    user,
                    stakeDate.sub(TWO_WEEKS_BN).sub(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");
        });

        it("if the msg.sender is no vesting contract, and there is no stake for the passed parameters, the function returns 0", async () => {
            const blockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.getPriorUserStakeByDate(a1, kickoffTS, blockNumber - 1)
            ).to.be.bignumber.eq(new BN(0));
        });

        it("if the msg.sender is a vesting contract and there is no stake for the passed parameters, the function returns 1", async () => {
            const randomContract = await TestToken.new("fake", "fake", 0, 0);
            await staking.addContractCodeHash(randomContract.address);

            const blockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.getPriorUserStakeByDate(a1, kickoffTS, blockNumber - 1, {
                    from: randomContract.address,
                })
            ).to.be.bignumber.eq(new BN(1));
        });
    });

    describe("weightedStakeByDate", () => {
        // TODO: this function only reverts in multiple cases if there's a stake, because the checking is done
        // in internal functions that are not called for zero stakes.
        // *THIS IS NOT ACCORDING TO THE SPEC*
        // but adding those checks would result in marginally higher gas costs and hence I'm not changing it.

        it("if date < startDate, the function reverts", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            const startDate = date.add(TWO_WEEKS_BN);

            // TODO: should not require stake
            const blockNumber = await initializeStake(date, "100");

            await expectRevert(
                staking.weightedStakeByDate(a1, date, startDate, blockNumber),
                "date < startDate"
            );
        });

        it("if date < startDate, but there's nothing staked for the date, the function returns 0", async () => {
            // TODO: this is NOT according to the spec -- according to the spec, it should revert!
            const date = kickoffTS;
            const startDate = date.add(TWO_WEEKS_BN);
            const currentBlockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.weightedStakeByDate(a1, date, startDate, currentBlockNumber - 1)
            ).to.be.bignumber.eq("0");
        });

        it("if date - startDate > max duration, the function reverts", async () => {
            const currentDate = kickoffTS.add(TWO_WEEKS_BN);
            await setNextBlockTimestamp(currentDate.toNumber()); // startDate cannot be before kickoffTS

            // This must not be further away from current time than MAX_DURATION or `stake` will adjust the locked ts
            const date = currentDate.add(MAX_DURATION);

            // more than MAX_DURATION away from currentDate
            const startDate = kickoffTS;

            // TODO: should not require stake
            const blockNumber = await initializeStake(date, "1000");

            await expectRevert(
                staking.weightedStakeByDate(a1, date, startDate, blockNumber),
                "remaining time > max duration"
            );
        });

        it("if blockNumber >= the current block number, the function reverts", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await expectRevert(
                staking.weightedStakeByDate(a1, date, date, currentBlockNumber),
                "not determined"
            );
            await expectRevert(
                staking.weightedStakeByDate(a1, date, date, currentBlockNumber + 1),
                "not determined"
            );
        });

        it("returns the correct weight * stake for account and date (max duration)", async () => {
            const startDate = kickoffTS;
            // NOTE: this must be exactly the max lock date, or else `stake` will adjust the locked ts
            const date = startDate.add(MAX_DURATION);
            const blockNumber = await initializeStake(date, "10000");

            const weightedStake = await staking.weightedStakeByDate(
                a1,
                date,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", date, startDate)
            );
        });

        it("returns the correct weight * stake for account and date (min duration)", async () => {
            const startDate = kickoffTS.add(TWO_WEEKS_BN);
            const date = startDate;
            const blockNumber = await initializeStake(date, "10000");

            const weightedStake = await staking.weightedStakeByDate(
                a1,
                date,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", date, startDate)
            );
        });

        it("returns the correct weight * stake for account and date (middle duration)", async () => {
            const startDate = kickoffTS.add(TWO_WEEKS_BN);
            const date = startDate.add(MAX_DURATION.div(new BN(2)));
            const blockNumber = await initializeStake(date, "10000");

            const weightedStake = await staking.weightedStakeByDate(
                a1,
                date,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", date, startDate)
            );
        });

        it("if date is not a valid lock date, the function will return the weighted stake at the closest lock date BEFORE date", async () => {
            const startDate = kickoffTS.add(TWO_WEEKS_BN);
            const stakeDate = startDate.add(TWO_WEEKS_BN);
            const dateBefore = stakeDate.sub(new BN(1));
            const dateAfter = stakeDate.add(new BN(1));
            const blockNumber = await initializeStake(stakeDate, "10000");

            // sanity check
            let weightedStake = await staking.weightedStakeByDate(
                a1,
                stakeDate,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", stakeDate, startDate)
            );

            // not a valid lock date but after, should get adjusted to the stake date
            weightedStake = await staking.weightedStakeByDate(
                a1,
                dateAfter,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", stakeDate, startDate)
            );

            // date before -> gets adjusted to the previous lock date (with 0 stake)
            weightedStake = await staking.weightedStakeByDate(
                a1,
                dateBefore,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq("0");
        });

        it("if startDate is not a valid lock date, the function will return the weighted stake at the closest lock date BEFORE startDate", async () => {
            const startDate = kickoffTS.add(TWO_WEEKS_BN);
            const stakeDate = startDate.add(TWO_WEEKS_BN);
            const startDateBefore = startDate.sub(new BN(1));
            const startDateAfter = startDate.add(new BN(1));
            const blockNumber = await initializeStake(stakeDate, "10000");

            // sanity check
            let weightedStake = await staking.weightedStakeByDate(
                a1,
                stakeDate,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", stakeDate, startDate)
            );

            // not a valid lock date but after, should get adjusted to the start date
            weightedStake = await staking.weightedStakeByDate(
                a1,
                stakeDate,
                startDateAfter,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", stakeDate, startDate)
            );

            // date before -> gets adjusted to the previous lock date (higher weighted amount)
            weightedStake = await staking.weightedStakeByDate(
                a1,
                stakeDate,
                startDateBefore,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", stakeDate, startDate.sub(TWO_WEEKS_BN))
            );
        });
    });

    describe("getPriorWeightedStake", () => {
        it("returns the total weights stake of account starting from date until the max duration using the checkpoints for blockNumber", async () => {
            const stakeDate1 = kickoffTS.add(TWO_WEEKS_BN);
            const stakeDate2 = stakeDate1.add(TWO_WEEKS_BN);

            const amount1 = new BN("100");
            const amount2 = new BN("50");

            await initializeStake(stakeDate1, "10000", a2); // stake from another user -- should not be visible
            const stakeBlockNumber1 = await initializeStake(stakeDate1, amount1);
            const stakeBlockNumber2 = await initializeStake(stakeDate2, amount2);

            // case 1: from earliest date and up to latest block number: both visible
            let expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1).add(
                getAmountWithWeight(amount2, stakeDate2, stakeDate1)
            );
            let actual = await staking.getPriorWeightedStake(a1, stakeBlockNumber2, stakeDate1);
            expect(actual).to.be.bignumber.eq(expected);

            // case 2: from earliest date and up to earliest block number: only first visible
            expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1);
            actual = await staking.getPriorWeightedStake(a1, stakeBlockNumber1, stakeDate1);
            expect(actual).to.be.bignumber.eq(expected);

            // case 3: from latest date and up to latest block number: only second visible (with less time)
            expected = getAmountWithWeight(amount2, stakeDate2, stakeDate2);
            actual = await staking.getPriorWeightedStake(a1, stakeBlockNumber2, stakeDate2);
            expect(actual).to.be.bignumber.eq(expected);

            // case 4: from latest date and up to earliest block number: none visible
            expected = new BN(0);
            actual = await staking.getPriorWeightedStake(a1, stakeBlockNumber1, stakeDate2);
            expect(actual).to.be.bignumber.eq(expected);

            // case 5: after the lock date after latest date: none visible
            expected = new BN(0);
            actual = await staking.getPriorWeightedStake(
                a1,
                stakeBlockNumber2,
                stakeDate2.add(TWO_WEEKS_BN)
            );
            expect(actual).to.be.bignumber.eq(expected);

            // check checkpoints
            const amount3 = new BN("200");
            const stakeDate3 = stakeDate2; // must be the same
            const stakeBlockNumber3 = await initializeStake(stakeDate3, amount3);

            // case 6: not including latest block number
            expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1).add(
                getAmountWithWeight(amount2, stakeDate2, stakeDate1)
            );
            actual = await staking.getPriorWeightedStake(a1, stakeBlockNumber2, stakeDate1);
            expect(actual).to.be.bignumber.eq(expected);

            // case 7: including latest block number
            expected = expected.add(getAmountWithWeight(amount3, stakeDate3, stakeDate1));
            actual = await staking.getPriorWeightedStake(a1, stakeBlockNumber3, stakeDate1);
            expect(actual).to.be.bignumber.eq(expected);
        });

        it("if blockNumber >= the current block number, the function reverts", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await expectRevert(
                staking.getPriorWeightedStake(a1, currentBlockNumber, date),
                "not determined"
            );
        });

        it("if date is not a valid lock date, the function will return the weighted stake of account at the closest lock date prior to date", async () => {
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const amount = new BN("100");
            const stakeBlockNumber = await initializeStake(stakeDate, amount);

            // sanity check
            const expectedWeightOnLockDate = getAmountWithWeight(amount, stakeDate, stakeDate);
            expect(expectedWeightOnLockDate).to.be.bignumber.gt(new BN(0));
            expect(
                await staking.getPriorWeightedStake(a1, stakeBlockNumber, stakeDate)
            ).to.be.bignumber.eq(expectedWeightOnLockDate);

            // case 1: before stake date -- we get one period of 2 weeks of more weight
            const expectedWeight2WeeksBefore = getAmountWithWeight(
                amount,
                stakeDate,
                stakeDate.sub(TWO_WEEKS_BN)
            );
            const dateBefore = stakeDate.sub(new BN(1)); // this should adjust to the lock date 2 wk before stake
            expect(
                await staking.getPriorWeightedStake(a1, stakeBlockNumber, dateBefore)
            ).to.be.bignumber.eq(expectedWeight2WeeksBefore);

            // case 2: after stake date
            // this should just adjust to lock date
            let dateAfter = stakeDate.add(new BN(1));
            expect(
                await staking.getPriorWeightedStake(a1, stakeBlockNumber, dateAfter)
            ).to.be.bignumber.eq(expectedWeightOnLockDate);

            // case 3: after stake date + 2 weeks + 1 -- should not see the stake any more
            dateAfter = stakeDate.add(TWO_WEEKS_BN).add(new BN(1));
            expect(
                await staking.getPriorWeightedStake(a1, stakeBlockNumber, dateAfter)
            ).to.be.bignumber.eq(new BN(0));
        });

        it("if account has no stakes at date, the function returns 0", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            const firstCheckedBlock = currentBlockNumber - 1;
            const date = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            expect(
                await staking.getPriorWeightedStake(a1, firstCheckedBlock, date)
            ).to.be.bignumber.eq("0");

            const previousDate = date.sub(TWO_WEEKS_BN);
            const secondCheckedBlock = await initializeStake(previousDate, "1000");
            expect(
                await staking.getPriorWeightedStake(a1, secondCheckedBlock, date)
            ).to.be.bignumber.eq("0");
            expect(
                await staking.getPriorWeightedStake(a1, firstCheckedBlock, previousDate)
            ).to.be.bignumber.eq("0");
        });
    });

    describe("getPriorTotalStakesForDate", () => {
        it("if date received multiple stakes at different block numbers from different addresses, the function returns the correct total stake for each block number", async () => {
            // initialize two stakes from two addresses for the same date
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const amount1 = new BN("100");
            const amount2 = new BN("200");
            const stakeBlockNumber1 = await initializeStake(stakeDate, amount1, a1);
            const stakeBlockNumber2 = await initializeStake(stakeDate, amount2, a2);

            await mineBlock();

            expect(
                await staking.getPriorTotalStakesForDate(stakeDate, stakeBlockNumber2)
            ).to.be.bignumber.eq(amount1.add(amount2));
            expect(
                await staking.getPriorTotalStakesForDate(stakeDate, stakeBlockNumber1)
            ).to.be.bignumber.eq(amount1);
        });

        it("if there is at least one stake on a different date, it is not counted towards the total stake of date", async () => {
            // initialize two stakes from two addresses for the same date
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const amount1 = new BN("100");
            const amount2 = new BN("150");
            await initializeStake(stakeDate, amount1, a1);
            await initializeStake(stakeDate, amount2, a2);

            // initialize stakes before and after
            const dateBefore = stakeDate.sub(TWO_WEEKS_BN);
            const amount3 = new BN("400");
            await initializeStake(dateBefore, amount3, a2);
            const dateAfter = stakeDate.add(TWO_WEEKS_BN);
            const amount4 = new BN("300");
            const latestStakeBlockNumber = await initializeStake(dateAfter, amount4, a1);

            await mineBlock();

            // Stakes on dates before and after are not counted in this
            expect(
                await staking.getPriorTotalStakesForDate(stakeDate, latestStakeBlockNumber)
            ).to.be.bignumber.eq(amount1.add(amount2));

            // These work as expected
            expect(
                await staking.getPriorTotalStakesForDate(dateBefore, latestStakeBlockNumber)
            ).to.be.bignumber.eq(amount3);
            expect(
                await staking.getPriorTotalStakesForDate(dateAfter, latestStakeBlockNumber)
            ).to.be.bignumber.eq(amount4);
        });

        it("if date is not a valid lock date, the function will return the total stake at the closest lock date AFTER date", async () => {
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const amount = new BN("100");
            const stakeBlockNumber = await initializeStake(stakeDate, amount);

            // sanity check
            expect(
                await staking.getPriorTotalStakesForDate(stakeDate, stakeBlockNumber)
            ).to.be.bignumber.eq(amount);

            // this should adjust to the lock date which is the stake date
            expect(
                await staking.getPriorTotalStakesForDate(
                    stakeDate.sub(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq(amount);

            // this too
            expect(
                await staking.getPriorTotalStakesForDate(
                    stakeDate.sub(TWO_WEEKS_BN).add(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq(amount);

            // these should adjust to other periods
            expect(
                await staking.getPriorTotalStakesForDate(
                    stakeDate.sub(TWO_WEEKS_BN),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");
            expect(
                await staking.getPriorTotalStakesForDate(
                    stakeDate.add(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");
        });

        it("if there are no stakes at date, the function returns 0", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            const date = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            expect(
                await staking.getPriorTotalStakesForDate(date, currentBlockNumber - 1)
            ).to.be.bignumber.eq("0");
        });

        it("if blockNumber >= the current block number, the function reverts", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await expectRevert(
                staking.getPriorTotalStakesForDate(date, currentBlockNumber),
                "not determined"
            );
        });
    });

    describe("getPriorTotalVotingPower", () => {
        it("if there are stakes at several dates, this function returns the past total voting power at all these dates for time and blockNumber", async () => {
            const stakeDate1 = kickoffTS.add(TWO_WEEKS_BN);
            const stakeDate2 = stakeDate1.add(TWO_WEEKS_BN);

            const amount1 = new BN("100");
            const amount2 = new BN("50");

            // these are from different users because all stakes count towards total voting power
            expect(a1).to.not.be.eq(a2); // sanity check
            const stakeBlockNumber1 = await initializeStake(stakeDate1, amount1, a1);
            const stakeBlockNumber2 = await initializeStake(stakeDate2, amount2, a2);

            // case 1: latest block number, earliest date: both visible
            let expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1).add(
                getAmountWithWeight(amount2, stakeDate2, stakeDate1)
            );
            let actual = await staking.getPriorTotalVotingPower(stakeBlockNumber2, stakeDate1);
            expect(actual).to.be.bignumber.eq(expected);

            // case 2: latest block number, latest date: only the latest visible
            expected = getAmountWithWeight(amount2, stakeDate2, stakeDate2);
            actual = await staking.getPriorTotalVotingPower(stakeBlockNumber2, stakeDate2);
            expect(actual).to.be.bignumber.eq(expected);

            // case 3: earliest block number, earliest date: only the earliest visible
            expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1);
            actual = await staking.getPriorTotalVotingPower(stakeBlockNumber1, stakeDate1);
            expect(actual).to.be.bignumber.eq(expected);

            // case 4: earliest block number, latest date: none visible
            expected = new BN(0);
            actual = await staking.getPriorTotalVotingPower(stakeBlockNumber1, stakeDate2);
            expect(actual).to.be.bignumber.eq(expected);

            // the above cases also test:
            // "if there is at least one stake before time (or the lock date previous of it if it not exactly a lock date),
            // it is not counted towards the total voting power"
        });

        it("if time is not a valid lock date, the function will start calculating the voting power from the closest lock date prior to time", async () => {
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const amount = new BN("100");
            const stakeBlockNumber = await initializeStake(stakeDate, amount);

            // sanity check
            const expectedWeightOnLockDate = getAmountWithWeight(amount, stakeDate, stakeDate);
            expect(expectedWeightOnLockDate).to.be.bignumber.gt(new BN(0));
            expect(
                await staking.getPriorTotalVotingPower(stakeBlockNumber, stakeDate)
            ).to.be.bignumber.eq(expectedWeightOnLockDate);

            // case 1: before stake date -- we get one period of 2 weeks of more weight
            const expectedWeight2WeeksBefore = getAmountWithWeight(
                amount,
                stakeDate,
                stakeDate.sub(TWO_WEEKS_BN)
            );
            const dateBefore = stakeDate.sub(new BN(1)); // this should adjust to the lock date 2 wk before stake
            expect(
                await staking.getPriorTotalVotingPower(stakeBlockNumber, dateBefore)
            ).to.be.bignumber.eq(expectedWeight2WeeksBefore);

            // case 2: after stake date
            // this should just adjust to lock date
            let dateAfter = stakeDate.add(new BN(1));
            expect(
                await staking.getPriorTotalVotingPower(stakeBlockNumber, dateAfter)
            ).to.be.bignumber.eq(expectedWeightOnLockDate);

            // case 3: after stake date + 2 weeks + 1 -- should not see the stake any more
            dateAfter = stakeDate.add(TWO_WEEKS_BN).add(new BN(1));
            expect(
                await staking.getPriorTotalVotingPower(stakeBlockNumber, dateAfter)
            ).to.be.bignumber.eq(new BN(0));
        });

        it("the function reverts if blockNumber >= current block", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            await expectRevert(
                staking.getPriorTotalVotingPower(currentBlockNumber, kickoffTS),
                "not determined"
            );
        });

        it("time may lie in the future", async () => {
            const block = await web3.eth.getBlock("latest");
            const currentTime = new BN(block.timestamp);
            const futureTime = currentTime.add(TWO_WEEKS_BN);
            expect(
                await staking.getPriorTotalVotingPower(block.number - 1, futureTime)
            ).to.be.bignumber.eq(new BN(0));
        });

        it("if there are no stakes at blockNumber or time, the function returns 0", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.getPriorTotalVotingPower(currentBlockNumber - 1, kickoffTS)
            ).to.be.bignumber.eq("0");

            const stakeDate = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const stakeBlockNumber = await initializeStake(stakeDate, "1000");
            expect(
                await staking.getPriorTotalVotingPower(
                    stakeBlockNumber,
                    stakeDate.add(TWO_WEEKS_BN)
                )
            ).to.be.bignumber.eq("0");
            expect(
                await staking.getPriorTotalVotingPower(stakeBlockNumber - 1, kickoffTS)
            ).to.be.bignumber.eq("0");
        });
    });

    describe("getPriorVestingStakeByDate", () => {
        it("if date received multiple stakes at different block numbers from different vesting addresses and non-vesting addresses, the function returns the correct total stake of all vesting addresses at blockNumber", async () => {
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN);

            // these contracts will stake to `stakeDate`
            const vesting1 = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a1,
            });
            const vesting2 = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a2,
            });

            // initialize a non-vesting stake for stakeDate
            const nonVestingStakeBlockNumber = await initializeStake(stakeDate, "1000", a1);

            // it should not be visible
            expect(
                await staking.getPriorVestingStakeByDate(stakeDate, nonVestingStakeBlockNumber)
            ).to.be.bignumber.eq("0");

            // initialize a vesting stake for stakeDate
            const amount1 = new BN("100");
            const stakeBlockNumber1 = await initializeStakeFromVestingContract(
                vesting1,
                amount1,
                a1
            );

            // it should be visible
            expect(
                await staking.getPriorVestingStakeByDate(stakeDate, stakeBlockNumber1)
            ).to.be.bignumber.eq(amount1);

            // it should not be visible querying from an earlier block number
            expect(
                await staking.getPriorVestingStakeByDate(stakeDate, stakeBlockNumber1 - 1)
            ).to.be.bignumber.eq("0");

            // initialize another stake to the same date
            const amount2 = new BN("200");
            const stakeBlockNumber2 = await initializeStakeFromVestingContract(
                vesting2,
                amount2,
                a2
            );

            // both should be visible when querying from the latest block number
            expect(
                await staking.getPriorVestingStakeByDate(stakeDate, stakeBlockNumber2)
            ).to.be.bignumber.eq(amount1.add(amount2));

            // only the first should be visible querying from the earlier block number
            expect(
                await staking.getPriorVestingStakeByDate(stakeDate, stakeBlockNumber1)
            ).to.be.bignumber.eq(amount1);
        });

        it("if there is at least one vesting stake on a different date, it is not counted towards the total vesting stake of date", async () => {
            const stakeDate1 = kickoffTS.add(TWO_WEEKS_BN);
            const vesting1 = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a1,
            });

            const stakeDate2 = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(2)));
            const vesting2 = await deployVestingContract({
                cliff: TWO_WEEKS_BN.mul(new BN(2)),
                duration: TWO_WEEKS_BN.mul(new BN(2)),
                user: a2,
            });

            const amount1 = new BN("100");
            const amount2 = new BN("200");
            await initializeStakeFromVestingContract(vesting1, amount1, a1);
            const checkedBlockNumber = await initializeStakeFromVestingContract(
                vesting2,
                amount2,
                a2
            );

            expect(
                await staking.getPriorVestingStakeByDate(stakeDate1, checkedBlockNumber)
            ).to.be.bignumber.eq(amount1);
            expect(
                await staking.getPriorVestingStakeByDate(stakeDate2, checkedBlockNumber)
            ).to.be.bignumber.eq(amount2);
        });

        it("if date is not a valid lock date, the function will return the total stake at the closest lock date AFTER date", async () => {
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN);
            const vesting = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a1,
            });
            const amount = new BN("100");
            const checkedBlockNumber = await initializeStakeFromVestingContract(
                vesting,
                amount,
                a1
            );

            // sanity check
            expect(
                await staking.getPriorVestingStakeByDate(stakeDate, checkedBlockNumber)
            ).to.be.bignumber.eq(amount);

            // these adjust to the same date
            expect(
                await staking.getPriorVestingStakeByDate(
                    stakeDate.sub(new BN(1)),
                    checkedBlockNumber
                )
            ).to.be.bignumber.eq(amount);
            expect(
                await staking.getPriorVestingStakeByDate(
                    stakeDate.sub(TWO_WEEKS_BN).add(new BN(1)),
                    checkedBlockNumber
                )
            ).to.be.bignumber.eq(amount);

            // these adjust to different lock dates
            expect(
                await staking.getPriorVestingStakeByDate(
                    stakeDate.add(new BN(1)),
                    checkedBlockNumber
                )
            ).to.be.bignumber.eq("0");
            expect(
                await staking.getPriorVestingStakeByDate(
                    stakeDate.sub(TWO_WEEKS_BN),
                    checkedBlockNumber
                )
            ).to.be.bignumber.eq("0");
        });

        it("if there are no vesting stakes at date, the function returns 0", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            const checkedDate = kickoffTS.add(TWO_WEEKS_BN);
            expect(
                await staking.getPriorVestingStakeByDate(checkedDate, currentBlockNumber - 1)
            ).to.be.bignumber.eq("0");

            // initialize a vesting stake to a different date
            // this will initialize the stake to kickoffTS + 4 weeks (different lock date)
            const vesting = await deployVestingContract({
                cliff: TWO_WEEKS_BN.mul(new BN(2)),
                duration: TWO_WEEKS_BN.mul(new BN(2)),
                user: a1,
            });
            const newBlockNumber = await initializeStakeFromVestingContract(
                vesting,
                new BN("100"),
                a1
            );

            // it should not be visible when checking a different date
            expect(
                await staking.getPriorVestingStakeByDate(checkedDate, newBlockNumber)
            ).to.be.bignumber.eq("0");
        });
    });

    describe("weightedVestingStakeByDate", () => {
        it("returns the stake of all vesting contracts at date multiplied with the weight derived from the difference between date and startDate at blockNumber", async () => {
            // deploy vesting contracts
            // cliff of 2 weeks will mean that the stake date will be timestampToLockDate(block.timestamp + 2 weeks),
            // which in practice is 2 weeks after the kickoffTS
            const vesting1 = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a1,
            });

            // This vesting has a cliff of 4 weeks, so the stake date will be 4 weeks after kickoffTS
            // this is in a different lockdate bracket when compared to the first vesting
            const vesting2 = await deployVestingContract({
                cliff: TWO_WEEKS_BN.add(TWO_WEEKS_BN),
                duration: TWO_WEEKS_BN.add(TWO_WEEKS_BN),
                user: a2,
            });

            const amount1 = new BN("100");
            const amount2 = new BN("50");

            const stakeBlockNumber1 = await initializeStakeFromVestingContract(
                vesting1,
                amount1,
                a1
            );
            const stakeBlockNumber2 = await initializeStakeFromVestingContract(
                vesting2,
                amount2,
                a2
            );

            const stakeDate1 = kickoffTS.add(TWO_WEEKS_BN);
            const stakeDate2 = stakeDate1.add(TWO_WEEKS_BN);

            // latest block number, from earliest to latest date: latest visible with correct weight
            let expected = getAmountWithWeight(amount2, stakeDate2, stakeDate1);
            expect(expected).to.be.bignumber.gt("0");
            // NOTE: the first parameter is date (until), the second is startDate, and the last is blockNumber
            let actual = await staking.weightedVestingStakeByDate(
                stakeDate2,
                stakeDate1,
                stakeBlockNumber2
            );
            expect(actual).to.be.bignumber.eq(expected);

            // latest block number, from latest to latest date: latest visible with correct weight
            expected = getAmountWithWeight(amount2, stakeDate2, stakeDate2);
            expect(expected).to.be.bignumber.gt("0");
            actual = await staking.weightedVestingStakeByDate(
                stakeDate2,
                stakeDate2,
                stakeBlockNumber2
            );
            expect(actual).to.be.bignumber.eq(expected);

            // earliest block number, earliest to earliest date: earliest visible with correct weight
            expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1);
            expect(expected).to.be.bignumber.gt("0");
            actual = await staking.weightedVestingStakeByDate(
                stakeDate1,
                stakeDate1,
                stakeBlockNumber1
            );
            expect(actual).to.be.bignumber.eq(expected);
            // latest block number, earliest to earliest date: earliest visible with correct weight
            actual = await staking.weightedVestingStakeByDate(
                stakeDate1,
                stakeDate1,
                stakeBlockNumber2
            );
            expect(actual).to.be.bignumber.eq(expected);

            // latest block number, kickoffTs to earliest date: earliest visible with correct weight
            expected = getAmountWithWeight(amount1, stakeDate1, kickoffTS);
            actual = await staking.weightedVestingStakeByDate(
                stakeDate1,
                kickoffTS,
                stakeBlockNumber2
            );
            expect(actual).to.be.bignumber.eq(expected);
            expect(actual).to.be.bignumber.gt("0");

            // earliest block number, latest to latest date: none visible
            expected = new BN(0);
            actual = await staking.weightedVestingStakeByDate(
                stakeDate2,
                stakeDate2,
                stakeBlockNumber1
            );
            expect(actual).to.be.bignumber.eq(expected);
            // earliest block number, earliest to latest date: none visible
            actual = await staking.weightedVestingStakeByDate(
                stakeDate2,
                stakeDate1,
                stakeBlockNumber1
            );
            expect(actual).to.be.bignumber.eq(expected);

            // add another stake from a vesting contract, same date as vesting1
            const amount3 = new BN("200");
            const vesting3 = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a3,
            });
            const stakeBlockNumber3 = await initializeStakeFromVestingContract(
                vesting3,
                amount3,
                a3
            );

            // test that the stake from it is added to the previous stake for the same date, when using the right blockNumber
            expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1).add(
                getAmountWithWeight(amount3, stakeDate1, stakeDate1)
            );
            actual = await staking.weightedVestingStakeByDate(
                stakeDate1,
                stakeDate1,
                stakeBlockNumber3
            );
            expect(actual).to.be.bignumber.eq(expected);

            // test that it's not visible when using an older blockNumber
            expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1);
            actual = await staking.weightedVestingStakeByDate(
                stakeDate1,
                stakeDate1,
                stakeBlockNumber2
            );
            expect(actual).to.be.bignumber.eq(expected);

            // test that it's not visible when using the later date
            expected = getAmountWithWeight(amount2, stakeDate2, stakeDate1);
            actual = await staking.weightedVestingStakeByDate(
                stakeDate2,
                stakeDate1,
                stakeBlockNumber3
            );
            expect(actual).to.be.bignumber.eq(expected);
        });

        it("it does not count stakes that are not from vesting contracts", async () => {
            // stake to a given date without vesting
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN);
            const firstBlockNumber = await initializeStake(stakeDate, new BN("123"), a1);

            // check that the stake is not visible
            let expected = new BN(0);
            let actual = await staking.weightedVestingStakeByDate(
                stakeDate,
                kickoffTS,
                firstBlockNumber
            );
            expect(actual).to.be.bignumber.eq(expected);

            // deploy a vesting contract and stake from it (to the same date)
            const vesting = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a1,
            });
            const amount = new BN("100");
            const stakeBlockNumber = await initializeStakeFromVestingContract(vesting, amount, a1);

            // test that that stake is visible, but the original stake is not
            expected = getAmountWithWeight(amount, stakeDate, kickoffTS);
            actual = await staking.weightedVestingStakeByDate(
                stakeDate,
                kickoffTS,
                stakeBlockNumber
            );
            expect(actual).to.be.bignumber.eq(expected);
        });

        it("if date is not a valid lock date, the function will return the total stake at the closest lock date BEFORE date", async () => {
            // deploy a vesting contract and initialize a stake from it
            const vesting = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a1,
            });
            const amount = new BN("100");
            const stakeBlockNumber = await initializeStakeFromVestingContract(vesting, amount, a1);

            // sanity check
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN);
            let expected = getAmountWithWeight(amount, stakeDate, kickoffTS);
            let actual = await staking.weightedVestingStakeByDate(
                stakeDate,
                kickoffTS,
                stakeBlockNumber
            );
            expect(actual).to.be.bignumber.eq(expected);

            // these adjust to the same lock date
            actual = await staking.weightedVestingStakeByDate(
                stakeDate.add(new BN("1")),
                kickoffTS,
                stakeBlockNumber
            );
            expect(actual).to.be.bignumber.eq(expected);
            actual = await staking.weightedVestingStakeByDate(
                stakeDate.add(TWO_WEEKS_BN).sub(new BN("1")),
                kickoffTS,
                stakeBlockNumber
            );
            expect(actual).to.be.bignumber.eq(expected);

            // these adjust to previous and next lock date respectively
            expected = new BN("0");
            actual = await staking.weightedVestingStakeByDate(
                stakeDate.sub(new BN("1")),
                kickoffTS,
                stakeBlockNumber
            );
            expect(actual).to.be.bignumber.eq(expected);
            actual = await staking.weightedVestingStakeByDate(
                stakeDate.sub(TWO_WEEKS_BN),
                kickoffTS,
                stakeBlockNumber
            );
            expect(actual).to.be.bignumber.eq(expected);
        });

        it("if there are no vesting stakes at date, the function returns 0", async () => {
            // this is tested more comprehensively in other test functions

            let startDate = kickoffTS;
            let date = startDate.add(TWO_WEEKS_BN);
            let blockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.weightedVestingStakeByDate(date, startDate, blockNumber - 1)
            ).to.be.bignumber.eq("0");
        });
    });

    describe("getPriorVestingWeightedStake", () => {
        it("returns the total weighted stake of vesting contracts at date and blockNumber", async () => {
            // deploy vesting contracts
            // cliff of 2 weeks will mean that the stake date will be timestampToLockDate(block.timestamp + 2 weeks),
            // which in practice is 2 weeks after the kickoffTS
            const vesting1 = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
                user: a1,
            });
            // This vesting has a cliff of 4 weeks, so the stake date will be 4 weeks after kickoffTS
            // this is in a different lockdate bracket when compared to the first vesting
            const vesting2 = await deployVestingContract({
                cliff: TWO_WEEKS_BN.add(TWO_WEEKS_BN),
                duration: TWO_WEEKS_BN.add(TWO_WEEKS_BN),
                user: a2,
            });

            const amount1 = new BN("100");
            const amount2 = new BN("50");

            const stakeBlockNumber1 = await initializeStakeFromVestingContract(
                vesting1,
                amount1,
                a1
            );
            const stakeBlockNumber2 = await initializeStakeFromVestingContract(
                vesting2,
                amount2,
                a2
            );

            const stakeDate1 = kickoffTS.add(TWO_WEEKS_BN);
            const stakeDate2 = stakeDate1.add(TWO_WEEKS_BN);

            // case 1: latest block number, earliest date: both visible
            let expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1).add(
                getAmountWithWeight(amount2, stakeDate2, stakeDate1)
            );
            let actual = await staking.getPriorVestingWeightedStake(stakeBlockNumber2, stakeDate1);
            expect(actual).to.be.bignumber.eq(expected);
            expect(actual).to.be.bignumber.gt("0");

            // case 2: latest block number, latest date: only the latest visible
            expected = getAmountWithWeight(amount2, stakeDate2, stakeDate2);
            actual = await staking.getPriorVestingWeightedStake(stakeBlockNumber2, stakeDate2);
            expect(actual).to.be.bignumber.eq(expected);
            expect(actual).to.be.bignumber.gt("0");

            // case 3: earliest block number, earliest date: only the earliest visible
            expected = getAmountWithWeight(amount1, stakeDate1, stakeDate1);
            actual = await staking.getPriorVestingWeightedStake(stakeBlockNumber1, stakeDate1);
            expect(actual).to.be.bignumber.eq(expected);
            expect(actual).to.be.bignumber.gt("0");

            // case 4: earliest block number, latest date: none visible
            expected = new BN(0);
            actual = await staking.getPriorVestingWeightedStake(stakeBlockNumber1, stakeDate2);
            expect(actual).to.be.bignumber.eq(expected);
        });

        it("non-vesting stakes are not counted towards the total", async () => {
            // initialize a non-vesting stake
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN);
            const amount1 = new BN("100");
            const stakeBlockNumber1 = await initializeStake(stakeDate, amount1);

            // verify that the stake is not part of the total
            expect(
                await staking.getPriorVestingWeightedStake(stakeBlockNumber1, stakeDate)
            ).to.be.bignumber.eq("0");

            // stake from a vesting contract
            // cliff of 2 weeks will mean that the stake date will be timestampToLockDate(block.timestamp + 2 weeks),
            // so staking from this should have the same stake date
            const amount2 = new BN("50");
            const vesting = await deployVestingContract({
                cliff: TWO_WEEKS_BN,
                duration: TWO_WEEKS_BN,
            });
            const stakeBlockNumber2 = await initializeStakeFromVestingContract(vesting, amount2);

            // this stake is counted as part of the total, but the non-vesting stake is not
            let expected = getAmountWithWeight(amount2, stakeDate, stakeDate);
            let actual = await staking.getPriorVestingWeightedStake(stakeBlockNumber2, stakeDate);
            expect(actual).to.be.bignumber.eq(expected);
            expect(actual).to.be.bignumber.gt("0");

            // the above cases also test:
            // "if there is at least one vesting stake before date (or the lock date previous of it if it not exactly a
            // lock date), it is not counted towards the total"
        });

        it("if date is not a valid lock date, the function will start calculating the voting power from the closest lock date prior to date", async () => {
            // deploy and stake from a single vesting contract
            const cliff = TWO_WEEKS_BN.mul(new BN(2));
            const vesting = await deployVestingContract({
                cliff,
                duration: cliff,
            });
            const amount = new BN("100");
            const stakeBlockNumber = await initializeStakeFromVestingContract(vesting, amount);
            const stakeDate = kickoffTS.add(cliff);

            // sanity check
            expect(
                await staking.getPriorVestingWeightedStake(stakeBlockNumber, stakeDate)
            ).to.be.bignumber.equal(getAmountWithWeight(amount, stakeDate, stakeDate));

            // these should adjust to the same lock date
            expect(
                await staking.getPriorVestingWeightedStake(
                    stakeBlockNumber,
                    stakeDate.add(new BN(1))
                )
            ).to.be.bignumber.equal(getAmountWithWeight(amount, stakeDate, stakeDate));
            expect(
                await staking.getPriorVestingWeightedStake(
                    stakeBlockNumber,
                    stakeDate.add(TWO_WEEKS_BN).sub(new BN(1))
                )
            ).to.be.bignumber.equal(getAmountWithWeight(amount, stakeDate, stakeDate));

            // these should adjust to the previous lock date
            expect(
                await staking.getPriorVestingWeightedStake(
                    stakeBlockNumber,
                    stakeDate.sub(new BN(1))
                )
            ).to.be.bignumber.equal(
                getAmountWithWeight(amount, stakeDate, stakeDate.sub(TWO_WEEKS_BN))
            );
            expect(
                await staking.getPriorVestingWeightedStake(
                    stakeBlockNumber,
                    stakeDate.sub(TWO_WEEKS_BN).add(new BN(1))
                )
            ).to.be.bignumber.equal(
                getAmountWithWeight(amount, stakeDate, stakeDate.sub(TWO_WEEKS_BN))
            );

            // this should be the next lock date, e.g. no stake visible
            expect(
                await staking.getPriorVestingWeightedStake(
                    stakeBlockNumber,
                    stakeDate.add(TWO_WEEKS_BN)
                )
            ).to.be.bignumber.equal("0");

            // this should adjust to the lock date before the previous one
            expect(
                await staking.getPriorVestingWeightedStake(
                    stakeBlockNumber,
                    stakeDate.sub(TWO_WEEKS_BN).sub(new BN(1))
                )
            ).to.be.bignumber.equal(
                getAmountWithWeight(
                    amount,
                    stakeDate,
                    stakeDate.sub(TWO_WEEKS_BN).sub(TWO_WEEKS_BN)
                )
            );
        });

        it("the function reverts if blockNumber >= current block", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            await expectRevert(
                staking.getPriorVestingWeightedStake(currentBlockNumber, kickoffTS),
                "not determined"
            );
            await expectRevert(
                staking.getPriorVestingWeightedStake(currentBlockNumber + 1, kickoffTS),
                "not determined"
            );
        });

        it("date may lie in the future", async () => {
            const block = await web3.eth.getBlock("latest");
            const currentTime = new BN(block.timestamp);
            const futureTime = currentTime.add(TWO_WEEKS_BN);
            expect(
                await staking.getPriorVestingWeightedStake(block.number - 1, futureTime)
            ).to.be.bignumber.eq(new BN(0));
        });

        it("if there are no vesting stakes at blockNumber or date, the function returns 0", async () => {
            // this is tested more in detail in the above cases
            const currentBlockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.getPriorVestingWeightedStake(currentBlockNumber - 1, kickoffTS)
            ).to.be.bignumber.eq("0");
        });
    });

    describe("getPriorStakeByDateForDelegatee", () => {
        it("returns how much stake is delegated to account at date and blockNumber (delegated by oneself and others)", async () => {
            const amount1 = new BN("100");
            const amount2 = new BN("200");

            const stakeDate = kickoffTS.add(TWO_WEEKS_BN);
            const stakeBlockNumber1 = await initializeStake(stakeDate, amount1, a1);
            const stakeBlockNumber2 = await initializeStake(stakeDate, amount2, a2);

            // quick check before any delegation
            expect(
                await staking.getPriorStakeByDateForDelegatee(a1, stakeDate, stakeBlockNumber1)
            ).to.be.bignumber.eq(amount1);

            // delegate stake of a2 to a1
            await staking.delegate(a1, stakeDate, { from: a2 });
            const delegatedBlockNumber = await web3.eth.getBlockNumber();
            await mineBlock(); // it will revert on blockNumber >= current

            // check self-delegates with accounts (blockNumber < delegatedBlockNumber)
            expect(
                await staking.getPriorStakeByDateForDelegatee(a1, stakeDate, stakeBlockNumber1)
            ).to.be.bignumber.eq(amount1);
            expect(
                await staking.getPriorStakeByDateForDelegatee(a1, stakeDate, stakeBlockNumber2)
            ).to.be.bignumber.eq(amount1);
            expect(
                await staking.getPriorStakeByDateForDelegatee(a2, stakeDate, stakeBlockNumber2)
            ).to.be.bignumber.eq(amount2);
            expect(
                await staking.getPriorStakeByDateForDelegatee(a2, stakeDate, stakeBlockNumber1)
            ).to.be.bignumber.eq("0");

            // check state after delegation
            expect(
                await staking.getPriorStakeByDateForDelegatee(a1, stakeDate, delegatedBlockNumber)
            ).to.be.bignumber.eq(amount1.add(amount2));
            expect(
                await staking.getPriorStakeByDateForDelegatee(a2, stakeDate, delegatedBlockNumber)
            ).to.be.bignumber.eq("0");
        });

        it("if date is not a valid lock date, the function will return the delegated stakes for account at the closest lock date AFTER date", async () => {
            // initialize a single stake
            const stakeDate = kickoffTS.add(TWO_WEEKS_BN);
            const stakeBlockNumber = await initializeStake(stakeDate, new BN("100"), a1);

            // sanity check
            expect(
                await staking.getPriorStakeByDateForDelegatee(a1, stakeDate, stakeBlockNumber)
            ).to.be.bignumber.eq("100");

            // these adjust to the same date
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    a1,
                    stakeDate.sub(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("100");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    a1,
                    stakeDate.sub(TWO_WEEKS_BN).add(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("100");

            // these adjust to other dates
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    a1,
                    stakeDate.sub(TWO_WEEKS_BN),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    a1,
                    stakeDate.add(new BN(1)),
                    stakeBlockNumber
                )
            ).to.be.bignumber.eq("0");
        });

        it("if no one delegated to account at date and blockNumber, the function returns 0", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            const actual = await staking.getPriorStakeByDateForDelegatee(
                a1,
                kickoffTS.add(TWO_WEEKS_BN),
                currentBlockNumber - 1
            );
            expect(actual).to.be.bignumber.eq("0");

            // this is also tested in the other test cases
        });

        it("the function reverts if blockNumber >= current block", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            await expectRevert(
                staking.getPriorStakeByDateForDelegatee(
                    a1,
                    kickoffTS.add(TWO_WEEKS_BN),
                    currentBlockNumber
                ),
                "not determined yet"
            );
            await expectRevert(
                staking.getPriorStakeByDateForDelegatee(
                    a1,
                    kickoffTS.add(TWO_WEEKS_BN),
                    currentBlockNumber + 1
                ),
                "not determined yet"
            );
        });
    });

    describe("balanceOf", () => {
        it("returns the total staked balance of account from the kickoff date until now + max duration", async () => {
            expect((await staking.balanceOf(a1)).toString()).to.be.bignumber.equal("0");

            let date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);
            expect((await staking.balanceOf(a1)).toString()).to.be.bignumber.equal("100");

            date = date.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("50"), a1);
            expect((await staking.balanceOf(a1)).toString()).to.be.bignumber.equal("150");

            date = date.add(new BN(1));
            await initializeStake(date, new BN("25"), a1);
            expect((await staking.balanceOf(a1)).toString()).to.be.bignumber.equal("175");

            // test another user
            expect((await staking.balanceOf(a2)).toString()).to.be.bignumber.equal("0");

            await initializeStake(date, new BN("123"), a2);
            expect((await staking.balanceOf(a2)).toString()).to.be.bignumber.equal("123");
            expect((await staking.balanceOf(a1)).toString()).to.be.bignumber.equal("175");

            // staking before kickoff date or after now + max duration is not possible, so those edge cases are
            // not tested here
        });

        it("if account does not have any stake, 0 is returned", async () => {
            expect((await staking.balanceOf(a1)).toString()).to.be.bignumber.equal("0");
        });
    });

    describe("getStakes", () => {
        const toString = (x) => x.toString();

        it("returns an array of lock dates and staking amounts for each lock date with a stake > 0 for account from the kickoff date until now + max duration", async () => {
            const date1 = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date1, new BN("100"), a1);

            let result = await staking.getStakes(a1);
            expect(result.dates.map(toString)).to.deep.equal([date1.toString()]);
            expect(result.stakes.map(toString)).to.deep.equal(["100"]);
            // test that the order is dates, stakes
            expect(result[0].map(toString)).to.deep.equal([date1.toString()]);
            expect(result[1].map(toString)).to.deep.equal(["100"]);

            // this should increase the amount of previous stake instead of showing up as a new stake
            await initializeStake(date1, new BN("50"), a1);

            result = await staking.getStakes(a1);
            expect(result.dates.map(toString)).to.deep.equal([date1.toString()]);
            expect(result.stakes.map(toString)).to.deep.equal(["150"]);

            // this adds a new stake
            const date2 = date1.add(TWO_WEEKS_BN.mul(new BN(2)));
            await initializeStake(date2, new BN("25"), a1);

            result = await staking.getStakes(a1);
            expect(result.dates.map(toString)).to.deep.equal([date1.toString(), date2.toString()]);
            expect(result.stakes.map(toString)).to.deep.equal(["150", "25"]);

            // this adds a new stake in between date1 and date2
            const date3 = date1.add(TWO_WEEKS_BN);
            await initializeStake(date3, new BN("123"), a1);

            result = await staking.getStakes(a1);
            expect(result.dates.map(toString)).to.deep.equal([
                date1.toString(),
                date3.toString(),
                date2.toString(),
            ]);
            expect(result.stakes.map(toString)).to.deep.equal(["150", "123", "25"]);

            // test another user
            await initializeStake(date3, new BN("456"), a2);

            // old result still intact
            result = await staking.getStakes(a1);
            expect(result.dates.map(toString)).to.deep.equal([
                date1.toString(),
                date3.toString(),
                date2.toString(),
            ]);
            expect(result.stakes.map(toString)).to.deep.equal(["150", "123", "25"]);

            // stakes correctly returned for another user
            result = await staking.getStakes(a2);
            expect(result.dates.map(toString)).to.deep.equal([date3.toString()]);
            expect(result.stakes.map(toString)).to.deep.equal(["456"]);
        });

        it("if account does not have any stake, empty arrays are returned", async () => {
            const result = await staking.getStakes(a1);
            expect(result.dates).to.be.empty;
            expect(result.stakes).to.be.empty;
        });
    });

    describe("getCurrentVotes", () => {
        it("returns the current voting power of account", async () => {
            expect(await staking.getCurrentVotes(a1)).to.be.bignumber.equal("0");

            const stakeDate1 = kickoffTS.add(TWO_WEEKS_BN);
            const amount1 = new BN("1000");
            await initializeStake(stakeDate1, amount1, a1);

            // block.timestamp will be rounded to kickoffTS, so the stake will "be there" for 2 weeks
            let expected = getAmountWithWeight(amount1, stakeDate1, kickoffTS);
            expect(await staking.getCurrentVotes(a1)).to.be.bignumber.equal(expected);

            // stake for another user, doesn't affect the calculation
            await initializeStake(stakeDate1, new BN("123"), a2);
            expect(await staking.getCurrentVotes(a1)).to.be.bignumber.equal(expected);

            // stake another time, it should be visible in the calculation
            const stakeDate2 = stakeDate1.add(TWO_WEEKS_BN);
            const amount2 = new BN("50");
            await initializeStake(stakeDate2, amount2, a1);

            expected = getAmountWithWeight(amount1, stakeDate1, kickoffTS).add(
                getAmountWithWeight(amount2, stakeDate2, kickoffTS)
            );
            expect(await staking.getCurrentVotes(a1)).to.be.bignumber.equal(expected);
        });

        it("if account does not have any stake, 0 is returned", async () => {
            expect(await staking.getCurrentVotes(a1)).to.be.bignumber.equal("0");
        });

        it("if account does not have any locked stake, 0 is returned (even if he has unlocked state)", async () => {
            // sanity check 1
            expect(await staking.getCurrentVotes(a1)).to.be.bignumber.equal("0");

            const stakeDate1 = kickoffTS.add(TWO_WEEKS_BN);
            const amount1 = new BN("1000");
            await initializeStake(stakeDate1, amount1, a1);

            // sanity check 2
            expect(await staking.getCurrentVotes(a1)).to.be.bignumber.equal(
                getAmountWithWeight(amount1, stakeDate1, kickoffTS)
            );

            // unlock the stake by traveling to the next lock date after the staked date
            await setNextBlockTimestamp(stakeDate1.add(TWO_WEEKS_BN).toNumber());
            await mineBlock();
            expect(await staking.getCurrentVotes(a1)).to.be.bignumber.equal("0");
        });
    });

    describe("getCurrentStakedUntil", () => {
        it("returns the current total stake for lockedTS", async () => {
            const date1 = kickoffTS.add(TWO_WEEKS_BN);
            expect(await staking.getCurrentStakedUntil(date1)).to.be.bignumber.equal("0");

            const date2 = date1.add(TWO_WEEKS_BN);
            const date3 = date2.add(TWO_WEEKS_BN);

            await initializeStake(date1, new BN("100"), a1);
            await initializeStake(date1, new BN("20"), a1);
            await initializeStake(date1, new BN("75"), a2);

            await initializeStake(date2, new BN("123"), a1);
            await initializeStake(date2, new BN("456"), a2);

            expect(await staking.getCurrentStakedUntil(date1)).to.be.bignumber.equal("195");
            expect(await staking.getCurrentStakedUntil(date2)).to.be.bignumber.equal("579");
            expect(await staking.getCurrentStakedUntil(date3)).to.be.bignumber.equal("0");
        });

        it("if lockedTS is not a valid lock date, 0 is returned", async () => {
            const date1 = kickoffTS.add(TWO_WEEKS_BN);
            const date2 = date1.add(TWO_WEEKS_BN);
            await initializeStake(date1, new BN("100"), a1);
            await initializeStake(date2, new BN("200"), a1);

            // sanity checks
            expect(await staking.getCurrentStakedUntil(date1)).to.be.bignumber.equal("100");
            expect(await staking.getCurrentStakedUntil(date2)).to.be.bignumber.equal("200");

            // invalid dates
            expect(
                await staking.getCurrentStakedUntil(date1.sub(new BN(1)))
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getCurrentStakedUntil(date1.add(new BN(1)))
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getCurrentStakedUntil(date2.sub(new BN(1)))
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getCurrentStakedUntil(date2.add(new BN(1)))
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getCurrentStakedUntil(date1.add(TWO_WEEKS_BN).sub(new BN(1)))
            ).to.be.bignumber.equal("0");
        });
    });

    describe("getWithdrawAmounts", () => {
        it("the function reverts if amount is 0", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await expectRevert(
                staking.getWithdrawAmounts(0, date),
                "Amount of tokens to withdraw must be > 0"
            );
        });

        it("the function reverts if amount is higher than the msg.sender's staked balance for until", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);
            await expectRevert(
                staking.getWithdrawAmounts(new BN("101"), date, {
                    from: a1,
                }),
                "Staking::withdraw: not enough balance"
            );
        });

        it("if until is not a valid lock date, the lock date NEXT to until is used for both the withdrawable amount and punishment", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);

            // rounds to the current lock date -> should work
            const result = await staking.getWithdrawAmounts(new BN("100"), date.sub(new BN(1)), {
                from: a1,
            });
            expect(result).to.not.be.empty;

            // rounds to the next lock date -> no stake available -> revert
            await expectRevert(
                staking.getWithdrawAmounts(new BN("100"), date.add(new BN(1)), { from: a1 }),
                "Staking::withdraw: not enough balance"
            );
        });

        it("if until lies in the past, the function will revert", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);

            // travel to the next lock date
            await setNextBlockTimestamp(date.add(TWO_WEEKS_BN).toNumber());
            await mineBlock();

            await expectRevert(
                staking.getWithdrawAmounts(new BN("100"), date, { from: a1 }),
                "date < startDate"
            );
        });

        it("if until lies in the future, the function returns how many tokens the user receives if unstaking amount considering the penalty for early unstaking, and returns the withdrawable amount and the penalty", async () => {
            const weightScaling = await staking.weightScaling();

            let date = kickoffTS.add(TWO_WEEKS_BN);
            let amount = new BN("100");
            await initializeStake(date, amount, a1);

            let weight = getWeight(date, kickoffTS);
            let expectedPunishedAmount = amount
                .mul(weight)
                .mul(weightScaling)
                .div(WEIGHT_FACTOR)
                .div(new BN("100"));
            let result = await staking.getWithdrawAmounts(amount, date, { from: a1 });
            expect(result[0]).to.be.bignumber.equal(amount.sub(expectedPunishedAmount));
            expect(result[1]).to.be.bignumber.equal(expectedPunishedAmount);

            date = kickoffTS.add(TWO_WEEKS_BN.mul(new BN(3)));
            amount = new BN("13371337");
            await initializeStake(date, amount, a2);

            weight = getWeight(date, kickoffTS);
            expectedPunishedAmount = amount
                .mul(weight)
                .mul(weightScaling)
                .div(WEIGHT_FACTOR)
                .div(new BN("100"));
            result = await staking.getWithdrawAmounts(amount, date, { from: a2 });
            expect(result[0]).to.be.bignumber.equal(amount.sub(expectedPunishedAmount));
            expect(result[1]).to.be.bignumber.equal(expectedPunishedAmount);
        });

        it("if until is not a valid lock date, but the next valid lock date lies in the future, the function returns the withdrawable amount and penalty correctly, adjusting until to the next valid lock date", async () => {
            const weightScaling = await staking.weightScaling();

            let date = kickoffTS.add(TWO_WEEKS_BN); // date will adjust to this
            let amount = new BN("1234567890");
            await initializeStake(date, amount, a1);

            let weight = getWeight(date, kickoffTS);
            let expectedPunishedAmount = amount
                .mul(weight)
                .mul(weightScaling)
                .div(WEIGHT_FACTOR)
                .div(new BN("100"));

            let until = kickoffTS.add(new BN(100)); // this is in the past, but it's also not a valid lock date
            await setNextBlockTimestamp(until.toNumber() + 100);
            await mineBlock();

            let result = await staking.getWithdrawAmounts(amount, until, { from: a1 });
            expect(result[0]).to.be.bignumber.equal(amount.sub(expectedPunishedAmount));
            expect(result[1]).to.be.bignumber.equal(expectedPunishedAmount);
        });

        it("if until lies in the future, the withdrawable amount must be < amount and the penalty > 0", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);
            const result = await staking.getWithdrawAmounts(new BN("100"), date, { from: a1 });
            const [withdrawable, penalty] = [result[0], result[1]];
            expect(withdrawable).to.be.bignumber.lt(new BN("100"));
            expect(penalty).to.be.bignumber.gt(new BN("0"));
        });
    });

    describe("delegate", () => {
        const stakeAmount = new BN("12345");
        let stakeDate;
        let stakeBlockNumber;
        let delegator;
        let delegatee;

        beforeEach(async () => {
            stakeDate = kickoffTS.add(TWO_WEEKS_BN);
            delegator = a1;
            delegatee = a2;
            stakeBlockNumber = await initializeStake(stakeDate, stakeAmount, delegator);
        });

        it("the function reverts if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await expectRevert(
                staking.delegate(delegatee, stakeDate, { from: delegator }),
                "paused"
            );
        });

        it("the function reverts if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(
                staking.delegate(delegatee, stakeDate, { from: delegator }),
                "paused"
            );
        });

        it("the function reverts if the stake of msg.sender at until was modified on the same block", async () => {
            // Could not figure out how to mine two transactions in the same block without a custom contract...
            const stakingTester = await StakingTester.new(staking.address, token.address);
            await expectRevert(
                stakingTester.stakeAndDelegate(
                    new BN("100"),
                    delegatee,
                    kickoffTS.add(TWO_WEEKS_BN)
                ),
                "cannot be mined in the same block as last stake"
            );
        });

        it("the function reverts if the sender has no stake at lockDate (this includes the cases where lockDate is not a valid lock date", async () => {
            await expectRevert(
                staking.delegate(delegatee, stakeDate.add(TWO_WEEKS_BN), { from: delegator }),
                "no stake to delegate"
            );
            await expectRevert(
                staking.delegate(delegatee, stakeDate.sub(new BN(1)), { from: delegator }),
                "no stake to delegate"
            );
        });

        it("the function reverts if delegatee is the same as the existing delegatee for lockDate", async () => {
            await expectRevert(
                staking.delegate(delegator, stakeDate, { from: delegator }),
                "cannot delegate to the existing delegatee"
            );

            await staking.delegate(delegatee, stakeDate, { from: delegator });
            await expectRevert(
                staking.delegate(delegatee, stakeDate, { from: delegator }),
                "cannot delegate to the existing delegatee"
            );
        });

        it("the function reverts if delegatee is the 0 address", async () => {
            await expectRevert(
                staking.delegate(address(0), stakeDate, { from: delegator }),
                "cannot delegate to the zero address"
            );
        });

        it("after function execution, getPriorStakeByDateForDelegatee is reduced by the sender’s stake at lockDate for the sender’s old delegate at lockDate.", async () => {
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegator,
                    stakeDate,
                    stakeBlockNumber
                )
            ).to.be.bignumber.equal(stakeAmount);
            await staking.delegate(delegatee, stakeDate, { from: delegator });
            const blockNumberAfterDelegation = await web3.eth.getBlockNumber();
            await mineBlock(); // block must be finalized
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegator,
                    stakeDate,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("0");
        });

        it("after function execution, getPriorStakeByDateForDelegatee is increased by the sender’s stake at lockDate for the sender’s new delegate at lockDate.", async () => {
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    stakeDate,
                    stakeBlockNumber
                )
            ).to.be.bignumber.equal("0");
            await staking.delegate(delegatee, stakeDate, { from: delegator });
            const blockNumberAfterDelegation = await web3.eth.getBlockNumber();
            await mineBlock(); // block must be finalized
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    stakeDate,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal(stakeAmount);
        });

        it("if the sender is a vesting contract, not only the stake for lockDate is delegated, but also the stake for the next lock date if the next lock date after until lies in the past", async () => {
            const date1 = kickoffTS.add(TWO_WEEKS_BN);
            const date2 = date1.add(TWO_WEEKS_BN);
            const date3 = date2.add(TWO_WEEKS_BN);

            // NOTE: this is needed or feeSharingCollector throws a fit ("Invalid totalWeightedStake") because
            // totalWeightedStake is 0
            // also we must use an account that's neither delegator or delegatee, so a3 it is
            await initializeStake(date1, new BN("1"), a3);

            const account = await deployAndImpersonateVestingContract();
            await initializeStake(date1, new BN("100"), account);
            await initializeStake(date2, new BN("50"), account);
            const blockNumberBeforeDelegation = await initializeStake(
                date3,
                new BN("25"),
                account
            );

            // sanity check
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    account,
                    date1,
                    blockNumberBeforeDelegation
                )
            ).to.be.bignumber.equal("100");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    account,
                    date2,
                    blockNumberBeforeDelegation
                )
            ).to.be.bignumber.equal("50");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    account,
                    date3,
                    blockNumberBeforeDelegation
                )
            ).to.be.bignumber.equal("25");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    date1,
                    blockNumberBeforeDelegation
                )
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    date2,
                    blockNumberBeforeDelegation
                )
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    date3,
                    blockNumberBeforeDelegation
                )
            ).to.be.bignumber.equal("0");

            // travel to the future, all dates are in the past
            // NOTE: this actually doesn't matter -- it always delegates both stakes
            await setNextBlockTimestamp(date3.add(TWO_WEEKS_BN).toNumber());

            // delegate until date1, should also delegate date2 but not date3
            await staking.delegate(delegatee, date1, { from: account });

            let blockNumberAfterDelegation = await web3.eth.getBlockNumber();
            await mineBlock(); // block must be finalized

            // expect first two stakes to be delegated
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    account,
                    date1,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    account,
                    date2,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    date1,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("100");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    date2,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("50");
            // last stake should not be delegated
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    account,
                    date3,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("25");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    date3,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("0");

            // clean up just for good measure (not necessary, it doesn't matter if the test fails and we don't get here)
            await stopImpersonatingAccount(account);
        });

        it("delegating from a vesting contract works even if there is no stake at the next lock date", async () => {
            // This is needed to make sure our changes regarding delegating zero balance do not mess it up for
            // vesting contracts
            const date1 = kickoffTS.add(TWO_WEEKS_BN);

            await initializeStake(date1, new BN("1"), a3); // required for feeSharingCollector

            const account = await deployAndImpersonateVestingContract();
            const blockNumberBeforeDelegation = await initializeStake(
                date1,
                new BN("100"),
                account
            );

            // sanity check
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    account,
                    date1,
                    blockNumberBeforeDelegation
                )
            ).to.be.bignumber.equal("100");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    date1,
                    blockNumberBeforeDelegation
                )
            ).to.be.bignumber.equal("0");

            // travel to the future, date is in the past
            await setNextBlockTimestamp(date1.add(TWO_WEEKS_BN).toNumber());

            // delegate until date1, should work even if there is no other stake 2 weeks after it
            await staking.delegate(delegatee, date1, { from: account });
            await stopImpersonatingAccount(account);

            const blockNumberAfterDelegation = await web3.eth.getBlockNumber();
            await mineBlock(); // block must be finalized

            // expect the stake to e delegated
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    account,
                    date1,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("0");
            expect(
                await staking.getPriorStakeByDateForDelegatee(
                    delegatee,
                    date1,
                    blockNumberAfterDelegation
                )
            ).to.be.bignumber.equal("100");
        });
    });

    describe("migrateToNewStakingContract", () => {
        it("the function reverts if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.migrateToNewStakingContract(), "paused");
        });

        it("reverts if the new staking contract has not been set yet", async () => {
            await expectRevert(
                staking.migrateToNewStakingContract(),
                "there is no new staking contract set"
            );
        });

        it("does nothing", async () => {
            await staking.setNewStakingContract(address(1337));
            await expectRevert(staking.migrateToNewStakingContract(), "not implemented");
        });

        it("the function is executable if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.setNewStakingContract(address(1337));
            await expectRevert(staking.migrateToNewStakingContract(), "not implemented");
        });
    });

    describe("unlockAllTokens", () => {
        it("the function reverts if the sender is not the owner", async () => {
            await expectRevert(staking.unlockAllTokens({ from: a1 }), "unauthorized");
        });

        it("the function reverts if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.unlockAllTokens(), "paused");
        });

        it("the function is executable if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.unlockAllTokens();
        });

        it("after function execution, reading allUnlocked from the contract returns true", async () => {
            expect(await staking.allUnlocked()).to.be.false;
            await staking.unlockAllTokens();
            expect(await staking.allUnlocked()).to.be.true;
        });

        it("emits the right event", async () => {
            await token.mint(staking.address, new BN("100"));
            const balance = await token.balanceOf(staking.address);
            expect(balance).to.be.bignumber.gt("0");
            expect(await staking.unlockAllTokens())
                .to.emit(staking, "TokensUnlocked")
                .withArgs(balance);
        });
    });

    describe("withdraw", () => {
        it("the function reverts if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);

            expect(staking.withdraw(new BN("100"), kickoffTS.add(TWO_WEEKS_BN), a1), "paused");
        });

        it("the function is executable if the contract is paused", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);

            await staking.pauseUnpause(true);
            await staking.withdraw(new BN("1"), date, a1, { from: a1 });
        });

        it("the function reverts if the senders stake at until was modified on the same block", async () => {
            // Could not figure out how to mine two transactions in the same block without a custom contract...
            const stakingTester = await StakingTester.new(staking.address, token.address);
            await expectRevert(
                stakingTester.stakeAndWithdraw(new BN("100"), kickoffTS.add(TWO_WEEKS_BN)),
                "cannot be mined in the same block as last stake"
            );
        });

        it("the function reverts if amount is 0", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await expectRevert(
                staking.withdraw(new BN("0"), date, a1),
                "Amount of tokens to withdraw must be > 0"
            );
        });

        it("if until is not a valid lock date, the lock date AFTER until is used", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);

            await expectRevert(
                staking.withdraw(new BN("100"), date.add(new BN("1")), a1, { from: a1 }),
                "Staking::withdraw: not enough balance"
            );

            await staking.withdraw(new BN("100"), date.sub(new BN("1")), a1, { from: a1 });
            expect(await token.balanceOf(a1)).to.be.bignumber.gt("0");
        });

        it("the function reverts if amount exceeds the sender’s staked balance at (adjusted) until", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);

            await expectRevert(
                staking.withdraw(new BN("101"), date.add(new BN("1")), a1, { from: a1 }),
                "Staking::withdraw: not enough balance"
            );
        });

        it("if (adjusted) until lies in the past, the complete amount is withdrawn to receiver", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);
            expect(await token.balanceOf(a1)).to.be.bignumber.equal("0");
            await setNextBlockTimestamp(date.add(TWO_WEEKS_BN).toNumber());
            await staking.withdraw(new BN("100"), date, a1, { from: a1 });
            expect(await token.balanceOf(a1)).to.be.bignumber.equal("100");
        });

        it("if (adjusted) until lies in the future and the sender is not the governance and unlockAllTokens has never been called, a reduced amount is withdrawn to receiver. the amount is to be expected to be the same as returned by getWithdrawAmounts", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);
            expect(await token.balanceOf(a1)).to.be.bignumber.equal("0");

            const result = await staking.getWithdrawAmounts(new BN("100"), date, { from: a1 });
            const withdrawable = result[0];
            expect(withdrawable).to.be.bignumber.lt("100");

            await staking.withdraw(new BN("100"), date, a1, { from: a1 });
            expect(await token.balanceOf(a1)).to.be.bignumber.equal(withdrawable);
        });

        //it("if (adjusted) until lies in the future and the sender is governance, the full amount is withdrawn without slashing", async () => {
        // NOTE: this is not implemented as withdraw() cannot be used for governance withdrawals,
        // and the governanceWithdraw function is deprecated
        //});

        it("if (adjusted) until lies in the future and all tokens were unlocked, the full amount is withdrawn without slashing", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            const account = a1;
            const stakeAmount = new BN("100");

            await initializeStake(date, stakeAmount, account);
            const balanceBefore = await token.balanceOf(account);

            await staking.unlockAllTokens();
            const result = await staking.getWithdrawAmounts(stakeAmount, date, { from: account });
            const withdrawable = result[0];
            expect(withdrawable).to.be.bignumber.lt(stakeAmount);

            await staking.withdraw(stakeAmount, date, account, { from: account });
            expect(await token.balanceOf(account)).to.be.bignumber.equal(
                balanceBefore.add(stakeAmount)
            );
        });

        it("if receiver is the 0 address, the (potentially reduced) amount is withdrawn to the sender", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);
            expect(await token.balanceOf(a1)).to.be.bignumber.equal("0");
            await setNextBlockTimestamp(date.add(TWO_WEEKS_BN).toNumber());

            await staking.withdraw(new BN("100"), date, address(0), { from: a1 });
            expect(await token.balanceOf(a1)).to.be.bignumber.equal("100");
        });

        it("after function execution getPriorUserStakeByDate returns 0 for the sender and until", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);

            await staking.withdraw(new BN("100"), date, address(0), { from: a1 });
            await mineBlock();
            const currentBlockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.getPriorUserStakeByDate(a1, date, currentBlockNumber - 1)
            ).to.be.bignumber.equal("0");
        });

        it("after function execution getPriorStakeByDateForDelegatee is reduced by amount for the sender’s delegate at until. careful: full amount even if until lies in the future!", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            const stakeBlockNumber = await initializeStake(date, new BN("100"), a1);
            const priorStake = await staking.getPriorStakeByDateForDelegatee(
                a1,
                date,
                stakeBlockNumber
            );
            expect(priorStake).to.be.bignumber.equal("100");

            await staking.withdraw(new BN("100"), date, address(0), { from: a1 });
            await mineBlock();
            const currentBlockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.getPriorStakeByDateForDelegatee(a1, date, currentBlockNumber - 1)
            ).to.be.bignumber.equal("0");
        });

        it("if the sender is a vesting contract, getPriorVestingStakeByDate returns the reduced vesting stake at until  (by the full amount)", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);

            // NOTE: this is needed or feeSharingCollector throws a fit ("Invalid totalWeightedStake") because
            // totalWeightedStake is 0
            await initializeStake(date, new BN("1"), a2);

            const account = await deployAndImpersonateVestingContract();
            const stakeBlockNumber = await initializeStake(date, new BN("100"), account);
            const priorStake = await staking.getPriorVestingStakeByDate(date, stakeBlockNumber);
            expect(priorStake).to.be.bignumber.equal("100");

            await staking.withdraw(new BN("100"), date, address(0), { from: account });
            const blockNumber = await web3.eth.getBlockNumber();
            await mineBlock();
            expect(
                await staking.getPriorVestingStakeByDate(date, blockNumber)
            ).to.be.bignumber.equal("0");
            await stopImpersonatingAccount(account);
        });

        it("after function execution getPriorTotalStakesForDate returns the reduced total stake for until (by the full amount)", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("50"), a2); // stake from another user
            const stakeBlockNumber = await initializeStake(date, new BN("100"), a1);
            const priorStake = await staking.getPriorTotalStakesForDate(date, stakeBlockNumber);
            expect(priorStake).to.be.bignumber.equal("150");

            await staking.withdraw(new BN("100"), date, address(0), { from: a1 });
            await mineBlock();
            const currentBlockNumber = await web3.eth.getBlockNumber();
            expect(
                await staking.getPriorTotalStakesForDate(date, currentBlockNumber - 1)
            ).to.be.bignumber.equal("50");
        });

        describe("vesting contract multiple withdrawal cases", () => {
            let date1;
            let date2;
            let account;

            beforeEach(async () => {
                date1 = kickoffTS.add(TWO_WEEKS_BN);
                date2 = date1.add(TWO_WEEKS_BN);

                // NOTE: this is needed or feeSharingCollector throws a fit ("Invalid totalWeightedStake") because
                // totalWeightedStake is 0
                await initializeStake(date1, new BN("1"), a2);

                account = await deployAndImpersonateVestingContract();
                await initializeStake(date1, new BN("1000"), account);
                await initializeStake(date2, new BN("500"), account);
            });

            it("if the sender is a vesting contract, not only the tokens for the until are withdrawn, but also the tokens staked until the next lock date if the next lock date after until lies in the past", async () => {
                // travel to the future, both dates are in the past
                await setNextBlockTimestamp(date2.add(TWO_WEEKS_BN).toNumber());

                expect(await token.balanceOf(account)).to.be.bignumber.equal("0");

                // withdraw until date1, should withdraw both
                await staking.withdraw(new BN("1000"), date1, address(0), { from: account });

                // expect both stakes to be withdrawn
                expect(await token.balanceOf(account)).to.be.bignumber.equal("1500");
            });

            it("if the sender is a vesting contract, not only the tokens for the ADJUSTED until are withdrawn, but also the tokens staked until the next lock date if the next lock date after until lies in the past", async () => {
                // travel to the future, both dates are in the past
                await setNextBlockTimestamp(date2.add(new BN("1")).toNumber());

                expect(await token.balanceOf(account)).to.be.bignumber.equal("0");

                // withdraw until an invalid lock date that should adjust to `date` and then withdraw both
                const messedUpDate = date1.sub(TWO_WEEKS_BN).add(new BN("1"));
                await staking.withdraw(new BN("1000"), messedUpDate, address(0), {
                    from: account,
                });

                // expect both stakes to be withdrawn
                expect(await token.balanceOf(account)).to.be.bignumber.equal("1500");
            });

            it("if the sender is a vesting contract, only the tokens for the ADJUSTED until are withdrawn, not staked until the next lock date, if the next lock date after until is in the FUTURE", async () => {
                // travel to the future, only the first date lies in the past
                await setNextBlockTimestamp(date1.add(ONE_DAY_BN.mul(new BN("10"))).toNumber());

                expect(await token.balanceOf(account)).to.be.bignumber.equal("0");

                // withdraw until date1 minus seven days
                // this should adjust to date1, and then should not withdraw the next one because it's still in the future
                const messedUpDate = date1.sub(ONE_DAY_BN.mul(new BN("7")));
                await staking.withdraw(new BN("1000"), messedUpDate, address(0), {
                    from: account,
                });

                const checkedBlockNumber = await web3.eth.getBlockNumber();
                await mineBlock(); // must finalize it

                // expect only the first stake to be withdrawn (it would otherwise result in slashing)
                expect(await token.balanceOf(account)).to.be.bignumber.equal("1000");
                expect(
                    await staking.getPriorUserStakeByDate(account, date1, checkedBlockNumber)
                ).to.be.bignumber.equal("0");
                expect(
                    await staking.getPriorUserStakeByDate(account, date2, checkedBlockNumber)
                ).to.be.bignumber.equal("500");
            });
        });
    });

    async function initializeStake(date, amount, user) {
        // helper to grant tokens, stake, mine a block, and return the block number of the stake

        if (!user) {
            user = a1;
        }

        await token.transfer(user, amount);
        await token.approve(staking.address, amount, { from: user });

        const stakeTx = await staking.stake(amount, date, user, user, { from: user });
        const blockNumber = stakeTx.receipt.blockNumber;
        await mineBlock();

        return blockNumber;
    }

    async function deployVestingContract(opts = {}) {
        const { user = a1, cliff, duration } = opts;
        if (!cliff || !duration) {
            throw new Error("cliff and duration are required");
        }
        let vestingInstance = await Vesting.new(
            vestingLogic1.address,
            token.address,
            staking.address,
            user,
            cliff,
            duration,
            user
        );
        await staking.addContractCodeHash(await vestingInstance.address);
        return await VestingLogic.at(vestingInstance.address);
    }

    async function initializeStakeFromVestingContract(vestingContract, amount, user) {
        if (!user) {
            user = a1;
        }
        await token.transfer(user, amount);
        await token.approve(vestingContract.address, amount, { from: user });

        const stakeTx = await vestingContract.stakeTokens(amount, { from: user });
        const blockNumber = stakeTx.receipt.blockNumber;
        await mineBlock();

        return blockNumber;
    }

    async function deployAndImpersonateVestingContract(vestingContractOpts = {}) {
        // create a "vesting contract" and impersonate it, allowing sending transactions directly "from" the contract
        // the opts of the vesting contract don't really matter much if sending transactions directly from it
        // return the address of the contract
        vestingContractOpts = {
            user: a1,
            cliff: TWO_WEEKS_BN,
            duration: TWO_WEEKS_BN,
            ...vestingContractOpts,
        };
        const vestingContract = await deployVestingContract(vestingContractOpts);
        await impersonateAccount(vestingContract.address);
        // it needs to have some balance for us to be able to send transactions from it
        await setBalance(vestingContract.address, new BN("10").pow(new BN("18")));
        return vestingContract.address;
    }

    function getAmountWithWeightMaxDuration(amount) {
        // equal to getAmountWithWeight(amount, inThreeYears, kickoffTS);
        return new BN(MAX_VOTING_WEIGHT.toNumber() + 1).mul(new BN(amount));
    }

    function getAmountWithWeight(amount, date, startDate) {
        return new BN(amount).mul(getWeight(date, startDate)).div(WEIGHT_FACTOR);
    }

    function getWeight(date, startDate) {
        const remainingTime = date.sub(startDate);
        // NOTE: the code says: (m^2 - x^2)/m^2 +1 (multiplied by the weight factor)
        // but actually it's ((m^2 - x^2)*MAX_VOTING_WEIGHT/m^2 + 1) * WEIGHT_FACTOR
        const x = MAX_DURATION.sub(remainingTime).div(ONE_DAY_BN);
        const mPow2 = MAX_DURATION.div(ONE_DAY_BN).pow(new BN(2));
        return mPow2
            .sub(x.mul(x))
            .mul(MAX_VOTING_WEIGHT)
            .mul(WEIGHT_FACTOR)
            .div(mPow2)
            .add(WEIGHT_FACTOR);
    }
});
