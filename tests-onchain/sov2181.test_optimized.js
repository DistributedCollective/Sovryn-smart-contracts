const Logs = require("node-logs");
const log = console.log;
const { expect } = require("chai");
const {
    loadFixture,
    impersonateAccount,
    stopImpersonatingAccount,
    mine,
    time,
    setBalance,
    setCode,
    takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const logger = new Logs().showInConsole(true);

const {
    ethers,
    deployments,
    deployments: { createFixture, get, deploy },
    getNamedAccounts,
    network,
} = hre;

const ONE_RBTC = ethers.utils.parseEther("1.0");
const { AddressZero } = ethers.constants;

const testnetUrl = "https://testnet.sovryn.app/rpc";
const mainnetUrl = "https://mainnet-dev.sovryn.app/rpc";

// some random stakers
const testnetUsers = [
    "0xA64A9275b64676466bb76fa51E3f1ab276535D19".toLowerCase(),
    "0x720FeDf6Bbe72343438e333Ddd5475301D301A68".toLowerCase(),
    "0x60C8a2C109EDb1D3706347D7CC61f4298fa45dFc".toLowerCase(),
];
// according the affected ussers reported by @CEK
const mainnetUsers = [
    "0xaf23BFe09055319f352AF6f7664A6B2B4352aa3F".toLowerCase(),
    "0x92565d3c6e454178901e24af0fb039ead2694786".toLowerCase(),
    "0x38862f26fb16dcb7f58a91c23f1f9cc159bb0000".toLowerCase(),
];

const testnetRewardAssets = [
    "0xe67Fe227e0504e8e96A34C3594795756dC26e14B".toLowerCase(), // iWRBTC
    "0xeabd29be3c3187500df86a2613c6470e12f2d77d".toLowerCase(), // rBTC
    "0xe67cbA98C183A1693fC647d63AeeEC4053656dBB".toLowerCase(), // ZERO
    "0x6a9A07972D07e58F0daf5122d11E069288A375fb".toLowerCase(), // SOV
];

const mainnetRewardAssets = [
    "0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A".toLowerCase(), // iWRBTC
    "0xeabd29be3c3187500df86a2613c6470e12f2d77d".toLowerCase(), // rBTC
    "0xdB107FA69E33f05180a4C2cE9c2E7CB481645C2d".toLowerCase(), // ZERO
    "0xEFc78fc7d48b64958315949279Ba181c2114ABBd".toLowerCase(), // SOV
];

testnetData = {
    url: testnetUrl,
    chainId: 31,
    atBlock: 3795000,
    users: testnetUsers,
    tokens: testnetRewardAssets,
};
mainnetData = {
    url: mainnetUrl,
    chainId: 30,
    atBlock: 5248190,
    users: mainnetUsers,
    tokens: mainnetRewardAssets,
};
const { url, chainId, atBlock, users, tokens } = network.tags.mainnet ? mainnetData : testnetData;

const MAX_NEXT_POSITIVE_CHECKPOINT = 75;

// we need this if using named accounts in config
const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
    return provider.getSigner(addressToImpersonate);
};

const getImpersonatedSigner = async (addressToImpersonate) => {
    await impersonateAccount(addressToImpersonate);
    return await ethers.getSigner(addressToImpersonate);
};

// QA Tests
describe("Check if Fee Sharing Collector was properly fixed", async () => {
    let snapshot;
    let feeSharingCollectorProxy, feeSharingCollectorDeployment, feeSharingCollector;
    before(async () => {
        /* await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: url,
                        blockNumber: atBlock,
                    },
                },
            ],
        });*/
        snapshot = await takeSnapshot();

        const exchequerSigner = await getImpersonatedSignerFromJsonRpcProvider(
            (
                await get("MultiSigWallet")
            ).address
        );
        feeSharingCollectorProxy = await ethers.getContract(
            "FeeSharingCollector_Proxy",
            exchequerSigner
        );
        const feeSharingCollectorAddress = await feeSharingCollectorProxy.getImplementation();

        feeSharingCollectorDeployment = await get("FeeSharingCollector_Implementation");

        if (
            feeSharingCollectorAddress.toLowerCase() !=
            feeSharingCollectorDeployment.address.toLowerCase()
        ) {
            await feeSharingCollectorProxy.setImplementation(
                feeSharingCollectorDeployment.address
            );
        }

        feeSharingCollector = await ethers.getContractAt(
            feeSharingCollectorDeployment.abi,
            feeSharingCollectorProxy.address
        );
    });

    after(async () => {
        await snapshot.restore();
    });

    it("Should reset the hardhat node to the RSK forked network to start the tests", async function () {
        const netId = (await hre.ethers.provider.getNetwork()).chainId;
        const lastBlock = await hre.ethers.provider.getBlock("latest");
        const blockNumber = lastBlock.number;
        expect(chainId).to.equal(netId);
        expect(blockNumber).to.equal(atBlock + 1); // 1 block added because we upgraded FeeSharingCollectorProxy logic
    });

    it("Should retrieve the right FeeSharing contract instances", async function () {
        const feeSharingCollectorAddress = await feeSharingCollectorProxy.getImplementation();
        expect(
            feeSharingCollectorAddress,
            `FeeSharingCollectorProxy.getImplementaion(): ${feeSharingCollectorAddress} != FeeSharingCollector deployment address ${feeSharingCollectorDeployment.address}`
        ).equal(feeSharingCollectorDeployment.address);
        console.log(feeSharingCollectorAddress);
    });

    it("Should simulate the new fee withdrawal procedure for a set of users", async function () {
        const lastBlock = await hre.ethers.provider.getBlock("latest");
        log("\n");
        logger.success("    Now, the current Block Number is: ");
        logger.warning("    " + lastBlock.number + "\n");

        let successFlag = true;
        for (let i = 0; i < users.length; i++) {
            logger.success("    User N° " + (i + 1) + " Address: ");
            logger.warning("    " + users[i] + "\n");
            for (let j = 0; j < tokens.length; j++) {
                logger.info(
                    "    User N° " +
                        (i + 1) +
                        " Status for Token " +
                        (j + 1) +
                        " " +
                        tokens[j] +
                        ": "
                );
                const totalCheckpoints = (
                    await feeSharingCollector.totalTokenCheckpoints(tokens[j])
                ).toString();
                const processedCheckpoints = (
                    await feeSharingCollector.processedCheckpoints(users[i], tokens[j])
                ).toString();
                logger.success("    total token checkpoints: " + totalCheckpoints);
                logger.success("    user's processed checkpoints: " + processedCheckpoints);

                try {
                    // pre-calc chunks
                    const userProcessedCheckpoints = (
                        await feeSharingCollector.processedCheckpoints(users[i], tokens[j])
                    ).toNumber();
                    const totalTokenCheckpoints = (
                        await feeSharingCollector.totalTokenCheckpoints(tokens[j])
                    ).toNumber();

                    const modChunks =
                        (totalTokenCheckpoints - userProcessedCheckpoints) %
                        MAX_NEXT_POSITIVE_CHECKPOINT;
                    const addChunk = modChunks > 0 ? 1 : 0;
                    const chunks =
                        parseInt(
                            (totalTokenCheckpoints - userProcessedCheckpoints) /
                                MAX_NEXT_POSITIVE_CHECKPOINT
                        ) + addChunk;
                    let userNextUnprocessedCheckpoint = userProcessedCheckpoints;

                    let completed = false;
                    index = 0;
                    let nextCheckpointData;
                    while (!completed && index <= chunks) {
                        nextCheckpointData =
                            await feeSharingCollector.getNextPositiveUserCheckpoint(
                                users[i],
                                tokens[j],
                                userNextUnprocessedCheckpoint,
                                MAX_NEXT_POSITIVE_CHECKPOINT
                            );
                        const { checkpointNum, hasSkippedCheckpoints, hasFees } =
                            nextCheckpointData;
                        console.log({
                            checkpointNum: checkpointNum.toNumber(),
                            hasSkippedCheckpoints,
                            hasFees,
                        });
                        userNextUnprocessedCheckpoint = checkpointNum.toNumber();
                        completed =
                            userNextUnprocessedCheckpoint >= totalTokenCheckpoints || hasFees;
                        index++;
                    }

                    // returns (checkpointNum,hasSkippedCheckpoints,hasFees)
                    const { checkpointNum, hasSkippedCheckpoints, hasFees } = nextCheckpointData;
                    logger.warning("    getNextPositiveUserCheckpoint(): ");
                    logger.warning("    checkpoint number: " + checkpointNum.toString());
                    logger.warning("    user has skipped checkpoints: " + hasSkippedCheckpoints);
                    logger.warning("    user has fees to claim: " + hasFees);
                    log();
                } catch (error) {
                    logger.error(
                        "    Error querying positive user checkpoint for Token " +
                            (j + 1) +
                            " " +
                            tokens[j] +
                            ": \n\n" +
                            error.message +
                            "\n"
                    );
                    successFlag = false;
                }
            }
        }

        expect(successFlag, "Some errors occurred while querying the status of the users");
    });
});
