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

const { address, mineBlock } = require("../Utils/Ethereum");
const { deployAndGetIStaking } = require("../Utils/initializer");

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
            const maxDuration = await staking.MAX_DURATION();
            let startDate = new BN(1000);
            let date = startDate.add(maxDuration).add(new BN(1));

            await expect(staking.computeWeightByDate(date, startDate)).to.be.revertedWith(
                "remaining time > max duration"
            );

            date = date.sub(new BN(1));
            await staking.computeWeightByDate(date, startDate); // no revert
        });

        it("calculates the weight according to the formula for all lock dates (passed as date) from startDate until startDate + max duration", async () => {
            const maxDuration = await staking.MAX_DURATION();
            const weightFactor = await staking.getStorageWeightFactor();

            let startDate = await staking.kickoffTS();
            let date = startDate;
            while (date.lte(startDate.add(maxDuration))) {
                const weight = await staking.computeWeightByDate(date, startDate);
                const remainingTime = date.sub(startDate);
                // NOTE: the code says: (m^2 - x^2)/m^2 +1 (multiplied by the weight factor)
                // but actually it's ((m^2 - x^2)*MAX_VOTING_WEIGHT/m^2 + 1) * WEIGHT_FACTOR
                const x = maxDuration.sub(remainingTime).div(ONE_DAY_BN);
                const mPow2 = maxDuration.div(ONE_DAY_BN).pow(new BN(2));
                const expectedWeight = mPow2
                    .sub(x.mul(x))
                    .mul(MAX_VOTING_WEIGHT)
                    .mul(weightFactor)
                    .div(mPow2)
                    .add(weightFactor);
                expect(weight).to.be.bignumber.equal(expectedWeight);
                date = date.add(TWO_WEEKS_BN);
            }

            // couple of sanity checks for the boundaries
            expect(await staking.computeWeightByDate(startDate, startDate)).to.be.bignumber.equal(
                new BN(10)
            );
            expect(
                await staking.computeWeightByDate(startDate.add(maxDuration), startDate)
            ).to.be.bignumber.equal(new BN(100));
        });
    });

    function getAmountWithWeight(amount) {
        return new BN(MAX_VOTING_WEIGHT.toNumber() + 1).mul(new BN(amount));
    }
});
