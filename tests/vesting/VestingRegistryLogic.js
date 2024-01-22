const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const { mineBlock } = require("../Utils/Ethereum");
const { deployAndGetIStaking } = require("../Utils/initializer");

const StakingProxy = artifacts.require("StakingProxy");
const SOV_ABI = artifacts.require("SOV");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const UpgradableProxy = artifacts.require("UpgradableProxy");
const LockedSOV = artifacts.require("LockedSOV");
const VestingRegistry = artifacts.require("VestingRegistry");
const VestingRegistry2 = artifacts.require("VestingRegistry2");
const VestingRegistry3 = artifacts.require("VestingRegistry3");
const TestToken = artifacts.require("TestToken");

const FOUR_WEEKS = new BN(4 * 7 * 24 * 60 * 60);
const TEAM_VESTING_CLIFF = FOUR_WEEKS.mul(new BN(6));
const TEAM_VESTING_DURATION = FOUR_WEEKS.mul(new BN(36));
const TOTAL_SUPPLY = "100000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;
const pricsSats = "2500";

contract("VestingRegistryLogic", (accounts) => {
    let root, account1, account2, account3, account4;
    let SOV, lockedSOV;
    let staking, feeSharingCollectorProxy;
    let vesting, vestingFactory, vestingLogic, vestingRegistryLogic;
    let vestingRegistry, vestingRegistry2, vestingRegistry3;

    let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
    let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.

    before(async () => {
        [root, account1, account2, account3, accounts4, ...accounts] = accounts;
    });

    beforeEach(async () => {
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

        vestingRegistryLogic = await VestingRegistryLogic.new();
        vesting = await VestingRegistryProxy.new();
        await vesting.setImplementation(vestingRegistryLogic.address);
        vesting = await VestingRegistryLogic.at(vesting.address);
        vestingFactory.transferOwnership(vesting.address);

        lockedSOV = await LockedSOV.new(SOV.address, vesting.address, cliff, duration, [root]);
        await vesting.addAdmin(lockedSOV.address);

        vestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            SOV.address,
            [cSOV1.address, cSOV2.address],
            pricsSats,
            staking.address,
            feeSharingCollectorProxy.address,
            account1
        );

        vestingRegistry2 = await VestingRegistry2.new(
            vestingFactory.address,
            SOV.address,
            [cSOV1.address, cSOV2.address],
            pricsSats,
            staking.address,
            feeSharingCollectorProxy.address,
            account1
        );

        vestingRegistry3 = await VestingRegistry3.new(
            vestingFactory.address,
            SOV.address,
            staking.address,
            feeSharingCollectorProxy.address,
            account1
        );
    });

    describe("initialize", () => {
        it("fails if the 0 address is passed as vestingFactory address", async () => {
            await expectRevert(
                vesting.initialize(
                    ZERO_ADDRESS,
                    SOV.address,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1,
                    lockedSOV.address,
                    [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
                ),
                "vestingFactory address invalid"
            );
        });

        it("fails if the 0 address is passed as SOV address", async () => {
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    ZERO_ADDRESS,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1,
                    lockedSOV.address,
                    [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
                ),
                "SOV address invalid"
            );
        });

        it("fails if the 0 address is passed as staking address", async () => {
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    SOV.address,
                    ZERO_ADDRESS,
                    feeSharingCollectorProxy.address,
                    account1,
                    lockedSOV.address,
                    [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
                ),
                "staking address invalid"
            );
        });

        it("fails if the 0 address is passed as feeSharingCollectorProxy address", async () => {
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    SOV.address,
                    staking.address,
                    ZERO_ADDRESS,
                    account1,
                    lockedSOV.address,
                    [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
                ),
                "feeSharingCollector address invalid"
            );
        });

        it("fails if the 0 address is passed as vestingOwner address", async () => {
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    SOV.address,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    ZERO_ADDRESS,
                    lockedSOV.address,
                    [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
                ),
                "vestingOwner address invalid"
            );
        });

        it("fails if the 0 address is passed as LockedSOV address", async () => {
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    SOV.address,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1,
                    ZERO_ADDRESS,
                    [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
                ),
                "LockedSOV address invalid"
            );
        });

        it("fails if the 0 address is passed as VestingRegistry address", async () => {
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    SOV.address,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1,
                    lockedSOV.address,
                    [ZERO_ADDRESS, vestingRegistry2.address, vestingRegistry3.address]
                ),
                "Vesting registry address invalid"
            );
        });

        it("fails if the 0 address is passed as VestingRegistry2 address", async () => {
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    SOV.address,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1,
                    lockedSOV.address,
                    [vestingRegistry.address, ZERO_ADDRESS, vestingRegistry3.address]
                ),
                "Vesting registry address invalid"
            );
        });

        it("fails if the 0 address is passed as VestingRegistry3 address", async () => {
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    SOV.address,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1,
                    lockedSOV.address,
                    [vestingRegistry.address, vestingRegistry2.address, ZERO_ADDRESS]
                ),
                "Vesting registry address invalid"
            );
        });

        it("sets the expected values", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let _sov = await vesting.SOV();
            let _staking = await vesting.staking();
            let _feeSharingCollectorProxy = await vesting.feeSharingCollector();
            let _vestingOwner = await vesting.vestingOwner();

            expect(_sov).equal(SOV.address);
            expect(_staking).equal(staking.address);
            expect(_feeSharingCollectorProxy).equal(feeSharingCollectorProxy.address);
            expect(_vestingOwner).equal(account1);
        });

        it("fails if initialize is called twice", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );
            await expectRevert(
                vesting.initialize(
                    vestingFactory.address,
                    SOV.address,
                    staking.address,
                    feeSharingCollectorProxy.address,
                    account1,
                    lockedSOV.address,
                    [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
                ),
                "contract is already initialized"
            );
        });
    });

    describe("setVestingFactory", () => {
        it("sets vesting factory", async () => {
            await vesting.setVestingFactory(account2);

            let vestingFactory = await vesting.vestingFactory();
            expect(vestingFactory).equal(account2);
        });

        it("fails if the 0 address is passed", async () => {
            await expectRevert(
                vesting.setVestingFactory(ZERO_ADDRESS),
                "vestingFactory address invalid"
            );
        });

        it("fails if sender isn't an owner", async () => {
            await expectRevert(
                vesting.setVestingFactory(account2, { from: account2 }),
                "unauthorized"
            );
        });
    });

    describe("addAdminManager", () => {
        it("add adminManager", async () => {
            const owner = root;
            const newAdminManager = accounts[5];
            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
            let tx = await vesting.setAdminManager(newAdminManager, { from: owner });

            expectEvent(tx, "AdminManagerChanged", {
                sender: owner,
                oldAdminManager: ZERO_ADDRESS,
                newAdminManager: newAdminManager,
            });

            expect(await vesting.getAdminManager()).to.equal(newAdminManager);
        });

        it("add adminManager should revert if try to set 0 address", async () => {
            const owner = root;
            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
            await expectRevert(
                vesting.setAdminManager(ZERO_ADDRESS, { from: owner }),
                "invalid admin manager"
            );
            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
        });

        it("fails sender isn't an owner", async () => {
            await expectRevert(
                vesting.setAdminManager(account1, { from: account1 }),
                "unauthorized"
            );
        });
    });

    describe("removeAdminManager", () => {
        it("remove adminManager", async () => {
            const owner = root;
            const newAdminManager = accounts[5];
            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
            let tx = await vesting.setAdminManager(newAdminManager, { from: owner });
            expectEvent(tx, "AdminManagerChanged", {
                sender: owner,
                oldAdminManager: ZERO_ADDRESS,
                newAdminManager: newAdminManager,
            });

            /** remove admin manager */
            tx = await vesting.removeAdminManager({ from: owner });

            expectEvent(tx, "AdminManagerRemoved", {
                sender: owner,
                removedAdminManager: newAdminManager,
            });

            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
        });

        it("remove adminManager should revert if admin manager is not set yet", async () => {
            const owner = root;
            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);

            /** remove admin manager */
            await expectRevert(
                vesting.removeAdminManager({ from: owner }),
                "Admin manager is not set"
            );

            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
        });

        it("fails sender isn't an owner", async () => {
            const newAdminManager = accounts[5];
            await expectRevert(vesting.removeAdminManager({ from: account1 }), "unauthorized");
        });
    });

    describe("addAdmin", () => {
        it("adds admin by owner", async () => {
            let tx = await vesting.addAdmin(account1);

            expectEvent(tx, "AdminAdded", {
                admin: account1,
            });

            let isAdmin = await vesting.admins(account1);
            expect(isAdmin).equal(true);
        });

        it("adds admin by adminManager", async () => {
            const owner = root;
            const newAdminManager = accounts[5];
            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
            let tx = await vesting.setAdminManager(newAdminManager, { from: owner });

            expectEvent(tx, "AdminManagerChanged", {
                sender: owner,
                oldAdminManager: ZERO_ADDRESS,
                newAdminManager: newAdminManager,
            });

            expect(await vesting.getAdminManager()).to.equal(newAdminManager);
            tx = await vesting.addAdmin(account1, { from: newAdminManager });

            expectEvent(tx, "AdminAdded", {
                admin: account1,
            });

            let isAdmin = await vesting.admins(account1);
            expect(isAdmin).equal(true);
        });

        it("fails sender is non-authorized address (owner or adminManager)", async () => {
            await expectRevert(vesting.addAdmin(account1, { from: account1 }), "unauthorized");
        });
    });

    describe("removeAdmin", () => {
        it("removes admin by owner", async () => {
            await vesting.addAdmin(account1);
            let tx = await vesting.removeAdmin(account1);

            expectEvent(tx, "AdminRemoved", {
                admin: account1,
            });

            let isAdmin = await vesting.admins(account1);
            expect(isAdmin).equal(false);
        });

        it("removes admin by adminManager", async () => {
            const owner = root;
            const newAdminManager = accounts[5];
            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
            let tx = await vesting.setAdminManager(newAdminManager, { from: owner });

            expectEvent(tx, "AdminManagerChanged", {
                sender: owner,
                oldAdminManager: ZERO_ADDRESS,
                newAdminManager: newAdminManager,
            });

            expect(await vesting.getAdminManager()).to.equal(newAdminManager);

            await vesting.addAdmin(account1, { from: owner });
            tx = await vesting.removeAdmin(account1, { from: owner });

            expectEvent(tx, "AdminRemoved", {
                admin: account1,
            });

            let isAdmin = await vesting.admins(account1);
            expect(isAdmin).equal(false);
        });

        it("fails sender is non-authorized address (owner or adminManager)", async () => {
            await expectRevert(vesting.removeAdmin(account1, { from: account1 }), "unauthorized");
        });
    });

    describe("transferSOV", () => {
        it("should be able to transfer SOV", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000);
            await SOV.transfer(vesting.address, amount);
            let balanceBefore = await SOV.balanceOf(account1);
            let tx = await vesting.transferSOV(account1, amount);
            expectEvent(tx, "SOVTransferred", {
                receiver: account1,
                amount: amount,
            });
            let balanceAfter = await SOV.balanceOf(account1);

            expect(amount).to.be.bignumber.equal(balanceAfter.sub(balanceBefore));
        });

        it("only owner should be able to transfer", async () => {
            await expectRevert(
                vesting.transferSOV(account1, 1000, { from: account1 }),
                "unauthorized"
            );
        });

        it("fails if the 0 address is passed as receiver address", async () => {
            await expectRevert(
                vesting.transferSOV(ZERO_ADDRESS, 1000),
                "receiver address invalid"
            );
        });

        it("fails if the 0 is passed as an amount", async () => {
            await expectRevert(vesting.transferSOV(account1, 0), "amount invalid");
        });
    });

    describe("createVesting", () => {
        it("should be able to create vesting - Bug Bounty", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            await SOV.transfer(vesting.address, amount);

            let cliff = FOUR_WEEKS;
            let duration = FOUR_WEEKS.mul(new BN(20));
            let vestingType = new BN(1); // normal vesting
            let vestingCreationType = new BN(3); //Bug Bounty
            let tx = await vesting.createVestingAddr(
                account2,
                amount,
                cliff,
                duration,
                vestingCreationType
            );
            let vestingAddress = await vesting.getVestingAddr(
                account2,
                cliff,
                duration,
                vestingCreationType
            );
            expect(await vesting.isVestingAddress(vestingAddress)).equal(true);

            let vestingCreationAndType = await vesting.vestingCreationAndTypes(vestingAddress);
            expect(await vestingCreationAndType["isSet"]).to.equal(true);
            expect(await vestingCreationAndType["vestingType"].toString()).to.equal(
                vestingType.toString()
            );
            expect(await vestingCreationAndType["vestingCreationType"].toString()).to.equal(
                vestingCreationType.toString()
            );
            expect(await vesting.isTeamVesting(vestingAddress)).to.equal(false);

            await vesting.stakeTokens(vestingAddress, amount);

            expectEvent(tx, "VestingCreated", {
                tokenOwner: account2,
                vesting: vestingAddress,
                cliff: cliff,
                duration: duration,
                amount: amount,
                vestingCreationType: vestingCreationType,
            });

            let balance = await SOV.balanceOf(vesting.address);
            expect(balance.toString()).equal("0");

            let vestingAddr = await VestingLogic.at(vestingAddress);
            await checkVesting(vestingAddr, account2, cliff, duration, amount);

            let proxy = await UpgradableProxy.at(vestingAddress);
            await expectRevert(proxy.setImplementation(account2), "revert");
        });

        it("should be able to create vesting - Team Salary", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            await SOV.transfer(vesting.address, amount);

            let cliff = FOUR_WEEKS;
            let duration = FOUR_WEEKS.mul(new BN(20));
            let vestingType = new BN(3); //Team Salary
            let tx = await vesting.createVestingAddr(
                account2,
                amount,
                cliff,
                duration,
                vestingType
            );
            let vestingAddress = await vesting.getVestingAddr(
                account2,
                cliff,
                duration,
                vestingType
            );
            expect(await vesting.isVestingAddress(vestingAddress)).equal(true);
            await vesting.stakeTokens(vestingAddress, amount);

            expectEvent(tx, "VestingCreated", {
                tokenOwner: account2,
                vesting: vestingAddress,
                cliff: cliff,
                duration: duration,
                amount: amount,
                vestingCreationType: vestingType,
            });

            let balance = await SOV.balanceOf(vesting.address);
            expect(balance.toString()).equal("0");

            let vestingAddr = await VestingLogic.at(vestingAddress);
            await checkVesting(vestingAddr, account2, cliff, duration, amount);

            let proxy = await UpgradableProxy.at(vestingAddress);
            await expectRevert(proxy.setImplementation(account2), "revert");
        });

        it("fails if vestingRegistryLogic doesn't have enough SOV", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            let cliff = FOUR_WEEKS;
            let duration = FOUR_WEEKS.mul(new BN(20));
            let vestingType = new BN(3); //Team Salary

            await vesting.createVestingAddr(account2, amount, cliff, duration, vestingType);
            let vestingAddress = await vesting.getVestingAddr(
                account2,
                cliff,
                duration,
                vestingType
            );

            await expectRevert(
                vesting.stakeTokens(vestingAddress, amount),
                "ERC20: transfer amount exceeds balance"
            );
        });

        it("fails if sender is not an owner or admin", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;
            let vestingType = new BN(3); //Team Salary

            await expectRevert(
                vesting.createVestingAddr(account2, amount, cliff, duration, vestingType, {
                    from: account1,
                }),
                "unauthorized"
            );

            await vesting.addAdmin(account1);
            await vesting.createVestingAddr(account2, amount, cliff, duration, vestingType, {
                from: account1,
            });
        });

        it("fails if sender is not an owner or admin (added the admin by adminManager", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;
            let vestingType = new BN(3); //Team Salary

            await expectRevert(
                vesting.createVestingAddr(account2, amount, cliff, duration, vestingType, {
                    from: account1,
                }),
                "unauthorized"
            );

            const owner = root;
            const newAdminManager = accounts[5];
            expect(await vesting.getAdminManager()).to.equal(ZERO_ADDRESS);
            await vesting.setAdminManager(newAdminManager, { from: owner });
            await vesting.addAdmin(account1, { from: newAdminManager });
            await vesting.createVestingAddr(account2, amount, cliff, duration, vestingType, {
                from: account1,
            });
        });
    });

    describe("createVesting and getVesting - LockedSOV", () => {
        it("Should create vesting and return the address for LockedSOV", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            await SOV.transfer(vesting.address, amount);
            await lockedSOV.createVesting({ from: accounts4 });
            let vestingAddr = await vesting.getVesting(accounts4);

            let vestingCreationAndType = await vesting.vestingCreationAndTypes(vestingAddr);
            let vestingType = new BN(1); // normal vesting
            let vestingCreationType = new BN(3);
            expect(await vestingCreationAndType["isSet"]).to.equal(true);
            expect(await vestingCreationAndType["vestingType"].toString()).to.equal(
                vestingType.toString()
            );
            expect(await vestingCreationAndType["vestingCreationType"].toString()).to.equal(
                vestingCreationType.toString()
            );
            expect(await vesting.isTeamVesting(vestingAddr)).to.equal(false);

            expect(await vesting.isVestingAddress(vestingAddr)).equal(true);
            assert.notEqual(vestingAddr, ZERO_ADDRESS, "Vesting Address should not be zero.");
        });
    });

    describe("createTeamVesting", () => {
        it("should be able to create team vesting", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            await SOV.transfer(vesting.address, amount);

            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;
            let vestingType = new BN(0); //TeamVesting
            let vestingCreationType = new BN(3); //Team Salary
            let tx = await vesting.createTeamVesting(
                account2,
                amount,
                cliff,
                duration,
                vestingCreationType
            );
            let vestingAddress = await vesting.getTeamVesting(
                account2,
                cliff,
                duration,
                vestingCreationType
            );
            let vestingCreationAndType = await vesting.vestingCreationAndTypes(vestingAddress);
            expect(await vestingCreationAndType["isSet"]).to.equal(true);
            expect(await vesting.isVestingAddress(vestingAddress)).equal(true);
            expect(await vestingCreationAndType["vestingType"].toString()).to.equal(
                vestingType.toString()
            );
            expect(await vestingCreationAndType["vestingCreationType"].toString()).to.equal(
                vestingCreationType.toString()
            );
            expect(await vesting.isTeamVesting(vestingAddress)).to.equal(true);
            expectEvent(tx, "TeamVestingCreated", {
                tokenOwner: account2,
                vesting: vestingAddress,
                cliff: cliff,
                duration: duration,
                amount: amount,
                vestingCreationType: vestingCreationType,
            });
            let tx2 = await vesting.stakeTokens(vestingAddress, amount);
            expectEvent(tx2, "TokensStaked", {
                vesting: vestingAddress,
                amount: amount,
            });
            let balance = await SOV.balanceOf(vestingRegistryLogic.address);
            expect(balance.toString()).equal("0");

            let vestingAddr = await VestingLogic.at(vestingAddress);
            await checkVesting(vestingAddr, account2, cliff, duration, amount);

            let proxy = await UpgradableProxy.at(vestingAddress);
            await expectRevert(proxy.setImplementation(account2), "revert");
        });

        it("fails if vestingRegistryLogic doesn't have enough SOV", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;
            let vestingType = new BN(3); //Team Salary

            await vesting.createTeamVesting(account2, amount, cliff, duration, vestingType);
            let vestingAddress = await vesting.getTeamVesting(
                account2,
                cliff,
                duration,
                vestingType
            );

            await expectRevert(
                vesting.stakeTokens(vestingAddress, amount),
                "ERC20: transfer amount exceeds balance"
            );
        });

        it("fails if sender is not an owner or admin", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;
            let vestingType = new BN(3); //Team Salary

            await expectRevert(
                vesting.createTeamVesting(account2, amount, cliff, duration, vestingType, {
                    from: account1,
                }),
                "unauthorized"
            );

            await vesting.addAdmin(account1);
            await vesting.createTeamVesting(account2, amount, cliff, duration, vestingType, {
                from: account1,
            });
        });
    });

    describe("stakeTokens", () => {
        it("fails if the 0 address is passed as vesting address", async () => {
            await expectRevert(
                vesting.stakeTokens(ZERO_ADDRESS, new BN(1000000)),
                "vesting address invalid"
            );
        });

        it("fails if the 0 address is passed as an amount", async () => {
            await expectRevert(vesting.stakeTokens(account1, 0), "amount invalid");
        });

        it("only owner or admin should be able to stake tokens", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            await SOV.transfer(vesting.address, amount);

            let cliff = TEAM_VESTING_CLIFF;
            let duration = TEAM_VESTING_DURATION;
            let vestingType = new BN(3); //Team Salary
            await vesting.createTeamVesting(account2, amount, cliff, duration, vestingType);
            let vestingAddress = await vesting.getTeamVesting(
                account2,
                cliff,
                duration,
                vestingType
            );

            await expectRevert(
                vesting.stakeTokens(vestingAddress, new BN(1000000), { from: account1 }),
                "unauthorized"
            );

            await vesting.addAdmin(account1);
            await vesting.stakeTokens(vestingAddress, new BN(1000000), { from: account1 });
        });
    });

    describe("getVestingsOf", () => {
        it("gets vesting of a user", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            await SOV.transfer(vesting.address, amount);

            //Vesting
            let cliff = FOUR_WEEKS;
            let duration = FOUR_WEEKS.mul(new BN(20));
            let vestingType = new BN(2); //Bug Bounty
            await vesting.createVestingAddr(account2, amount, cliff, duration, vestingType);

            //TeamVesting
            let teamCliff = TEAM_VESTING_CLIFF;
            let teamDuration = TEAM_VESTING_DURATION;
            vestingType = new BN(3); //Team Salary
            await vesting.createTeamVesting(
                account2,
                amount,
                teamCliff,
                teamDuration,
                vestingType
            );

            let vestingAddresses = await vesting.getVestingsOf(account2);
            assert.equal(vestingAddresses.length.toString(), "2");
            assert.equal(vestingAddresses[0].vestingCreationType, "2");
            assert.equal(vestingAddresses[1].vestingCreationType, "3");
        });
    });

    describe("getVestingDetails", () => {
        it("gets cliff, duration and amount for vesting address", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            await SOV.transfer(vesting.address, amount);

            //Vesting
            let cliff = FOUR_WEEKS;
            let duration = FOUR_WEEKS.mul(new BN(20));
            let vestingType = new BN(2); //Bug Bounty
            await vesting.createVestingAddr(account2, amount, cliff, duration, vestingType);
            let vestingAddr = await vesting.getVestingAddr(account2, cliff, duration, vestingType);
            let fields = await vesting.getVestingDetails(vestingAddr);
            expect(cliff).to.be.bignumber.equal(fields.cliff);
            expect(duration).to.be.bignumber.equal(fields.duration);
        });

        it("gets cliff, duration and amount for team vesting address", async () => {
            await vesting.initialize(
                vestingFactory.address,
                SOV.address,
                staking.address,
                feeSharingCollectorProxy.address,
                account1,
                lockedSOV.address,
                [vestingRegistry.address, vestingRegistry2.address, vestingRegistry3.address]
            );

            let amount = new BN(1000000);
            await SOV.transfer(vesting.address, amount);

            //TeamVesting
            let teamCliff = TEAM_VESTING_CLIFF;
            let teamDuration = TEAM_VESTING_DURATION;
            let vestingType = new BN(3); //Team Salary
            await vesting.createTeamVesting(
                account2,
                amount,
                teamCliff,
                teamDuration,
                vestingType
            );
            let vestingAddr = await vesting.getTeamVesting(
                account2,
                teamCliff,
                teamDuration,
                vestingType
            );
            let fields = await vesting.getVestingDetails(vestingAddr);
            expect(teamCliff).to.be.bignumber.equal(fields.cliff);
            expect(teamDuration).to.be.bignumber.equal(fields.duration);
        });
    });

    describe("isVestingAddress", () => {
        it("should return false if the address isn't a vesting address", async () => {
            expect(await vesting.isVestingAddress(account1)).equal(false);
        });
    });

    describe("registerVestingToVestingCreationAndTypes", () => {
        it("isTeamVesting should return false for unregistered vesting", async () => {
            expect(await vesting.isTeamVesting(account2)).to.equal(false);
            let vestingCreationAndType = await vesting.vestingCreationAndTypes(account2);
            expect(await vestingCreationAndType["isSet"]).to.equal(false);
            expect((await vestingCreationAndType["vestingType"]).toString()).to.equal(
                new BN(0).toString()
            );
            expect((await vestingCreationAndType["vestingCreationType"]).toString()).to.equal(
                new BN(0).toString()
            );
        });

        it("fails if sender isn't the owner", async () => {
            const sampleVesting = account2;
            const vestingType = new BN(0); // TeamVesting
            const vestingCreationType = new BN(3);
            const vestingCreationAndTypes = {
                isSet: true,
                vestingType: vestingType.toString(),
                vestingCreationType: vestingCreationType.toString(),
            };
            await expectRevert(
                vesting.registerVestingToVestingCreationAndTypes(
                    [sampleVesting],
                    [vestingCreationAndTypes],
                    { from: account2 }
                ),
                "unauthorized"
            );
            expect(await vesting.isTeamVesting(account2)).to.equal(false);
        });

        it("should be able to registerVestingToVestingCreationAndTypes (Team Vesting)", async () => {
            const sampleVesting = account2;
            const vestingType = new BN(0); // TeamVesting
            const vestingCreationType = new BN(3);
            const vestingCreationAndTypes = {
                isSet: true,
                vestingType: vestingType.toString(),
                vestingCreationType: vestingCreationType.toString(),
            };
            await vesting.registerVestingToVestingCreationAndTypes(
                [sampleVesting],
                [vestingCreationAndTypes]
            );

            let vestingCreationAndType = await vesting.vestingCreationAndTypes(sampleVesting);
            expect(await vestingCreationAndType["isSet"]).to.equal(true);
            expect(await vestingCreationAndType["vestingType"].toString()).to.equal(
                vestingType.toString()
            );
            expect(await vestingCreationAndType["vestingCreationType"].toString()).to.equal(
                vestingCreationType.toString()
            );
            expect(await vesting.isTeamVesting(sampleVesting)).to.equal(true);
        });

        it("should be able to registerVestingToVestingCreationAndTypes (Normal Vesting)", async () => {
            const sampleVesting = account2;
            const vestingType = new BN(1); // Normal vesting
            const vestingCreationType = new BN(3);
            const vestingCreationAndTypes = {
                isSet: true,
                vestingType: vestingType.toString(),
                vestingCreationType: vestingCreationType.toString(),
            };
            await vesting.registerVestingToVestingCreationAndTypes(
                [sampleVesting],
                [vestingCreationAndTypes]
            );

            let vestingCreationAndType = await vesting.vestingCreationAndTypes(sampleVesting);
            expect(await vestingCreationAndType["isSet"]).to.equal(true);
            expect(await vestingCreationAndType["vestingType"].toString()).to.equal(
                vestingType.toString()
            );
            expect(await vestingCreationAndType["vestingCreationType"].toString()).to.equal(
                vestingCreationType.toString()
            );
            expect(await vesting.isTeamVesting(sampleVesting)).to.equal(false);
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
            assert.equal(numDelegateStakingCheckpoints, 1);
            if (i === start) {
                assert.equal(delegateStakingCheckpoints.stake.toString(), stakeForFirstInterval);
            } else {
                assert.equal(delegateStakingCheckpoints.stake.toString(), stakedPerInterval);
            }
        }
    }
});
