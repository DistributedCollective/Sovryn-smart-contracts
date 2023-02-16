/** Speed optimized on branch hardhatTestRefactor, 2021-10-05
 * Bottlenecks found:
 *  + beforeEach hook, redeploying DevelopmentFund and tokens, staking and vesting.
 *  + createVesting: should be able to create vesting (552ms)
 *  + createTeamVesting: should be able to create vesting (656ms)
 *
 * Total time elapsed: 10.3s
 * After optimization: 6.4s
 *
 * Notes:
 *   Reloading the fixture snapshot is not working for all tests. So, only
 *   some of them are requesting to redeploy when needed.
 *
 *   Added coverage tests.
 */

const { expect, assert } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const provider = waffle.provider;

const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const { mineBlock } = require("../Utils/Ethereum");
const { deployAndGetIStaking } = require("../Utils/initializer");

const StakingProxy = artifacts.require("StakingProxy");
const SOV_ABI = artifacts.require("SOV");
const TestToken = artifacts.require("TestToken");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxyMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry2");
const UpgradableProxy = artifacts.require("UpgradableProxy");

const FOUR_WEEKS = new BN(4 * 7 * 24 * 60 * 60);

const TEAM_VESTING_CLIFF = FOUR_WEEKS.mul(new BN(6));
const TEAM_VESTING_DURATION = FOUR_WEEKS.mul(new BN(36));

const TOTAL_SUPPLY = "100000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const pricsSats = "2500";

contract("VestingRegistry", (accounts) => {
    let root, account1, account2, account3;
    let SOV, cSOV1, cSOV2;
    let staking, feeSharingCollectorProxy;
    let vestingFactory, vestingLogic, vestingRegistry;

    async function deploymentAndInitFixture(_wallets, _provider) {
        SOV = await SOV_ABI.new(TOTAL_SUPPLY);
        cSOV1 = await TestToken.new("cSOV1", "cSOV1", 18, TOTAL_SUPPLY);
        cSOV2 = await TestToken.new("cSOV2", "cSOV2", 18, TOTAL_SUPPLY);

        /// Staking Modules
        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(SOV.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        feeSharingCollectorProxy = await FeeSharingCollectorProxy.new(
            ZERO_ADDRESS,
            staking.address
        );

        vestingLogic = await VestingLogic.new();
        vestingFactory = await VestingFactory.new(vestingLogic.address);
        vestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            SOV.address,
            [cSOV1.address, cSOV2.address],
            pricsSats,
            staking.address,
            feeSharingCollectorProxy.address,
            account1
        );
        vestingFactory.transferOwnership(vestingRegistry.address);
    }

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
    });

    beforeEach(async () => {
        /// @dev Only some tests really require an initial redeployment
        // await loadFixture(deploymentAndInitFixture);
    });

    describe("constructor", () => {
        it("sets the expected values", async () => {
            await loadFixture(deploymentAndInitFixture);

            let _sov = await vestingRegistry.SOV();
            let _CSOV1 = await vestingRegistry.CSOVtokens(0);
            let _CSOV2 = await vestingRegistry.CSOVtokens(1);
            let _stacking = await vestingRegistry.staking();
            let _feeSharingCollectorProxy = await vestingRegistry.feeSharingCollector();
            let _vestingOwner = await vestingRegistry.vestingOwner();

            expect(_sov).equal(SOV.address);
            expect(_CSOV1).equal(cSOV1.address);
            expect(_CSOV2).equal(cSOV2.address);
            expect(_stacking).equal(staking.address);
            expect(_feeSharingCollectorProxy).equal(feeSharingCollectorProxy.address);
            expect(_vestingOwner).equal(account1);
        });

        it("fails if the 0 address is passed as vestingFactory address", async () => {
            await expectRevert(
                VestingRegistry.new(
                    ZERO_ADDRESS,
                    SOV.address,
                    [cSOV1.address, cSOV2.address],
                    pricsSats,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1
                ),
                "vestingFactory address invalid"
            );
        });

        it("fails if the 0 address is passed as SOV address", async () => {
            await expectRevert(
                VestingRegistry.new(
                    vestingFactory.address,
                    ZERO_ADDRESS,
                    [cSOV1.address, cSOV2.address],
                    pricsSats,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1
                ),
                "SOV address invalid"
            );
        });

        it("fails if the 0 address is passed as cSOV address", async () => {
            await expectRevert(
                VestingRegistry.new(
                    vestingFactory.address,
                    SOV.address,
                    [cSOV1.address, cSOV2.address, ZERO_ADDRESS],
                    pricsSats,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1
                ),
                "CSOV address invalid"
            );
        });

        it("fails if the 0 address is passed as staking address", async () => {
            await expectRevert(
                VestingRegistry.new(
                    vestingFactory.address,
                    SOV.address,
                    [cSOV1.address, cSOV2.address],
                    pricsSats,
                    ZERO_ADDRESS,
                    feeSharingCollectorProxy.address,
                    account1
                ),
                "staking address invalid"
            );
        });

        it("fails if the 0 address is passed as feeSharingCollectorProxy address", async () => {
            await expectRevert(
                VestingRegistry.new(
                    vestingFactory.address,
                    SOV.address,
                    [cSOV1.address, cSOV2.address],
                    pricsSats,
                    staking.address,
                    ZERO_ADDRESS,
                    account1
                ),
                "feeSharingCollector address invalid"
            );
        });

        it("fails if the 0 address is passed as vestingOwner address", async () => {
            await expectRevert(
                VestingRegistry.new(
                    vestingFactory.address,
                    SOV.address,
                    [cSOV1.address, cSOV2.address],
                    pricsSats,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    ZERO_ADDRESS
                ),
                "vestingOwner address invalid"
            );
        });
    });

    describe("setVestingFactory", () => {
        it("sets vesting factory", async () => {
            await vestingRegistry.setVestingFactory(account2);

            let vestingFactory = await vestingRegistry.vestingFactory();
            expect(vestingFactory).equal(account2);
        });

        it("fails if the 0 address is passed", async () => {
            await expectRevert(
                vestingRegistry.setVestingFactory(ZERO_ADDRESS),
                "vestingFactory address invalid"
            );
        });

        it("fails if sender isn't an owner", async () => {
            await expectRevert(
                vestingRegistry.setVestingFactory(account2, { from: account2 }),
                "unauthorized"
            );
        });
    });

    describe("addAdmin", () => {
        it("adds admin", async () => {
            let tx = await vestingRegistry.addAdmin(account1);

            expectEvent(tx, "AdminAdded", {
                admin: account1,
            });

            let isAdmin = await vestingRegistry.admins(account1);
            expect(isAdmin).equal(true);
        });

        it("fails sender isn't an owner", async () => {
            await expectRevert(
                vestingRegistry.addAdmin(account1, { from: account1 }),
                "unauthorized"
            );
        });
    });

    describe("removeAdmin", () => {
        it("adds admin", async () => {
            await vestingRegistry.addAdmin(account1);
            let tx = await vestingRegistry.removeAdmin(account1);

            expectEvent(tx, "AdminRemoved", {
                admin: account1,
            });

            let isAdmin = await vestingRegistry.admins(account1);
            expect(isAdmin).equal(false);
        });

        it("fails sender isn't an owner", async () => {
            await expectRevert(
                vestingRegistry.removeAdmin(account1, { from: account1 }),
                "unauthorized"
            );
        });
    });

    describe("setCSOVtokens", () => {
        it("sets the expected values", async () => {
            await vestingRegistry.setCSOVtokens([account2, account3]);

            let _CSOV1 = await vestingRegistry.CSOVtokens(0);
            let _CSOV2 = await vestingRegistry.CSOVtokens(1);

            expect(_CSOV1).equal(account2);
            expect(_CSOV2).equal(account3);
        });

        it("fails if the 0 address is passed as cSOV address", async () => {
            await expectRevert(
                vestingRegistry.setCSOVtokens([cSOV1.address, cSOV2.address, ZERO_ADDRESS]),
                "CSOV address invalid"
            );
        });

        it("fails if sender isn't an owner", async () => {
            await expectRevert(
                vestingRegistry.setCSOVtokens([cSOV1.address, cSOV2.address], { from: account2 }),
                "unauthorized"
            );
        });
    });

    describe("transferSOV", () => {
        it("should be able to transfer SOV", async () => {
            let amount = new BN(1000);
            await SOV.transfer(vestingRegistry.address, amount);

            let balanceBefore = await SOV.balanceOf(account1);
            await vestingRegistry.transferSOV(account1, amount);
            let balanceAfter = await SOV.balanceOf(account1);

            expect(amount).to.be.bignumber.equal(balanceAfter.sub(balanceBefore));
        });

        it("only owner should be able to transfer", async () => {
            await expectRevert(
                vestingRegistry.transferSOV(account1, 1000, { from: account1 }),
                "unauthorized"
            );
        });

        it("fails if the 0 address is passed as receiver address", async () => {
            await expectRevert(
                vestingRegistry.transferSOV(ZERO_ADDRESS, 1000),
                "receiver address invalid"
            );
        });

        it("fails if the 0 is passed as an amount", async () => {
            await expectRevert(vestingRegistry.transferSOV(account1, 0), "amount invalid");
        });
    });

    describe("setBlacklistFlag", () => {
        it("should be able to add user to blacklist", async () => {
            await vestingRegistry.setBlacklistFlag(account2, true);

            let blacklisted = await vestingRegistry.blacklist(account2);
            expect(blacklisted).equal(true);
        });

        it("fails if the 0 address is passed", async () => {
            await expectRevert(
                vestingRegistry.setBlacklistFlag(ZERO_ADDRESS, true),
                "account address invalid"
            );
        });
    });

    describe("setLockedAmount", () => {
        it("should be able to set locked amount", async () => {
            let amount = new BN(123);
            await vestingRegistry.setLockedAmount(account2, amount);

            let lockedAmount = await vestingRegistry.lockedAmount(account2);
            expect(lockedAmount).to.be.bignumber.equal(amount);
        });

        it("fails if the 0 address is passed", async () => {
            await expectRevert(
                vestingRegistry.setLockedAmount(ZERO_ADDRESS, 111),
                "account address invalid"
            );
        });

        it("fails if the 0 amount is passed", async () => {
            await expectRevert(vestingRegistry.setLockedAmount(account2, 0), "amount invalid");
        });
    });

    describe("createVesting", () => {
        it("should be able to create vesting", async () => {
            /// @dev This test requires a hard reset of init fixture
            await deploymentAndInitFixture();

            let amount = new BN(1000000);
            await SOV.transfer(vestingRegistry.address, amount);

            let cliff = FOUR_WEEKS;
            let duration = FOUR_WEEKS.mul(new BN(20));
            let tx = await vestingRegistry.createVesting(account2, amount, cliff, duration);
            let vestingAddress = await vestingRegistry.getVesting(account2);
            await vestingRegistry.stakeTokens(vestingAddress, amount);

            expectEvent(tx, "VestingCreated", {
                tokenOwner: account2,
                vesting: vestingAddress,
                cliff: cliff,
                duration: duration,
                amount: amount,
            });

            let balance = await SOV.balanceOf(vestingRegistry.address);
            expect(balance.toString()).equal("0");

            let vesting = await VestingLogic.at(vestingAddress);
            await checkVesting(vesting, account2, cliff, duration, amount);

            let proxy = await UpgradableProxy.at(vestingAddress);
            await expectRevert(proxy.setImplementation(account2), "revert");
        });

        it("fails if vestingRegistry doesn't have enough SOV", async () => {
            let amount = new BN(1000000);
            let cliff = FOUR_WEEKS;
            let duration = FOUR_WEEKS.mul(new BN(20));

            await vestingRegistry.createVesting(account2, amount, cliff, duration);
            let vestingAddress = await vestingRegistry.getVesting(account2);

            await expectRevert(
                vestingRegistry.stakeTokens(vestingAddress, amount),
                "ERC20: transfer amount exceeds balance"
            );
        });

        it("fails if sender is not an owner or admin", async () => {
            let amount = new BN(1000000);
            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;

            await expectRevert(
                vestingRegistry.createVesting(account2, amount, cliff, duration, {
                    from: account1,
                }),
                "unauthorized"
            );

            await vestingRegistry.addAdmin(account1);
            await vestingRegistry.createVesting(account2, amount, cliff, duration, {
                from: account1,
            });
        });
    });

    describe("createTeamVesting", () => {
        it("should be able to create vesting", async () => {
            /// @dev This test requires a hard reset of init fixture
            await deploymentAndInitFixture();

            let amount = new BN(1000000);
            await SOV.transfer(vestingRegistry.address, amount);

            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;
            let tx = await vestingRegistry.createTeamVesting(account2, amount, cliff, duration);
            let vestingAddress = await vestingRegistry.getTeamVesting(account2);
            let tx2 = await vestingRegistry.stakeTokens(vestingAddress, amount);

            console.log("\ngasUsed = " + tx.receipt.gasUsed);
            console.log("gasUsed = " + tx2.receipt.gasUsed);

            expectEvent(tx, "TeamVestingCreated", {
                tokenOwner: account2,
                vesting: vestingAddress,
                cliff: cliff,
                duration: duration,
                amount: amount,
            });

            let balance = await SOV.balanceOf(vestingRegistry.address);
            expect(balance.toString()).equal("0");

            let vesting = await VestingLogic.at(vestingAddress);
            await checkVesting(vesting, account2, cliff, duration, amount);

            let proxy = await UpgradableProxy.at(vestingAddress);
            await expectRevert(proxy.setImplementation(account2), "revert");
        });

        it("fails if vestingRegistry doesn't have enough SOV", async () => {
            let amount = new BN(1000000);
            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;

            await vestingRegistry.createTeamVesting(account2, amount, cliff, duration);
            let vestingAddress = await vestingRegistry.getTeamVesting(account2);

            await expectRevert(
                vestingRegistry.stakeTokens(vestingAddress, amount),
                "ERC20: transfer amount exceeds balance"
            );
        });

        it("fails if sender is not an owner or admin", async () => {
            let amount = new BN(1000000);
            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;

            await expectRevert(
                vestingRegistry.createTeamVesting(account2, amount, cliff, duration, {
                    from: account1,
                }),
                "unauthorized"
            );

            await vestingRegistry.addAdmin(account1);
            await vestingRegistry.createTeamVesting(account2, amount, cliff, duration, {
                from: account1,
            });
        });
    });

    describe("stakeTokens", () => {
        it("fails if the 0 address is passed as vesting address", async () => {
            await expectRevert(
                vestingRegistry.stakeTokens(ZERO_ADDRESS, new BN(1000000)),
                "vesting address invalid"
            );
        });

        it("fails if the 0 address is passed as an amount", async () => {
            await expectRevert(vestingRegistry.stakeTokens(account1, 0), "amount invalid");
        });

        it("only owner or admin should be able to stake tokens", async () => {
            /// @dev This test requires a hard reset of init fixture
            await deploymentAndInitFixture();

            let amount = new BN(1000000);
            await SOV.transfer(vestingRegistry.address, amount);

            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;
            await vestingRegistry.createTeamVesting(account2, amount, cliff, duration);
            let vestingAddress = await vestingRegistry.getTeamVesting(account2);

            await expectRevert(
                vestingRegistry.stakeTokens(vestingAddress, new BN(1000000), { from: account1 }),
                "unauthorized"
            );

            await vestingRegistry.addAdmin(account1);
            await vestingRegistry.stakeTokens(vestingAddress, new BN(1000000), { from: account1 });
        });
    });

    describe("deposit funds", () => {
        it("should get budget and deposit", async () => {
            await deploymentAndInitFixture();

            // Check budget is 0
            let budget = await vestingRegistry.budget();
            // console.log("budget: " + budget);
            expect(budget).to.be.bignumber.equal(new BN(0));

            // Deposit funds
            const amount = web3.utils.toWei("3");
            await vestingRegistry.deposit({ from: accounts[1], value: amount });

            // Check budget is not 0
            budget = await vestingRegistry.budget();
            // console.log("budget: " + budget);
            expect(budget).to.be.bignumber.equal(amount);

            // Get recipient's balance before withdrawal
            let balance2before = await provider.getBalance(accounts[2]);
            // console.log("balance2before: " + balance2before);

            // Check budget after withdrawal
            await vestingRegistry.withdrawAll(accounts[2]);
            budget = await vestingRegistry.budget();
            // console.log("budget: " + budget);
            expect(budget).to.be.bignumber.equal(new BN(0));

            // Get recipient's balance after withdrawal
            let balance2after = await provider.getBalance(accounts[2]);
            // console.log("balance2after: " + balance2after);
            expect(balance2after.sub(balance2before)).to.be.equal(amount);
        });
    });

    async function checkVesting(vesting, account, cliff, duration, amount) {
        await mineBlock();

        let vestingBalance = await staking.balanceOf(vesting.address);
        expect(vestingBalance).to.be.bignumber.equal(amount);

        let accountVotes = await staking.getCurrentVotes(account);
        expect(accountVotes).to.be.not.equal(new BN(0));
        let vestingVotes = await staking.getCurrentVotes(vesting.address);
        expect(vestingVotes).to.be.bignumber.equal(new BN(0));

        let startDate = await vesting.startDate();
        let start = startDate.toNumber() + cliff.toNumber();
        let end = startDate.toNumber() + duration.toNumber();

        let numIntervals = Math.floor((end - start) / FOUR_WEEKS) + 1;
        let stakedPerInterval = Math.floor(amount / numIntervals);

        let stakeForFirstInterval = amount - stakedPerInterval * (numIntervals - 1);

        expect(await vesting.cliff()).to.be.bignumber.equal(cliff);
        expect(await vesting.duration()).to.be.bignumber.equal(duration);

        for (let i = start; i <= end; i += FOUR_WEEKS) {
            let lockedTS = await staking.timestampToLockDate(i);

            let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(
                vesting.address,
                lockedTS
            );
            let userStakingCheckpoints = await staking.userStakingCheckpoints(
                vesting.address,
                lockedTS,
                numUserStakingCheckpoints - 1
            );
            assert.equal(numUserStakingCheckpoints.toString(), "1");
            if (i === start) {
                assert.equal(userStakingCheckpoints.stake.toString(), stakeForFirstInterval);
            } else {
                assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);
            }

            let numDelegateStakingCheckpoints = await staking.numDelegateStakingCheckpoints(
                account,
                lockedTS
            );
            let delegateStakingCheckpoints = await staking.delegateStakingCheckpoints(
                account,
                lockedTS,
                numUserStakingCheckpoints - 1
            );
            assert.equal(parseInt(numDelegateStakingCheckpoints), 1);
            if (i === start) {
                assert.equal(delegateStakingCheckpoints.stake.toString(), stakeForFirstInterval);
            } else {
                assert.equal(delegateStakingCheckpoints.stake.toString(), stakedPerInterval);
            }
        }
    }
});
