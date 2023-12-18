// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now run the test:
//     npx hardhat test tests-onchain/sip0073.test.js --network rskForkedMainnet

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
        /*await deployments.fixture(["ProtocolModules"], {
            keepExistingDeployments: true,
        }); // start from a fresh deployments*/

        const staking = await ethers.getContract("Staking", deployerSigner);
        const sovrynProtocol = await ethers.getContract("ISovryn", deployerSigner);

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
    describe("SIP-0073 Test creation and execution", () => {
        it("SIP-Sov3497 is executable and valid", async () => {
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
                            blockNumber: 5857778, // block num at the time no new modules deployed yet
                        },
                    },
                ],
            });

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
            await hre.run("sips:create", { argsFunc: "getArgsSip0073" });
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

            // VERIFY implementation addresses in protocol modules
            const modulesList = getProtocolModules();
            for (const moduleProp in modulesList) {
                const module = modulesList[moduleProp];
                const moduleDeployment = await get(module.moduleName);
                expect(await sovrynProtocol.getTarget(module.sampleFunction)).to.equal(
                    moduleDeployment.address
                );
            }
        });
    });
});
