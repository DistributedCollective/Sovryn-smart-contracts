// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now run the test:
//     npx hardhat test tests-onchain/sip0088.test.js --network rskForkedMainnet

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
    deployments: { createFixture, get, deploy },
} = hre;

const MAX_DURATION = ethers.BigNumber.from(24 * 60 * 60).mul(1092);

const ONE_RBTC = ethers.utils.parseEther("1.0");

const getImpersonatedSigner = async (addressToImpersonate) => {
    await impersonateAccount(addressToImpersonate);
    return await ethers.getSigner(addressToImpersonate);
};

describe("Enable BOS Token as collateral", () => {
    const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
        const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
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

        const god = await deployments.get("GovernorAdmin");
        const governorOwner = await ethers.getContractAt(
            "GovernorAlpha",
            god.address,
            deployerSigner
        );
        const governorOwnerSigner = await getImpersonatedSigner(god.address);

        await setBalance(governorOwnerSigner.address, ONE_RBTC);
        const timelockOwner = await ethers.getContract("TimelockAdmin", governorOwnerSigner);

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
    describe("SIP-0088 Test creation and execution", () => {
        it("SIP-0088 is executable and valid", async () => {
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
                            blockNumber: 8044172,
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
            const currentTS = ethers.BigNumber.from(
                (await ethers.provider.getBlock("latest")).timestamp
            );
            await staking.stake(whaleAmount, currentTS.add(MAX_DURATION), deployer, deployer);
            await mine();

            // CREATE PROPOSAL AND VERIFY
            const proposalIdBeforeSIP = await governorOwner.latestProposalIds(deployer);
            await hre.run("sips:create", { argsFunc: "getArgsSip0088" });
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

            const previousExchequerBalance = await sov.balanceOf(multisigAddress);
            console.log(`previous Exchequer's balance: ${previousExchequerBalance.toString()}`);

            // EXECUTE PROPOSAL
            proposal = await governorOwner.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorOwner.execute(proposalId))
                .to.emit(governorOwner, "ProposalExecuted")
                .withArgs(proposalId);

            // VERIFY execution
            expect((await governorOwner.proposals(proposalId)).executed).to.be.true;

            // Validate the supported tokens have been added
            const bosToken = await ethers.getContract("BOS");
            const supportedTokens = await sovrynProtocol.supportedTokens(bosToken.address);
            expect(supportedTokens).to.be.true;

            // Validate the loan params have been added for each loan token
            const loanTokens = [
                await ethers.getContract("iXUSD"),
                await ethers.getContract("iRBTC"),
                await ethers.getContract("iBPro"),
                await ethers.getContract("iDOC"),
            ];

            for (const loanToken of loanTokens) {
                // Check Torque params (areTorqueLoans = true)
                const torqueKey = ethers.utils.solidityKeccak256(
                    ["address", "bool"],
                    [bosToken.address, true]
                );
                const torqueLoanParamId = await loanToken.loanParamsIds(torqueKey);
                expect(torqueLoanParamId).to.not.equal(ethers.constants.HashZero, 
                    `Torque loan params not set for ${loanToken.address}`);

                // Get the actual loan params from the protocol
                const torqueLoanParams = await sovrynProtocol.getLoanParams([torqueLoanParamId]);
                expect(torqueLoanParams.length).to.equal(1);
                expect(torqueLoanParams[0].active).to.be.true;
                expect(torqueLoanParams[0].collateralToken).to.equal(bosToken.address);
                expect(torqueLoanParams[0].minInitialMargin).to.equal(ethers.utils.parseEther("50")); // 50%
                expect(torqueLoanParams[0].maintenanceMargin).to.equal(ethers.utils.parseEther("15")); // 15%
                expect(torqueLoanParams[0].maxLoanTerm).to.equal(0); // coz the torque = 0

                console.log(`Torque params validated for ${loanToken.address}`);
            }
        });
    });
});
