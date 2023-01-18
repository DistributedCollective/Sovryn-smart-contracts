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
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

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

    describe("extendStakingDuration", () => {
        // it("should fail if second stake in the same block", async () => {
        //     let user = accounts[0];
        //     let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
        //     let newLockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4)));
        //     let amount = new BN(1000);
        //     await token.transfer(user, amount.mul(new BN(2)));
        //     await token.approve(staking.address, amount.mul(new BN(2)), {from: user});
        //
        //     // stop mining
        //     await network.provider.send("evm_setAutomine", [false]);
        //     await network.provider.send("evm_setIntervalMining", [10000]);
        //     await staking.stake(amount, lockedDate, user, user, {from: user});
        //
        //     await expectRevert(staking.extendStakingDuration(lockedDate, newLockedDate, {from: user}), "cannot be mined in the same block as last stake");
        // });

        it("should fail if paused", async () => {
            await staking.freezeUnfreeze(true);
            await expectRevert(staking.extendStakingDuration(0, 0), "paused");
        });

        it("should fail if frozen", async () => {
            await staking.pauseUnpause(true);
            await expectRevert(staking.extendStakingDuration(0, 0), "paused");
        });

        it("should fail if previous lock date has no stake", async () => {
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4)));
            await expectRevert(
                staking.extendStakingDuration(lockedDate, lockedDateNew),
                "no stakes till the prev lock date"
            );
        });

        it("should if adjusted until < adjusted previousLock", async () => {
            let lockedDate = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = lockedDate.sub(new BN(3600));
            lockedDate = lockedDate.sub(new BN(7200));
            await expectRevert(
                staking.extendStakingDuration(lockedDate, lockedDateNew),
                "must increase staking duration"
            );
        });

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

        it("should extend staking to max duration", async () => {
            let user = accounts[0];
            let lockedDateOld = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)));
            let lockedDateNew = kickoffTS.add(MAX_DURATION.mul(new BN(3)));
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

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingStakeModule,
                "ExtendedStakingDuration",
                {
                    staker: user,
                    previousDate: lockedDateOld,
                    newDate: kickoffTS.add(MAX_DURATION),
                    amountStaked: amount,
                }
            );
        });

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
