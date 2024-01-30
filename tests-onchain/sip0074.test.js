// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now run the test:
//     npx hardhat test tests-onchain/sov3613.test.js --network rskForkedMainnet

const {
    impersonateAccount,
    mine,
    time,
    setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const { getProtocolModules } = require("../deployment/helpers/helpers");

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

describe("Protocol Modules Deployments and Upgrades via Governance", () => {
    const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
        const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
        await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
        return provider.getSigner(addressToImpersonate);
    };

    const setupTest = createFixture(async ({ deployments }) => {
        const deployer = (await ethers.getSigners())[0].address;
        const deployerSigner = await ethers.getSigner(deployer);

        const multisigAddress = (await get("MultiSigWallet")).address;
        const multisigSigner = await getImpersonatedSignerFromJsonRpcProvider(multisigAddress);

        await setBalance(deployer, ONE_RBTC.mul(10));
        await deployments.fixture(["ProtocolModules"], {
            keepExistingDeployments: true,
        }); // start from a fresh deployments

        const staking = await ethers.getContract("Staking", deployerSigner);
        const sovrynProtocol = await ethers.getContract("SovrynProtocol", deployerSigner);

        const god = await deployments.get("GovernorOwner");
        const governorOwner = await ethers.getContractAt(
            "GovernorAlpha",
            god.address,
            deployerSigner
        );
        const governorOwnerSigner = await getImpersonatedSigner(god.address);

        await setBalance(governorOwnerSigner.address, ONE_RBTC);
        const timelockOwner = await ethers.getContract("TimelockOwner", governorOwnerSigner);

        const timelockOwnerSigner = await getImpersonatedSignerFromJsonRpcProvider(
            timelockOwner.address
        );
        await setBalance(timelockOwnerSigner._address, ONE_RBTC);

        //
        return {
            deployer,
            deployerSigner,
            staking,
            sovrynProtocol,
            governorOwner,
            governorOwnerSigner,
            timelockOwner,
            timelockOwnerSigner,
            multisigAddress,
            multisigSigner,
        };
    });

    /// @todo change the SIP name
    describe("SIP-0074 Test creation and execution", () => {
        it("SIP-0074 is executable and valid", async () => {
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
                            blockNumber: 6037998,
                        },
                    },
                ],
            });

            console.log("asd");
            const {
                deployer,
                deployerSigner,
                staking,
                sovrynProtocol,
                governorOwner,
                timelockOwnerSigner,
                multisigAddress,
                multisigSigner,
            } = await setupTest();
            console.log("asd2");

            // CREATE PROPOSAL
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
            await sov.mint(deployer, whaleAmount);

            await sov.connect(deployerSigner).approve(staking.address, whaleAmount);

            if (await staking.paused()) await staking.connect(multisigSigner).pauseUnpause(false);
            const kickoffTS = await staking.kickoffTS();
            await staking.stake(whaleAmount, kickoffTS.add(MAX_DURATION), deployer, deployer);
            await mine();

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSip0074" });
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

            // EXECUTE PROPOSAL
            proposal = await governorOwner.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorOwner.execute(proposalId))
                .to.emit(governorOwner, "ProposalExecuted")
                .withArgs(proposalId);

            // VERIFY execution
            expect((await governorOwner.proposals(proposalId)).executed).to.be.true;

            // VERIFY LoanOpenings
            expect(
                (await sovrynProtocol.getTarget("setDelegatedManager(bytes32,address,bool)")) ==
                    (await get("LoanOpenings")).address
            ).to.be.true;

            // VERIFY vesting factory has been registered in vestingRegistry
            const vestingRegistry = await ethers.getContract("VestingRegistry");
            const vestingFactoryDeployment = await get("VestingFactory");
            expect(await vestingRegistry.vestingFactory()).to.equal(
                vestingFactoryDeployment.address
            );

            // VERIFY contract code hash has been registered
            const vestingLogicDeployment = await get("VestingLogic");
            expect(await staking.isVestingContract(vestingLogicDeployment.address)).to.be.true;

            /** VALIDATE MOC NEW IMPLEMENTATION */
            const myntAdminProxy = await ethers.getContract("MyntAdminProxy");
            const miProxyDeployment = await get("MocIntegration_Proxy");
            const miDeployment = await get("MocIntegration");
            expect(
                await myntAdminProxy.getProxyImplementation(miProxyDeployment.address)
            ).to.equal(miDeployment.implementation);

            // Validate zero contracs upgrade
            const stabilityPoolProxy = await ethers.getContract("StabilityPool_Proxy");
            const stabilityPoolImpl = await get("StabilityPool_Implementation");

            const borrowerOperationsProxy = await ethers.getContract("BorrowerOperations_Proxy");
            const borrowerOperationsImpl = await get("BorrowerOperations_Implementation");

            const troveManagerProxy = await ethers.getContract("TroveManager_Proxy");
            const troveManagerImpl = await get("TroveManager_Implementation");

            const troveManager = await ethers.getContract("TroveManager");
            const troveManagerRedeemOps = await get("TroveManagerRedeemOps");

            expect(await stabilityPoolProxy.getImplementation()).to.equal(
                stabilityPoolImpl.address
            );

            expect(await borrowerOperationsProxy.getImplementation()).to.equal(
                borrowerOperationsImpl.address
            );

            expect(await troveManagerProxy.getImplementation()).to.equal(troveManagerImpl.address);

            expect(await troveManager.troveManagerRedeemOps()).to.equal(
                troveManagerRedeemOps.address
            );
        });
    });
});
