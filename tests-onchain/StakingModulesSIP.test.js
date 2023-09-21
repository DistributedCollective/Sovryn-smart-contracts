//@note hh test tests-onchain/StakingModulesSIP.test.js --network rskForkedMainnetFlashback

const {
    loadFixture,
    impersonateAccount,
    stopImpersonatingAccount,
    mine,
    time,
    setBalance,
    setCode,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

const {
    ethers,
    deployments,
    deployments: { createFixture, get, deploy },
    // expect,
    getNamedAccounts,
} = hre;
// const { ethers } = hre;
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = ethers.constants;

const {
    encodeParameters,
    etherMantissa,
    mineBlock,
    increaseTime,
} = require("../tests/Utils/Ethereum");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("TimelockHarness");
const StakingProxy = artifacts.require("StakingProxy");

const LoanTokenSettings = artifacts.require("LoanTokenSettingsLowerAdmin");
const LoanToken = artifacts.require("LoanToken");

const { deployAndGetIStaking } = require("../tests/Utils/initializer");

const QUORUM_VOTES = etherMantissa(4000000);

const TWO_DAYS = 86400 * 2;
// const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const MAX_DURATION = ethers.BigNumber.from(24 * 60 * 60).mul(1092);

const ONE_RBTC = ethers.utils.parseEther("1.0");

describe("Staking Modules Deployments and Upgrades via Governance", () => {
    let root, account1, account2, account3, account4;
    let SUSD, staking, gov, timelock, stakingProxy;
    let sovryn;
    // async function setupTest() {
    const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
        //await impersonateAccount(addressToImpersonate);
        //return await ethers.getSigner(addressToImpersonate);
        const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
        await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
        return provider.getSigner(addressToImpersonate);
    };

    const setupTest = createFixture(async ({ deployments, getNamedAccounts }) => {
        const { deployer } = await getNamedAccounts();

        const deployerSigner = await ethers.getSigner(deployer);
        await setBalance(deployer, ONE_RBTC.mul(10));
        await deployments.fixture(["StakingModules", "StakingModulesProxy"], {
            keepExistingDeployments: true,
        }); // start from a fresh deployments
        const stakingProxy = await ethers.getContract("StakingProxy", deployer);
        const stakingModulesProxy = await ethers.getContract("StakingModulesProxy", deployer);

        const god = await deployments.get("GovernorOwner");
        const governorOwner = await ethers.getContractAt(
            "GovernorAlpha",
            god.address,
            deployerSigner
        );
        const governorOwnerSigner = await getImpersonatedSignerFromJsonRpcProvider(god.address);

        await setBalance(governorOwnerSigner._address, ONE_RBTC);
        const timelockOwner = await ethers.getContract("TimelockOwner", governorOwnerSigner);

        const timelockOwnerSigner = await getImpersonatedSignerFromJsonRpcProvider(
            timelockOwner.address
        );
        await setBalance(timelockOwnerSigner._address, ONE_RBTC);

        //
        return {
            deployer,
            deployerSigner,
            stakingProxy,
            stakingModulesProxy,
            governorOwner,
            governorOwnerSigner,
            timelockOwner,
            timelockOwnerSigner,
        };
    });

    before(async () => {});
    beforeEach(async () => {});
    afterEach(async () => {});

    describe("Staking Modules Onchain Testing", () => {
        it("SIP 0049 is executable", async () => {
            if (!hre.network.tags["forked"]) {
                console.error("ERROR: Must run on a forked net");
                return;
            }
            await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                            blockNumber: 5069115, //5079890 // block num at the time of the test creation with no Staking refactored deployed yet
                            //blockNumber: 5037475, // block num at the time of the test creation with no Staking refactored deployed yet
                        },
                    },
                ],
            });

            const {
                deployer,
                deployerSigner,
                stakingProxy,
                stakingModulesProxy,
                governorOwner,
                governorOwnerSigner,
                timelockOwner,
                timelockOwnerSigner,
            } = await setupTest();

            // CREATE PROPOSAL
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
            await sov.mint(deployer, whaleAmount);
            /*
            const quorumVotes = await governorOwner.quorumVotes();
            console.log('quorumVotes:', quorumVotes);
            */
            await sov.connect(deployerSigner).approve(stakingProxy.address, whaleAmount);
            const stakeABI = (await hre.artifacts.readArtifact("IStaking")).abi;
            // alternatively for stakeABI can be used human readable ABI:
            /*const stakeABI = [
                'function stake(uint96 amount,uint256 until,address stakeFor,address delegatee)',
                'function pauseUnpause(bool _pause)',
                'function paused() view returns (bool)'
            ];*/
            const staking = await ethers.getContractAt(
                stakeABI,
                stakingProxy.address,
                deployerSigner
            );
            const multisigSigner = await getImpersonatedSignerFromJsonRpcProvider(
                (
                    await get("MultiSigWallet")
                ).address
            );
            if (await staking.paused()) await staking.connect(multisigSigner).pauseUnpause(false);
            const kickoffTS = await stakingProxy.kickoffTS();
            await staking.stake(whaleAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);
            await mine();

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSip0049" });
            const proposalId = await governorOwner.latestProposalIds(deployer);
            expect(
                proposalId.toString(),
                "Proposal was not created. Check the SIP creation is not commented out."
            ).not.equal(proposalIdBeforeSIP.toString());

            // VOTE FOR PROPOSAL
            await mine();
            await governorOwner.connect(deployerSigner).castVote(proposalId, true);

            // QUEUE PROPOSAL
            let proposal = await governorOwner.proposals(proposalId);
            await mine(proposal.endBlock);
            await governorOwner.queue(proposalId);

            // EXECUTE PROPOSAL
            proposal = await governorOwner.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorOwner.execute(proposalId))
                .to.emit(governorOwner, "ProposalExecuted")
                .withArgs(proposalId);

            // VALIDATE EXECUTION
            expect((await governorOwner.proposals(proposalId)).executed).to.be.true;
            expect(await stakingProxy.getImplementation()).to.equal(
                (await get("StakingModulesProxy_Implementation")).address
            );
            const modulesProxy = await ethers.getContractAt("ModulesProxy", stakingProxy.address);
            expect(await modulesProxy.getFuncImplementation("0x8dae1b16")).to.equal(
                (await get("WeightedStakingModule")).address
            );
        });
        it("SIP-0058 replacing staking modules is executable", async () => {
            if (!hre.network.tags["forked"]) {
                console.error("ERROR: Must run on a forked net");
                return;
            }
            await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                            blockNumber: 5117306, // block num at the time of the test creation with no new modules deployed
                        },
                    },
                ],
            });

            const {
                deployer,
                deployerSigner,
                stakingProxy,
                stakingModulesProxy,
                governorOwner,
                governorOwnerSigner,
                timelockOwner,
                timelockOwnerSigner,
            } = await setupTest();

            // CREATE PROPOSAL
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
            await sov.mint(deployer, whaleAmount);

            await sov.connect(deployerSigner).approve(stakingProxy.address, whaleAmount);
            const stakeABI = (await hre.artifacts.readArtifact("IStaking")).abi;
            const staking = await ethers.getContractAt(
                stakeABI,
                stakingProxy.address,
                deployerSigner
            );
            const multisigSigner = await getImpersonatedSignerFromJsonRpcProvider(
                (
                    await get("MultiSigWallet")
                ).address
            );
            if (await staking.paused()) await staking.connect(multisigSigner).pauseUnpause(false);
            const kickoffTS = await stakingProxy.kickoffTS();
            await staking.stake(whaleAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);
            await mine();

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSip0058" });
            const proposalId = await governorOwner.latestProposalIds(deployer);
            expect(
                proposalId,
                "Proposal was not created. Check the SIP creation is not commented out."
            ).is.gt(proposalIdBeforeSIP);

            // VOTE FOR PROPOSAL

            await mine();
            await governorOwner.connect(deployerSigner).castVote(proposalId, true);

            // QUEUE PROPOSAL
            let proposal = await governorOwner.proposals(proposalId);
            await mine(proposal.endBlock);
            await governorOwner.queue(proposalId);

            // VERIFY REGISTERED MODULES ARE NOT THE DEPLOYED ONES BEFORE THE SIP EXECUTION
            const modulesProxy = await ethers.getContractAt("ModulesProxy", stakingProxy.address);
            const stakingVestingModule = await ethers.getContract("StakingVestingModule");
            const stakingVestingModuleFuncs = await stakingVestingModule.getFunctionsList();
            for await (const func of stakingVestingModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).not.equal(
                    stakingVestingModule.address
                );
            }

            const stakingWithdrawModule = await ethers.getContract("StakingWithdrawModule");
            const stakingWithdrawModuleFuncs = await stakingWithdrawModule.getFunctionsList();
            for await (const func of stakingWithdrawModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).not.equal(
                    stakingWithdrawModule.address
                );
            }

            // EXECUTE PROPOSAL
            proposal = await governorOwner.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorOwner.execute(proposalId))
                .to.emit(governorOwner, "ProposalExecuted")
                .withArgs(proposalId);

            // VALIDATE EXECUTION
            expect((await governorOwner.proposals(proposalId)).executed).to.be.true;

            // VERIFY REGISTERED MODULES FUNCS ARE REGISTERED
            for await (const func of stakingVestingModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).equal(
                    stakingVestingModule.address
                );
            }
            for await (const func of stakingWithdrawModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).equal(
                    stakingWithdrawModule.address
                );
            }
        });

        it("SIP-0058-2 replacing staking modules is executable", async () => {
            if (!hre.network.tags["forked"]) {
                console.error("ERROR: Must run on a forked net");
                return;
            }
            await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                            blockNumber: 5153348, // block num at the time of the test creation with no new modules deployed
                        },
                    },
                ],
            });

            const { stakingProxy, governorOwner } = await setupTest();

            // VERIFY REGISTERED MODULES ARE NOT THE DEPLOYED ONES BEFORE THE SIP EXECUTION
            const modulesProxy = await ethers.getContractAt("ModulesProxy", stakingProxy.address);
            const stakingVestingModule = await ethers.getContract("StakingVestingModule");
            const stakingVestingModuleFuncs = await stakingVestingModule.getFunctionsList();
            for await (const func of stakingVestingModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).not.equal(
                    stakingVestingModule.address
                );
            }

            const stakingWithdrawModule = await ethers.getContract("StakingWithdrawModule");
            const stakingWithdrawModuleFuncs = await stakingWithdrawModule.getFunctionsList();
            for await (const func of stakingWithdrawModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).not.equal(
                    stakingWithdrawModule.address
                );
            }

            // EXECUTE PROPOSAL
            const proposalId = 25;
            const proposal = await governorOwner.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorOwner.execute(proposalId))
                .to.emit(governorOwner, "ProposalExecuted")
                .withArgs(proposalId);

            // VALIDATE EXECUTION
            expect((await governorOwner.proposals(proposalId)).executed).to.be.true;

            // VERIFY REGISTERED MODULES FUNCS ARE REGISTERED
            for await (const func of stakingVestingModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).equal(
                    stakingVestingModule.address
                );
            }
            for await (const func of stakingWithdrawModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).equal(
                    stakingWithdrawModule.address
                );
            }
        });
    });
});
