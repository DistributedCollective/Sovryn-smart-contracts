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
    //"0xaf23BFe09055319f352AF6f7664A6B2B4352aa3F".toLowerCase(),
    "0x92565d3c6e454178901e24af0fb039ead2694786".toLowerCase(),
    //"0x38862f26fb16dcb7f58a91c23f1f9cc159bb0000".toLowerCase(),
];

const testnetRewardAssets = [
    "0xe67Fe227e0504e8e96A34C3594795756dC26e14B".toLowerCase(), // iWRBTC
    "0xeabd29be3c3187500df86a2613c6470e12f2d77d".toLowerCase(), // rBTC
    "0xe67cbA98C183A1693fC647d63AeeEC4053656dBB".toLowerCase(), // ZERO
    "0x6a9A07972D07e58F0daf5122d11E069288A375fb".toLowerCase(), // SOV
];

const mainnetRewardAssets = [
    // "0xeabd29be3c3187500df86a2613c6470e12f2d77d".toLowerCase(), // rBTC
    // "0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A".toLowerCase(), // iWRBTC
    "0xdB107FA69E33f05180a4C2cE9c2E7CB481645C2d".toLowerCase(), // ZUSD
    // "0xEFc78fc7d48b64958315949279Ba181c2114ABBd".toLowerCase(), // SOV
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
    atBlock: 5250120,
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
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: url,
                        blockNumber: atBlock,
                    },
                },
            ],
        });
        snapshot = await takeSnapshot();

        feeSharingCollectorDeployment = await get("FeeSharingCollector_Implementation");

        // console.log(
        //     "feeSharingCollectorDeployment pre-deployment",
        //     feeSharingCollectorDeployment.address
        // );

        deployerAddress = "0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E";
        deployerSigner = await getImpersonatedSignerFromJsonRpcProvider(
            deployerAddress.toLowerCase()
        );

        deployResult = await deploy("FeeSharingCollector_Implementation", {
            contract: "FeeSharingCollector",
            from: (await ethers.getSigners())[0].address,
            log: true,
        });

        // await deployments.fixture(["FeeSharingCollector"], {
        //     keepExistingDeployments: true,
        // });

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

        console.log(
            "feeSharingCollectorDeployment post-deployment",
            feeSharingCollectorDeployment.address
        );

        if (
            feeSharingCollectorAddress.toLowerCase() !=
            feeSharingCollectorDeployment.address.toLowerCase()
        ) {
            await feeSharingCollectorProxy.setImplementation(
                feeSharingCollectorDeployment.address
            );
            logger.info(`Replaced implementation to ${feeSharingCollectorDeployment.address}`);
        }

        await deployments.save("FeeSharingCollector", {
            address: feeSharingCollectorProxy.address,
            implementation: deployResult.address,
            abi: deployResult.abi,
            bytecode: deployResult.bytecode,
            deployedBytecode: deployResult.deployedBytecode,
            devdoc: deployResult.devdoc,
            userdoc: deployResult.userdoc,
            storageLayout: deployResult.storageLayout,
        });

        feeSharingCollector = await ethers.getContract("FeeSharingCollector");
    });

    after(async () => {
        await snapshot.restore();
    });

    it("Should retrieve the right FeeSharing contract instances", async function () {
        const feeSharingCollectorAddress = await feeSharingCollectorProxy.getImplementation();
        expect(
            feeSharingCollectorAddress,
            `FeeSharingCollectorProxy.getImplementaion(): ${feeSharingCollectorAddress} != FeeSharingCollector deployment address ${feeSharingCollectorDeployment.address}`
        ).equal(feeSharingCollectorDeployment.address);
    });

    it("Should simulate the new fee withdrawal procedure for a set of users", async function () {
        const lastBlock = await hre.ethers.provider.getBlock("latest");
        log("\n");
        logger.success("    Now, the current Block Number is: ");
        logger.warning("    " + lastBlock.number + "\n");

        for (let i = 0; i < users.length; i++) {
            logger.success("    User N° " + (i + 1) + " Address: ");
            logger.warning("    " + users[i] + "\n");
            const userSigner = await getImpersonatedSignerFromJsonRpcProvider(
                users[i].toLowerCase()
            );
            feeSharingCollector = await ethers.getContract("FeeSharingCollector", userSigner);
            await setBalance(users[i], 1e18);
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

                let expectedReward = await feeSharingCollector.getAccumulatedFees(
                    users[i],
                    tokens[j]
                );

                logger.information(
                    "    User N° " + (i + 1) + " Expected Reward in token N° " + (j + 1) + ": "
                );
                logger.warning("    " + expectedReward.toString());

                const tokenAsset = await ethers.getContractAt("ERC20", tokens[j]);
                let balanceBefore = await tokenAsset.balanceOf(users[i]);

                while (!completed && index <= chunks) {
                    nextCheckpointData = await feeSharingCollector.getNextPositiveUserCheckpoint(
                        users[i],
                        tokens[j],
                        userNextUnprocessedCheckpoint,
                        MAX_NEXT_POSITIVE_CHECKPOINT
                    );
                    const { checkpointNum, hasSkippedCheckpoints, hasFees } = nextCheckpointData;
                    console.log({
                        checkpointNum: checkpointNum.toNumber(),
                        hasSkippedCheckpoints,
                        hasFees,
                    });
                    if (hasFees) {
                        logger.warn("index: " + index);
                        if (hasSkippedCheckpoints) {
                            let claimFees =
                                await feeSharingCollector.withdrawStartingFromCheckpoint(
                                    tokens[j],
                                    checkpointNum,
                                    65,
                                    users[i],
                                    { gasLimit: 6500000, gasPrice: 66e7 }
                                );
                            let claimFeesTx = await claimFees.wait();
                            let balanceAfter = await tokenAsset.balanceOf(users[i]);
                            logger.information(
                                "    User N° " +
                                    (i + 1) +
                                    " Balance after withdrawStartingFromCheckpoint() in token N° " +
                                    (j + 1) +
                                    ": "
                            );
                            logger.warning("    " + balanceAfter.toString());
                            logger.info(
                                `Rewards actual sub rewards expected: ${balanceAfter
                                    .sub(balanceBefore)
                                    .sub(expectedReward)
                                    // .div(ethers.constants.WeiPerEther)
                                    .toString()}`
                            );
                        } else {
                            logger.warn("Withdrawal using regular withdraw()...");
                            let claimFees = await feeSharingCollector.withdraw(
                                tokens[j],
                                65,
                                users[i],
                                {
                                    gasLimit: 6500000,
                                    gasPrice: 66e7,
                                }
                            );
                            let claimFeesTx = await claimFees.wait();
                            let balanceAfter = await tokenAsset.balanceOf(users[i]);
                            logger.information(
                                "    User N° " +
                                    (i + 1) +
                                    " Balance after withdraw() in token N° " +
                                    (j + 1) +
                                    ": "
                            );
                            logger.warning("    " + balanceAfter.toString());
                            logger.info(
                                `Rewards actual sub rewards expected: ${balanceAfter
                                    .sub(balanceBefore)
                                    .sub(expectedReward)
                                    //.div(ethers.constants.WeiPerEther)
                                    .toString()}`
                            );
                        }
                    }
                    userNextUnprocessedCheckpoint = checkpointNum.toNumber();
                    completed = userNextUnprocessedCheckpoint >= totalTokenCheckpoints; // || hasFees;
                    index++;
                }

                let balanceAfter = await tokenAsset.balanceOf(users[i]);
                logger.warning("IN TOTAL:...");
                logger.information(
                    "    User N° " + (i + 1) + " Balance after in token N° " + (j + 1) + ": "
                );
                logger.warning("    " + balanceAfter.toString());
                logger.info(
                    `Rewards actual sub rewards expected: ${balanceAfter
                        .sub(balanceBefore)
                        .sub(expectedReward)
                        .div(ethers.constants.WeiPerEther)
                        .toString()}`
                );

                // returns (checkpointNum,hasSkippedCheckpoints,hasFees)
                const { checkpointNum, hasSkippedCheckpoints, hasFees } = nextCheckpointData;
                logger.warning("    getNextPositiveUserCheckpoint(): ");
                logger.warning("    checkpoint number: " + checkpointNum.toString());
                logger.warning("    user has skipped checkpoints: " + hasSkippedCheckpoints);
                logger.warning("    user has fees to claim: " + hasFees);
                log();
            }
        }
    });
});
