/** Speed optimized on branch hardhatTestRefactor, 2021-10-04
 * Bottleneck found at beforeEach hook, redeploying token and staking ... on every test.
 *
 * Total time elapsed: 6.6s
 * After optimization: 5.6s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");

const { address, mineBlock, setNextBlockTimestamp } = require("../Utils/Ethereum");
const { deployAndGetIStaking } = require("../Utils/initializer");

const EIP712 = require("../Utils/EIP712");
// const EIP712Ethers = require("../Utils/EIP712Ethers");
const { getAccountsPrivateKeysBuffer } = require("../Utils/hardhat_utils");

const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");
const Vesting = artifacts.require("Vesting");
const VestingLogic = artifacts.require("VestingLogic");
//Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const StakingAdminModule = artifacts.require("StakingAdminModule");
const StakingVestingModule = artifacts.require("StakingVestingModule");
const StakingWithdrawModule = artifacts.require("StakingWithdrawModule");

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
    let token, staking;
    let MAX_VOTING_WEIGHT;
    let MAX_DURATION;
    let WEIGHT_FACTOR;

    let kickoffTS, inThreeYears;
    let currentChainId;

    let vestingLogic1, vestingLogic2;
    let vesting;

    async function deploymentAndInitFixture(_wallets, _provider) {
        chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
        await web3.eth.net.getId();
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        /// Staking Modules
        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(token.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        //Upgradable Vesting Registry
        const vestingRegistryLogic = await VestingRegistryLogic.new();
        vesting = await VestingRegistryProxy.new();
        await vesting.setImplementation(vestingRegistryLogic.address);
        vesting = await VestingRegistryLogic.at(vesting.address);

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

    describe("setVestingRegistry", () => {
        it("the owner may set the vesting registry if the contract is not frozen", async () => {
            //expect(await staking.frozen()).to.be.false; // sanity check
            const newAddress = address(1337);
            await staking.setVestingRegistry(newAddress);
            expect(await staking.vestingRegistryLogic()).to.be.equal(newAddress);
        });

        it("the owner may not set the vesting registry if the contract is frozen", async () => {
            await staking.freezeUnfreeze(true);
            await expect(staking.setVestingRegistry(address(1337))).to.be.revertedWith("paused");
        });

        it("the owner may set the vesting registry if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            const newAddress = address(1337);
            await staking.setVestingRegistry(newAddress);
            expect(await staking.vestingRegistryLogic()).to.be.equal(newAddress);
        });

        it("any other address may not set the vesting registry", async () => {
            await expect(
                staking.setVestingRegistry(address(1337), { from: a1 })
            ).to.be.revertedWith("unauthorized");

            await staking.addAdmin(a1);
            // still reverts
            await expect(
                staking.setVestingRegistry(address(1337), { from: a1 })
            ).to.be.revertedWith("unauthorized");
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
    });

    describe("token balanceOf", () => {
        // NOTE: these don't test the actual balanceOf function, but the balanceOf function of the token contract
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
            await expect(staking.addAdmin(a1)).to.be.revertedWith("paused");
        });

        it("the owner may add an admin if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.addAdmin(a1);
            expect(await staking.admins(a1)).to.be.true;
        });

        it("any other address may not add an admin", async () => {
            await expect(staking.addAdmin(a1, { from: a1 })).to.be.revertedWith("unauthorized");
            await staking.addAdmin(a1);
            await expect(staking.addAdmin(a2, { from: a1 })).to.be.revertedWith("unauthorized");
        });

        it("it is not allowed to add the 0 address as an admin", async () => {
            await expect(staking.addAdmin(address(0))).to.be.revertedWith(
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
            await expect(staking.removeAdmin(a1)).to.be.revertedWith("paused");
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
            await expect(staking.addPauser(a1)).to.be.revertedWith("paused");
        });

        it("the owner may add a  pauser if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.addPauser(a1);
            expect(await staking.pausers(a1)).to.be.true;
        });

        it("any other address may not add a pauser", async () => {
            await expect(staking.addPauser(a1, { from: a1 })).to.be.revertedWith("unauthorized");
            await staking.addAdmin(a1);
            await expect(staking.addPauser(a2, { from: a1 })).to.be.revertedWith("unauthorized");
        });

        it("it is not allowed to add the 0 address as a pauser", async () => {
            await expect(staking.addPauser(address(0))).to.be.revertedWith(
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
            await expect(staking.removePauser(a1)).to.be.revertedWith("paused");
        });

        it("the owner may remove a pauser if the contract is paused", async () => {
            await staking.addPauser(a1);
            await staking.pauseUnpause(true);
            await staking.removePauser(a1);
            expect(await staking.pausers(a1)).to.be.false;
        });

        it("any other address may not remove a pauser", async () => {
            await staking.addPauser(a1);
            await expect(staking.removePauser(a1, { from: a1 })).to.be.revertedWith(
                "unauthorized"
            );
            await staking.addAdmin(a2);
            await expect(staking.removePauser(a1, { from: a2 })).to.be.revertedWith(
                "unauthorized"
            );
        });

        it("reverts if _pauser is not a pauser", async () => {
            await expect(staking.removePauser(a1)).to.be.revertedWith("address is not a pauser");
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
            await expect(staking.pauseUnpause(true)).to.be.revertedWith("paused");

            await staking.freezeUnfreeze(false);
            await staking.pauseUnpause(true);

            await staking.freezeUnfreeze(true);
            await expect(staking.pauseUnpause(false)).to.be.revertedWith("paused");
        });

        it("a pauser different from the owner may pause/unpause if the contract is not frozen", async () => {
            await staking.addPauser(a2);

            await staking.pauseUnpause(true, { from: a2 });
            expect(await staking.paused()).to.be.true;

            await staking.pauseUnpause(false, { from: a2 });
            expect(await staking.paused()).to.be.false;
        });

        it("any other address may not pause/unpause", async () => {
            await expect(staking.pauseUnpause(true, { from: a1 })).to.be.revertedWith(
                "unauthorized"
            );
            await expect(staking.pauseUnpause(false, { from: a1 })).to.be.revertedWith(
                "unauthorized"
            );
            await staking.addAdmin(a1);
            await expect(staking.pauseUnpause(true, { from: a1 })).to.be.revertedWith(
                "unauthorized"
            );
            await expect(staking.pauseUnpause(false, { from: a1 })).to.be.revertedWith(
                "unauthorized"
            );
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
            await expect(staking.freezeUnfreeze(true, { from: a1 })).to.be.revertedWith(
                "unauthorized"
            );
            await staking.addAdmin(a1);
            await expect(staking.freezeUnfreeze(true, { from: a1 })).to.be.revertedWith(
                "unauthorized"
            );
            await staking.freezeUnfreeze(true);
            await expect(staking.freezeUnfreeze(false, { from: a1 })).to.be.revertedWith(
                "unauthorized"
            );
        });

        it("freezing/unfreezing to the same state as before will revert", async () => {
            await expect(staking.freezeUnfreeze(false)).to.be.revertedWith(
                "Cannot freeze/unfreeze to the same state"
            );
            await staking.freezeUnfreeze(true);
            await expect(staking.freezeUnfreeze(true)).to.be.revertedWith(
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
            await expect(staking.addContractCodeHash(randomContract.address)).to.be.revertedWith(
                "paused"
            );
        });

        it("the owner may add a vesting code hash if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.addContractCodeHash(randomContract.address);
            expect(await staking.isVestingContract(randomContract.address)).to.be.true;
        });

        it("other accounts cannot add a vesting code hash", async () => {
            await expect(
                staking.addContractCodeHash(randomContract.address, { from: a2 })
            ).to.be.revertedWith("unauthorized");
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
            await expect(
                staking.removeContractCodeHash(randomContract.address)
            ).to.be.revertedWith("paused");
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
            await expect(
                staking.removeContractCodeHash(randomContract.address, { from: a2 })
            ).to.be.revertedWith("unauthorized");
        });

        it("reverts if vesting is not actually a registered vesting contract code hash", async () => {
            await expect(
                staking.removeContractCodeHash(randomContract.address)
            ).to.be.revertedWith("not a registered vesting code hash");
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
            await expect(staking.setNewStakingContract(a2)).to.be.revertedWith("paused");
        });

        it("the owner may set the new staking contract if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.setNewStakingContract(a2);
            expect(await staking.newStakingContract()).to.equal(a2);
        });

        it("any other address may not set the new staking contract", async () => {
            await expect(staking.setNewStakingContract(a2, { from: a2 })).to.be.revertedWith(
                "unauthorized"
            );
        });

        it("it is not allowed to set the new staking contract to the 0 address", async () => {
            await expect(staking.setNewStakingContract(ZERO_ADDRESS)).to.be.revertedWith(
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
            await expect(staking.setFeeSharing(a2)).to.be.revertedWith("paused");
        });

        it("the owner may set the fee sharing contract if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.setFeeSharing(a2);
            expect(await staking.feeSharing()).to.equal(a2);
        });

        it("any other address may not set the fee sharing contract", async () => {
            await expect(staking.setFeeSharing(a2, { from: a2 })).to.be.revertedWith(
                "unauthorized"
            );
        });

        it("it is not allowed to set the fee sharing contract to the 0 address", async () => {
            await expect(staking.setFeeSharing(ZERO_ADDRESS)).to.be.revertedWith(
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
            await expect(staking.setWeightScaling(5)).to.be.revertedWith("paused");
        });

        it("the owner may set the scaling weight if the contract is paused", async () => {
            await staking.pauseUnpause(true);
            await staking.setWeightScaling(6);
            expect(await staking.weightScaling()).to.bignumber.equal("6");
        });

        it("any other address may not set the scaling weight", async () => {
            await expect(staking.setWeightScaling(5, { from: a2 })).to.be.revertedWith(
                "unauthorized"
            );
            // add a2 as admin and try again
            await staking.addAdmin(a2);
            await expect(staking.setWeightScaling(5, { from: a2 })).to.be.revertedWith(
                "unauthorized"
            );
        });

        it("it is not allowed to set the scaling weight lower than MIN_WEIGHT_SCALING", async () => {
            await expect(staking.setWeightScaling(MIN_WEIGHT_SCALING - 1)).to.be.revertedWith(
                "S18"
            );
            // test boundary
            await staking.setWeightScaling(MIN_WEIGHT_SCALING);
            expect(await staking.weightScaling()).to.bignumber.equal(
                MIN_WEIGHT_SCALING.toString()
            );
        });

        it("it is not allowed to set the scaling weight higher than MAX_WEIGHT_SCALING", async () => {
            await expect(staking.setWeightScaling(MAX_WEIGHT_SCALING + 1)).to.be.revertedWith(
                "S18"
            );
            // test boundary
            await staking.setWeightScaling(MAX_WEIGHT_SCALING);
            expect(await staking.weightScaling()).to.bignumber.equal(
                MAX_WEIGHT_SCALING.toString()
            );
        });
    });

    describe("vesting stakes", () => {
        it("should set vesting stakes", async () => {
            let lockedDates = [
                kickoffTS.add(new BN(TWO_WEEKS)),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2))),
                kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4))),
            ];
            let values = [new BN(1000), new BN(30000000000), new BN(500000000000000)];

            let tx = await staking.setVestingStakes(lockedDates, values);

            for (let i = 0; i < lockedDates.length; i++) {
                let numCheckpoints = await staking.numVestingCheckpoints.call(lockedDates[i]);
                expect(numCheckpoints).to.be.bignumber.equal(new BN(1));
                let value = await staking.vestingCheckpoints.call(lockedDates[i], 0);
                expect(value.stake).to.be.bignumber.equal(values[i]);
                expect(value.fromBlock).to.be.bignumber.equal(new BN(0));

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
            await expect(staking.setMaxVestingWithdrawIterations(20)).to.be.revertedWith("paused");
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
            await expect(staking.computeWeightByDate(1, 2)).to.be.revertedWith("date < startDate");
            await staking.computeWeightByDate(1, 1); // no revert
        });

        it("if date - startDate > max duration, the function reverts", async () => {
            let startDate = new BN(1000);
            let date = startDate.add(MAX_DURATION).add(new BN(1));

            await expect(staking.computeWeightByDate(date, startDate)).to.be.revertedWith(
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
            await expect(staking.timestampToLockDate(timestamp)).to.be.revertedWith(
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
            await expect(
                staking.getPriorUserStakeByDate(a1, kickoffTS, blockNumber)
            ).to.be.revertedWith("not determined");
            await expect(
                staking.getPriorUserStakeByDate(a1, kickoffTS, blockNumber + 1)
            ).to.be.revertedWith("not determined");
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

            await expect(
                staking.weightedStakeByDate(a1, date, startDate, blockNumber)
            ).to.be.revertedWith("date < startDate");
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
            // This must not be further away than MAX_DURATION or `stake` will adjust the locked ts
            const date = kickoffTS.add(MAX_DURATION);
            const startDate = kickoffTS.sub(new BN(1));

            // TODO: should not require stake
            const blockNumber = await initializeStake(date, "1000");

            await expect(
                staking.weightedStakeByDate(a1, date, startDate, blockNumber)
            ).to.be.revertedWith("remaining time > max duration");
        });

        it("if blockNumber >= the current block number, the function reverts", async () => {
            const currentBlockNumber = await web3.eth.getBlockNumber();
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await expect(
                staking.weightedStakeByDate(a1, date, date, currentBlockNumber)
            ).to.be.revertedWith("not determined");
            await expect(
                staking.weightedStakeByDate(a1, date, date, currentBlockNumber + 1)
            ).to.be.revertedWith("not determined");
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

        it("if date is not a valid lock date, the function will return the weighted stake at the closest lock date AFTER date", async () => {
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

            // not a valid lock date but before, should fall back to stake AFTER the date e.g. the staking date
            weightedStake = await staking.weightedStakeByDate(
                a1,
                dateBefore,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq(
                getAmountWithWeight("10000", stakeDate, startDate)
            );

            // date after -> it will return the stake at the date after, which is 0 in this case
            weightedStake = await staking.weightedStakeByDate(
                a1,
                dateAfter,
                startDate,
                blockNumber
            );
            expect(weightedStake).to.be.bignumber.eq("0");
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
            await expect(
                staking.getPriorWeightedStake(a1, currentBlockNumber, date)
            ).to.be.revertedWith("not determined");
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
            await expect(
                staking.getPriorTotalStakesForDate(date, currentBlockNumber)
            ).to.be.revertedWith("not determined");
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
            await expect(
                staking.getPriorTotalVotingPower(currentBlockNumber, kickoffTS)
            ).to.be.revertedWith("not determined");
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
            await expect(
                staking.getPriorVestingWeightedStake(currentBlockNumber, kickoffTS)
            ).to.be.revertedWith("not determined");
            await expect(
                staking.getPriorVestingWeightedStake(currentBlockNumber + 1, kickoffTS)
            ).to.be.revertedWith("not determined");
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
            await expect(staking.getWithdrawAmounts(0, date)).to.be.revertedWith(
                "Amount of tokens to withdraw must be > 0"
            );
        });

        it("the function reverts if amount is higher than the msg.sender's staked balance for until", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);
            await expect(staking.getWithdrawAmounts(new BN("101"), date), {
                from: a1,
            }).to.be.revertedWith("Staking::withdraw: not enough balance");
        });

        it("if until is not a valid lock date, the lock date NEXT to until is used for both the withdrawable amount and punishment", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);

            // rounds to the current lock date -> should work
            const result = await staking.getWithdrawAmounts(new BN("100"), date.sub(new BN(1)), {
                from: a1,
            });
            expect(result).to.not.be.empty;
            console.log(result[0].toString(), result[1].toString());

            // rounds to the next lock date -> no stake available -> revert
            await expect(
                staking.getWithdrawAmounts(new BN("100"), date.add(new BN(1)), { from: a1 })
            ).to.be.revertedWith("Staking::withdraw: not enough balance");
        });

        it("if until lies in the past, the function will revert", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);

            // travel to the next lock date
            await setNextBlockTimestamp(date.add(TWO_WEEKS_BN).toNumber());
            await mineBlock();

            await expect(
                staking.getWithdrawAmounts(new BN("100"), date, { from: a1 })
            ).to.be.revertedWith("date < startDate");
        });

        it("if until lies in the future, the function returns how many tokens the user receives if unstaking amount considering the penalty for early unstaking, and returns the withdrawable amount and the penalty", async () => {
            // NOTE: it does NOT currently adjust the "until" timestamp
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

        it("if until lies in the future, the withdrawable amount must be < amount and the penalty > 0", async () => {
            const date = kickoffTS.add(TWO_WEEKS_BN);
            await initializeStake(date, new BN("100"), a1);
            const result = await staking.getWithdrawAmounts(new BN("100"), date, { from: a1 });
            const [withdrawable, penalty] = [result[0], result[1]];
            expect(withdrawable).to.be.bignumber.lt(new BN("100"));
            expect(penalty).to.be.bignumber.gt(new BN("0"));
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
