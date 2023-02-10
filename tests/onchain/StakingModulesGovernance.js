// const { expect } = require("chai");

const {
    loadFixture,
    impersonateAccount,
    stopImpersonatingAccount,
    mine,
    mineUpTo,
    time,
    setBalance,
    setCode,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const {
    ethers,
    deployments,
    deployments: { get, deploy },
    expect,
    getNamedAccounts,
} = require("hardhat");
// const { ethers } = hre;
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { createSIP0049 } = require("../../deployment/sip/sips.js");

const { ZERO_ADDRESS } = ethers.constants;

const { encodeParameters, etherMantissa, mineBlock, increaseTime } = require("../Utils/Ethereum");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("TimelockHarness");
const StakingProxy = artifacts.require("StakingProxy");

const LoanTokenSettings = artifacts.require("LoanTokenSettingsLowerAdmin");
const LoanToken = artifacts.require("LoanToken");

const { deployAndGetIStaking } = require("../Utils/initializer");

const QUORUM_VOTES = etherMantissa(4000000);

const TWO_DAYS = 86400 * 2;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const ONE_RBTC = ethers.utils.parseEther("1.0");

describe("Staking Modules Deployments and Upgrades via Governance", (accounts) => {
    let root, account1, account2, account3, account4;
    let SUSD, staking, gov, timelock, stakingProxy;
    let sovryn;
    // async function setupTest() {
    const setupTest = deployments.createFixture(async ({ deployments, getNamedAccounts }) => {
        const { deployer } = await getNamedAccounts();
        await setBalance(deployer, ONE_RBTC);
        await deployments.fixture(["StakingModules", "StakingModulesProxy"]); // ensure we start from a fresh deployments
        const stakingProxy = await ethers.getContract("StakingProxy", deployer);
        const stakingModulesProxy = await ethers.getContract("StakingModulesProxy", deployer);

        // problem: we want to execute a proposal without voting
        // and any func call
        // - deploy mock GovernorOwner and setCode to existing address
        // - deploy mock timelockOwner
        // const multisigSigner = await ethers.getImpersonatedSigner((await get("MultiSigWallet")).address);
        const msdeploy = await get("MultiSigWallet");
        const multisigSigner = await ethers.getImpersonatedSigner(msdeploy.address);
        const governorOwner = await ethers.getContract("GovernorOwner", multisigSigner);
        await setBalance(multisigSigner.address, ONE_RBTC);
        const governorOwnerSigner = await ethers.getImpersonatedSigner(
            (
                await deployments.get("GovernorOwner")
            ).address
        );
        const timelockOwner = await ethers.getContract("TimelockOwner", governorOwnerSigner);

        const govMockTx = await (
            await deploy("GovernorOwnerMockup", {
                contract: "GovernorAlphaMockup",
                from: deployer,
                args: [timelockOwner.address, stakingProxy.address, deployer, 0, 0],
                log: true,
                skipIfAlreadyDeployed: true,
            })
        ).wait();

        await setCode(governorOwner.address, (await get("GovernorOwnerMockup")).deployedBytecode);

        const timelockMockTx = await (
            await deploy("TimelockOwnerMockup", {
                contract: "TimelockHarness",
                from: deployer,
                args: [timelockOwner.address, stakingProxy.address, deployer, 0, 0],
                log: true,
                skipIfAlreadyDeployed: true,
            })
        ).wait();

        await setCode(timelockOwner.address, (await get("TimelockOwnerMockup")).deployedBytecode);

        const timelockOwnerSigner = await ethers.getImpersonatedSigner(timelockOwner.address);
        await setBalance(timelockOwnerSigner.address, ONE_RBTC);

        //
        return {
            deployer,
            stakingProxy,
            stakingModulesProxy,
            governorOwner,
            timelockOwner,
            timelockOwnerSigner,
            multisigSigner,
        };
    });

    async function deployAndInitWithoutStakingModules(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        // Staking
        // Creating the Staking Instance (Staking Modules Interface).
        stakingProxy = await StakingProxy.new(SUSD.address);

        // Governor
        timelock = await Timelock.new(root, TWO_DAYS);
        gov = await GovernorAlpha.new(timelock.address, staking.address, root, 4, 0);
        await timelock.harnessSetAdmin(gov.address);

        // Settings
        loanTokenSettings = await LoanTokenSettings.new();
        loanToken = await LoanToken.new(
            root,
            loanTokenSettings.address,
            SUSD.address,
            SUSD.address
        );
        loanToken = await LoanTokenSettings.at(loanToken.address);
        await loanToken.transferOwnership(timelock.address);

        await sovryn.transferOwnership(timelock.address);
    }

    async function deploymentAndInitFixture(_wallets, _provider) {
        await deployAndInitWithoutStakingModules(_wallets, _provider);
        staking = await deployAndGetIStaking(stakingProxy.address);
    }

    let loadFixtureAfterEach = false;
    before(async () => {
        // [root, account1, account2, account3, account4, ...accounts] = accounts;
    });

    beforeEach(async () => {});
    afterEach(async () => {
        if (loadFixtureAfterEach) {
            await setupTest();
        }
    });

    describe("Staking Modules Onchain Testing", () => {
        it.only("SIP 0049 is executable", async () => {
            if (!hre.network.tags["forked"]) return;
            /*await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://mainnet.sovryn.app/rpc",
                            blockNumber: 5037475, // block num at the time of the test creation with no Staking refactored deployed yet
                        },
                    },
                ],
            });*/
            const sov1 = await ethers.getContract("SOV");
            console.log("SOV1:", sov1.address);
            const governorOwner1 = await ethers.getContract("GovernorOwner");
            console.log("governorOwner1:", governorOwner1.address);
            console.log("Multisig:", (await get("MultiSigWallet")).address);
            const {
                deployer,
                stakingProxy,
                stakingModulesProxy,
                governorOwner,
                timelockOwner,
                timelockOwnerSigner,
                multisigSigner,
            } = await setupTest();
            loadFixtureAfterEach = true;

            // CREATE PROPOSAL
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
            console.log("-1-");
            console.log(whaleAmount.toString());
            console.log("deployer:", deployer);
            console.log(sov.address);
            console.log(stakingProxy.address);
            await sov.mint(deployer, whaleAmount);
            console.log("-2-");
            await sov.approve(stakingProxy.address, quorumVotes);
            await staking.stake(whaleAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);
            await mine(10, { interval: 30 });
            const receipt = await createSIP0049();

            // await expect(receipt).to.emit(timelockOwner, "ProposalCreated");

            // EXECUTE PROPOSAL
            const delay = ethers.BigNumber.from(10);
            await timelock.setDelayWithoutChecking(delay);
            const quorumVotes = await governorOwner.quorumVotes();
            const kickoffTS = await stakingProxy.kickoffTS();
            let proposalId = await gov.latestProposalIds.call(deployer);

            const deployerSigner = await ethers.getSigner(deployer);
            await mine(1, { interval: 30 });
            await governorOwner.connect(deployerSigner).castVote(proposalId, true);

            await mine(10, { interval: 30 });
            await governorOwner.queue(proposalId);

            await increaseTime(TWO_DAYS);
            let tx = await governorOwner.execute(proposalId);

            expectEvent(tx, "ProposalExecuted", {
                id: proposalId,
            });
        });
    });

    describe("change settings", () => {
        it("Should be able to execute one action", async () => {
            let lendingFeePercentOld = etherMantissa(10).toString();
            let lendingFeePercentNew = etherMantissa(7).toString();

            let proposalData = {
                targets: [sovryn.address],
                values: [0],
                signatures: ["setLendingFeePercent(uint256)"],
                callDatas: [encodeParameters(["uint256"], [lendingFeePercentNew])],
                description: "change settings",
            };

            // old value
            let lendingFeePercent = await sovryn.lendingFeePercent.call();
            expect(lendingFeePercent.toString()).to.be.equal(lendingFeePercentOld);

            // make changes
            await executeProposal(proposalData);

            // new value
            lendingFeePercent = await sovryn.lendingFeePercent.call();
            expect(lendingFeePercent.toString()).to.be.equal(lendingFeePercentNew);
        });

        it("Should be able to execute one action without signature in the call data", async () => {
            let lendingFeePercentOld = etherMantissa(10).toString();
            let lendingFeePercentNew = etherMantissa(7).toString();

            let selector = web3.utils.keccak256("setLendingFeePercent(uint256)").substring(0, 10);
            let callData = encodeParameters(["uint256"], [lendingFeePercentNew]).replace(
                "0x",
                selector
            );

            let proposalData = {
                targets: [sovryn.address],
                values: [0],
                signatures: [""],
                callDatas: [callData],
                description: "change settings",
            };

            // old value
            let lendingFeePercent = await sovryn.lendingFeePercent.call();
            expect(lendingFeePercent.toString()).to.be.equal(lendingFeePercentOld);

            // make changes
            await executeProposal(proposalData);

            // new value
            lendingFeePercent = await sovryn.lendingFeePercent.call();
            expect(lendingFeePercent.toString()).to.be.equal(lendingFeePercentNew);
        });

        it("Should be able to execute three actions", async () => {
            let tradingFeePercentOld = etherMantissa(15, 1e16).toString();
            let tradingFeePercentNew = etherMantissa(9, 1e16).toString();

            let proposalData = {
                targets: [sovryn.address, sovryn.address /*, loanToken.address*/],
                values: [0, 0 /*, 0*/],
                signatures: [
                    "setTradingFeePercent(uint256)",
                    "setLoanPool(address[],address[])",
                    /*"setTransactionLimits(address[],uint256[])",*/
                ],
                callDatas: [
                    encodeParameters(["uint256"], [tradingFeePercentNew]),
                    encodeParameters(
                        ["address[]", "address[]"],
                        [
                            [account1, account2],
                            [account3, account4],
                        ]
                    ),
                    /*encodeParameters(
                        ["address[]", "uint256[]"],
                        [
                            [account1, account2],
                            [1111, 2222],
                        ]
                    ),*/
                ],
                description: "change settings",
            };

            // old values
            let tradingFeePercent = await sovryn.tradingFeePercent.call();
            expect(tradingFeePercent.toString()).to.be.equal(tradingFeePercentOld);

            expect(await sovryn.loanPoolToUnderlying.call(account1)).to.be.equal(ZERO_ADDRESS);
            expect(await sovryn.loanPoolToUnderlying.call(account2)).to.be.equal(ZERO_ADDRESS);
            expect(await sovryn.underlyingToLoanPool.call(account3)).to.be.equal(ZERO_ADDRESS);
            expect(await sovryn.underlyingToLoanPool.call(account4)).to.be.equal(ZERO_ADDRESS);

            // expect((await loanToken.transactionLimit.call(account1)).toNumber()).to.be.equal(0);
            // expect((await loanToken.transactionLimit.call(account2)).toNumber()).to.be.equal(0);

            // make changes
            await executeProposal(proposalData);

            // new values
            tradingFeePercent = await sovryn.tradingFeePercent.call();
            expect(tradingFeePercent.toString()).to.be.equal(tradingFeePercentNew);

            expect(await sovryn.loanPoolToUnderlying.call(account1)).to.be.equal(account3);
            expect(await sovryn.loanPoolToUnderlying.call(account2)).to.be.equal(account4);
            expect(await sovryn.underlyingToLoanPool.call(account3)).to.be.equal(account1);
            expect(await sovryn.underlyingToLoanPool.call(account4)).to.be.equal(account2);

            // expect((await loanToken.transactionLimit.call(account1)).toNumber()).to.be.equal(1111);
            // expect((await loanToken.transactionLimit.call(account2)).toNumber()).to.be.equal(2222);
        });

        it("Shouldn't be able to execute proposal using Timelock directly", async () => {
            await expectRevert(
                timelock.executeTransaction(ZERO_ADDRESS, "0", "", "0x", "0"),
                "Timelock::executeTransaction: Call must come from admin."
            );
        });
    });

    async function executeProposal(proposalData) {
        await SUSD.approve(staking.address, QUORUM_VOTES);
        let kickoffTS = await staking.kickoffTS.call();
        await staking.stake(QUORUM_VOTES, kickoffTS.add(MAX_DURATION), root, root);

        await gov.propose(
            proposalData.targets,
            proposalData.values,
            proposalData.signatures,
            proposalData.callDatas,
            proposalData.description
        );
        let proposalId = await gov.latestProposalIds.call(root);

        await mineBlock();
        await gov.castVote(proposalId, true);

        await advanceBlocks(10);
        await gov.queue(proposalId);

        await increaseTime(TWO_DAYS);
        let tx = await gov.execute(proposalId);

        expectEvent(tx, "ProposalExecuted", {
            id: proposalId,
        });
    }
});

async function advanceBlocks(number) {
    for (let i = 0; i < number; i++) {
        await mineBlock();
    }
}
