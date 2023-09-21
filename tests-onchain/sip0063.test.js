//@note hh test tests-onchain/sip0063.test.js --network rskForkedMainnetFlashback

const {
    impersonateAccount,
    mine,
    time,
    setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

const {
    ethers,
    deployments: { createFixture, get },
} = hre;

const MAX_DURATION = ethers.BigNumber.from(24 * 60 * 60).mul(1092);

const ONE_RBTC = ethers.utils.parseEther("1.0");

const getImpersonatedSigner = async (addressToImpersonate) => {
    await impersonateAccount(addressToImpersonate);
    return await ethers.getSigner(addressToImpersonate);
};

describe("Staking Modules Deployments and Upgrades via Governance", () => {
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
        const governorOwnerSigner = await getImpersonatedSigner(god.address);

        await setBalance(governorOwnerSigner.address, ONE_RBTC);
        const timelockOwner = await ethers.getContract("TimelockOwner", governorOwnerSigner);

        const timelockOwnerSigner = await getImpersonatedSigner(timelockOwner.address);
        await setBalance(timelockOwnerSigner.address, ONE_RBTC);

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

    describe("SIP-0063 Testing", () => {
        it("SIP-0063 replacing staking modules is executable", async () => {
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
                            blockNumber: 5334660, // block num at the time of the test creation with no new modules deployed
                        },
                    },
                ],
            });

            const { deployer, deployerSigner, stakingProxy, governorOwner, timelockOwnerSigner } =
                await setupTest();

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
            const multisigSigner = await getImpersonatedSigner(
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
            await hre.run("sips:create", { argsFunc: "getArgsSip0063" });
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

            const stakingStakeModule = await ethers.getContract("StakingStakeModule");
            const stakingStakeModuleFuncs = await stakingStakeModule.getFunctionsList();
            for await (const func of stakingStakeModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).not.equal(
                    stakingStakeModule.address
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
            for await (const func of stakingStakeModuleFuncs) {
                expect(await modulesProxy.getFuncImplementation(func)).equal(
                    stakingStakeModule.address
                );
            }
        });
    });
});
