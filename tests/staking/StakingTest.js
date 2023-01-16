/** Speed optimized on branch hardhatTestRefactor, 2021-10-04
 * Bottleneck found at beforeEach hook, redeploying token and staking ... on every test.
 *
 * Total time elapsed: 6.6s
 * After optimization: 5.6s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");
const { waffle, network } = require("hardhat");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");

const { address, mineBlock, setNextBlockTimestamp } = require("../Utils/Ethereum");
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
const VestingLogic = artifacts.require("VestingLogic");
//Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const StakingAdminModule = artifacts.require("StakingAdminModule");
const StakingVestingModule = artifacts.require("StakingVestingModule");
const StakingWithdrawModule = artifacts.require("StakingWithdrawModule");
const StakingStakeModule = artifacts.require("StakingStakeModule");

const FeeSharingLogic = artifacts.require("FeeSharingLogic");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");

const TOTAL_SUPPLY = "10000000000000000000000000";
const DELAY = 86400 * 14;
const TWO_WEEKS = 86400 * 14;

const ZERO_ADDRESS = ethers.constants.AddressZero;

contract("Staking", (accounts) => {
    const name = "Test token";
    const symbol = "TST";

    let root, a1, a2, a3, chainId;
    let pA1;
    let token, staking, sovryn;
    let MAX_VOTING_WEIGHT;

    let kickoffTS, inThreeYears;
    let currentChainId;

    let vestingLogic1, vestingLogic2;

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

        //Upgradable Vesting Registry
        vestingRegistryLogic = await VestingRegistryLogic.new();
        vesting = await VestingRegistryProxy.new();
        await vesting.setImplementation(vestingRegistryLogic.address);
        vesting = await VestingRegistryLogic.at(vesting.address);

        //FeeSharingProxy
        let feeSharingLogic = await FeeSharingLogic.new();
        feeSharingProxyObj = await FeeSharingProxy.new(sovryn.address, staking.address);
        await feeSharingProxyObj.setImplementation(feeSharingLogic.address);
        feeSharingProxy = await FeeSharingLogic.at(feeSharingProxyObj.address);
        await staking.setFeeSharing(feeSharingProxy.address);

        await staking.setVestingRegistry(vesting.address);

        MAX_VOTING_WEIGHT = await staking.getStorageMaxVotingWeight.call();

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

    afterEach(async () => {
        // Make sure we don't accidentally leave interval mining on after the tests
        await network.provider.send("evm_setAutomine", [true]);
        await network.provider.send("evm_setIntervalMining", [0]);
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
            await expectRevert(staking.stake(0, 0, ZERO_ADDRESS, ZERO_ADDRESS), "amount needs to be bigger than 0");
        });

        it("should fail if until < block.timestamp", async () => {
            await expectRevert(staking.stake(new BN(1000), kickoffTS.add(new BN(1)), ZERO_ADDRESS, ZERO_ADDRESS), "Staking::_timestampToLockDate: staking period too short");
        });

        // it("should fail if second stake in the same block", async () => {
        //     let user = accounts[0];
        //     let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
        //     let amount = new BN(1000);
        //     await token.transfer(user, amount.mul(new BN(2)));
        //     await token.approve(staking.address, amount.mul(new BN(2)), {from: user});
        //
        //     // stop mining
        //     await network.provider.send("evm_setAutomine", [false]);
        //     await network.provider.send("evm_setIntervalMining", [10000]);
        //     await staking.stake(amount, lockedDate, user, user, {from: user});
        //
        //     await expectRevert(staking.stake(amount, lockedDate, user, user, {from: user}), "cannot be mined in the same block as last stake");
        // });

        it("should fail if paused", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.stake(0, 0, ZERO_ADDRESS, ZERO_ADDRESS), "paused");
        });

        it("should fail if frozen", async () => {
            await staking.pauseUnpause(true);
            await expectRevert(staking.stake(0, 0, ZERO_ADDRESS, ZERO_ADDRESS), "paused");
        });

        it("should change stakeFor and delegatee if zero addresses", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, {from: user});

            let tx = await staking.stake(amount, lockedDate, ZERO_ADDRESS, ZERO_ADDRESS, {from: user});

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "TokensStaked",
                {
                    staker: user,
                    amount: amount,
                    lockedUntil: lockedDate,
                    totalStaked: amount
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
                    toDelegate: user
                }
            );

        });

        it("should stake tokens for user without delegation", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, {from: user});

            let tx = await staking.stake(amount, lockedDate, user, user, {from: user});
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check delegatee
            let userDelegatee = await staking.delegates(user, lockedDate);
            expect(userDelegatee).to.be.equal(user);

            //check getPriorTotalStakesForDate
            let priorTotalStakeBefore = await staking.getPriorTotalStakesForDate(lockedDate, blockBefore);
            let priorTotalStakeAfter = await staking.getPriorTotalStakesForDate(lockedDate, blockAfter);
            expect(priorTotalStakeAfter.sub(priorTotalStakeBefore)).to.be.equal(amount);

            //check getPriorUserStakeByDate
            let priorUserStakeBefore = await staking.getPriorUserStakeByDate(user, lockedDate, blockBefore);
            let priorUserStakeAfter = await staking.getPriorUserStakeByDate(user, lockedDate, blockAfter);
            expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(amount);

            //check getPriorStakeByDateForDelegatee
            let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(user, lockedDate, blockBefore);
            let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(user, lockedDate, blockAfter);
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "TokensStaked",
                {
                    staker: user,
                    amount: amount,
                    lockedUntil: lockedDate,
                    totalStaked: amount
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
                    toDelegate: user
                }
            );
        });

        it("should stake tokens for user with delegation", async () => {
            let user = accounts[0];
            let delegatee = accounts[1];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, {from: user});

            let tx = await staking.stake(amount, lockedDate, user, delegatee, {from: user});
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check delegatee
            let userDelegatee = await staking.delegates(user, lockedDate);
            expect(userDelegatee).to.be.equal(delegatee);

            //check getPriorTotalStakesForDate
            let priorTotalStakeBefore = await staking.getPriorTotalStakesForDate(lockedDate, blockBefore);
            let priorTotalStakeAfter = await staking.getPriorTotalStakesForDate(lockedDate, blockAfter);
            expect(priorTotalStakeAfter.sub(priorTotalStakeBefore)).to.be.equal(amount);

            //check getPriorUserStakeByDate
            let priorUserStakeBefore = await staking.getPriorUserStakeByDate(user, lockedDate, blockBefore);
            let priorUserStakeAfter = await staking.getPriorUserStakeByDate(user, lockedDate, blockAfter);
            expect(priorUserStakeAfter.sub(priorUserStakeBefore)).to.be.equal(amount);

            //check getPriorStakeByDateForDelegatee
            let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(delegatee, lockedDate, blockBefore);
            let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(delegatee, lockedDate, blockAfter);
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "TokensStaked",
                {
                    staker: user,
                    amount: amount,
                    lockedUntil: lockedDate,
                    totalStaked: amount
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
                    toDelegate: delegatee
                }
            );
        });

        it("should change delegatee", async () => {
            let user = accounts[0];
            let delegatee1 = accounts[1];
            let delegatee2 = accounts[2];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount1 = new BN(1000);
            let amount2 = new BN(2000);
            let totalAmount = amount1.add(amount2);
            await token.transfer(user, totalAmount);
            await token.approve(staking.address, totalAmount, {from: user});

            await staking.stake(amount1, lockedDate, user, delegatee1, {from: user});
            let tx = await staking.stake(amount2, lockedDate, user, delegatee2, {from: user});
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorStakeByDateForDelegatee - delegatee1
            let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(delegatee1, lockedDate, blockBefore);
            let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(delegatee1, lockedDate, blockAfter);
            expect(priorDelegateStakeBefore.sub(priorDelegateStakeAfter)).to.be.equal(amount1);

            //check getPriorStakeByDateForDelegatee - delegatee2
            priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(delegatee2, lockedDate, blockBefore);
            priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(delegatee2, lockedDate, blockAfter);
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount1.add(amount2));
        });

        it("should update delegate stake after withdraw", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount1 = new BN(1000);
            let amount2 = new BN(2000);
            let totalAmount = amount1.add(amount2);
            await token.transfer(user, totalAmount);
            await token.approve(staking.address, totalAmount, {from: user});

            await staking.stake(amount1, lockedDate, user, user, {from: user});
            await staking.withdraw(amount1, lockedDate, user, {from: user});

            let tx = await staking.stake(amount2, lockedDate, user, user, {from: user});
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorStakeByDateForDelegatee - delegatee1
            let priorDelegateStakeBefore = await staking.getPriorStakeByDateForDelegatee(user, lockedDate, blockBefore);
            let priorDelegateStakeAfter = await staking.getPriorStakeByDateForDelegatee(user, lockedDate, blockAfter);
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount2);
        });

        it("should update stake for vesting contracts", async () => {
            let user = accounts[0];
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let amount = new BN(1000);
            await token.transfer(user, amount);
            await token.approve(staking.address, amount, {from: user});

            await staking.addContractCodeHash(user);
            let tx = await staking.stake(amount, lockedDate, user, user, {from: user});
            let txBlockNumber = new BN(tx.receipt.blockNumber.toString());
            await mineBlock();
            let blockBefore = txBlockNumber.sub(new BN(1));
            let blockAfter = txBlockNumber;

            //check getPriorVestingStakeByDate
            let priorDelegateStakeBefore = await staking.getPriorVestingStakeByDate(lockedDate, blockBefore);
            let priorDelegateStakeAfter = await staking.getPriorVestingStakeByDate(lockedDate, blockAfter);
            expect(priorDelegateStakeAfter.sub(priorDelegateStakeBefore)).to.be.equal(amount);
        });

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

        it("should fail if the date duration exceeds the max_duration", async () => {
            let lockedDates = [kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(100)))];
            let values = [new BN(1000)];

            await expectRevert(
                staking.setVestingStakes(lockedDates, values),
                "Invalid lock dates: exceed max duration"
            );
        });
    });

    describe("balanceOf", () => {
        it("grants to initial account", async () => {
            expect((await token.balanceOf.call(root)).toString()).to.be.equal(TOTAL_SUPPLY);
        });
    });

    describe("delegateBySig", () => {
        const Domain = (staking) => ({
            name: "SOVStaking",
            chainId: currentChainId,
            verifyingContract: staking.address,
        });
        const Types = {
            Delegation: [
                { name: "delegatee", type: "address" },
                { name: "lockDate", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "expiry", type: "uint256" },
            ],
        };

        it("reverts if the signatory is invalid", async () => {
            const delegatee = root,
                nonce = 0,
                expiry = 0;
            await expectRevert(
                staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, 0, "0xbad", "0xbad"),
                "Staking::delegateBySig: invalid signature" /** S13: Staking::delegateBySig: invalid nonce */
            );
        });

        it("reverts if the nonce is bad ", async () => {
            const delegatee = root,
                nonce = 1,
                expiry = 0,
                lockDate = inThreeYears;
            const { v, r, s } = EIP712.sign(
                Domain(staking),
                "Delegation",
                {
                    delegatee,
                    lockDate,
                    nonce,
                    expiry,
                },
                Types,
                pkbA1
                // pA1.privateKey
                // unlockedAccount(a1).secretKey
            );
            /*const { v, r, s } = EIP712Ethers.sign(
                Domain(staking),
                "Delegation",
                {
                    delegatee,
                    lockDate,
                    nonce,
                    expiry,
                },
                Types,
                pA1
            );*/

            await expectRevert(
                staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s),
                "Staking::delegateBySig: invalid nonce" /**Staking::delegateBySig: invalid nonce */
            );
        });

        it("reverts if the signature has expired", async () => {
            const delegatee = root,
                nonce = 0,
                expiry = 0,
                lockDate = inThreeYears;
            const { v, r, s } = EIP712.sign(
                Domain(staking),
                "Delegation",
                {
                    delegatee,
                    lockDate,
                    nonce,
                    expiry,
                },
                Types,
                pkbA1
            );
            await expectRevert(
                staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s),
                "Staking::delegateBySig: signature expired" /**Staking::delegateBySig: signature expired */
            );
        });

        it("delegates on behalf of the signatory", async () => {
            const delegatee = root,
                nonce = 0,
                expiry = 10e9,
                lockDate = inThreeYears;
            const { v, r, s } = EIP712.sign(
                Domain(staking),
                "Delegation",
                {
                    delegatee,
                    lockDate,
                    nonce,
                    expiry,
                },
                Types,
                pkbA1
                // unlockedAccount(a1).secretKey
            );

            expect(await staking.delegates.call(a1, inThreeYears)).to.be.equal(address(0));
            const tx = await staking.delegateBySig(
                delegatee,
                inThreeYears,
                nonce,
                expiry,
                v,
                r,
                s
            );
            expect(tx.gasUsed < 80000);
            expect(await staking.delegates.call(a1, inThreeYears)).to.be.equal(root);
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

            // await minerStop();
            let t1 = staking.stake("80", inThreeYears, a3, a3, { from: guy });

            let t2 = staking.delegate(a3, inThreeYears, { from: guy });
            let t3 = token.transfer(a2, 10, { from: guy });
            let t4 = token.transfer(a2, 10, { from: guy });

            // await minerStart();
            t1 = await t1;
            t2 = await t2;
            t3 = await t3;
            t4 = await t4;

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

        it("reverts if block number >= current block", async () => {
            let time = kickoffTS.add(new BN(DELAY));
            await expectRevert(staking.getPriorVotes.call(a1, 5e10, time), "not determined yet"); // WS11 : not determined yet
        });

        it("returns 0 if there are no checkpoints", async () => {
            expect((await staking.getPriorVotes.call(a1, 0, kickoffTS)).toString()).to.be.equal(
                "0"
            );
        });

        it("returns the latest block if >= last checkpoint block", async () => {
            await token.approve(staking.address, amount);
            let t1 = await staking.stake(amount, inThreeYears, a1, a1);
            await mineBlock();
            await mineBlock();

            let amountWithWeight = getAmountWithWeight(amount);
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

            let amountWithWeight = getAmountWithWeight(amount);
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
            ).to.be.equal(getAmountWithWeight("1000").toString());
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t1.receipt.blockNumber + 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal(getAmountWithWeight("1000").toString());
            expect(
                (
                    await staking.getPriorVotes.call(a1, new BN(t2.receipt.blockNumber), kickoffTS)
                ).toString()
            ).to.be.equal(getAmountWithWeight("1010").toString());
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t2.receipt.blockNumber + 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal(getAmountWithWeight("1010").toString());
            expect(
                (
                    await staking.getPriorVotes.call(a1, new BN(t3.receipt.blockNumber), kickoffTS)
                ).toString()
            ).to.be.equal(getAmountWithWeight("1111").toString());
            expect(
                (
                    await staking.getPriorVotes.call(
                        a1,
                        new BN(t3.receipt.blockNumber + 1),
                        kickoffTS
                    )
                ).toString()
            ).to.be.equal(getAmountWithWeight("1111").toString());
        });
    });

    describe("addAdmin", () => {
        it("adds admin", async () => {
            let tx = await staking.addAdmin(a1);

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingAdminModule,
                "AdminAdded",
                {
                    admin: a1,
                }
            );

            let isAdmin = await staking.admins(a1);
            expect(isAdmin).equal(true);
        });

        it("fails sender isn't an owner", async () => {
            await expectRevert(staking.addAdmin(a1, { from: a1 }), "unauthorized");
        });
    });

    describe("removeAdmin", () => {
        it("removes admin", async () => {
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

        it("fails sender isn't an owner", async () => {
            await expectRevert(staking.removeAdmin(a1, { from: a1 }), "unauthorized");
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

    describe("maxWithdrawIterations", async () => {
        it("should set maxWithdrawIterations", async () => {
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
    });

    function getAmountWithWeight(amount) {
        return new BN(MAX_VOTING_WEIGHT.toNumber() + 1).mul(new BN(amount));
    }
});
