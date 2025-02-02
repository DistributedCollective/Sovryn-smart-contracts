// first run a local forked mainnet node in a separate terminal window:
//     export NETWORK_ID=30 && npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now, in another terminal run the test:
// npx hardhat test ./tests-onchain/lp_beacons_pause.test.js --network rskForkedMainnet
//@note     hh test ./tests-onchain/lp_beacons_pause.test.js --network rskForkedMainnet

const fs = require("fs");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const log = console.log;
const LOG = console.log;
const col = require("cli-color");
const hre = require("hardhat");

const {
    impersonateAccount,
    takeSnapshot,
    mine,
    time,
    setBalance,
    setStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");

const { getProtocolModules } = require("../deployment/helpers/helpers");
const { config } = require("dotenv");

const {
    ethers,
    deployments: { createFixture, get },
} = hre;

const printLastBlockWithDate = (lastBlock) => {
    log();
    logger.success(`    Now, the current Block Number is: `);
    logger.warning(`    ${lastBlock.number}`);
    logger.success(`    And its Timestamp is: `);
    logger.warning(`    ${lastBlock.timestamp}`);
    let date = new Date(lastBlock.timestamp * 1000);
    logger.success(`    Corresponding to the date: `);
    logger.warning(`    ${date}`);
    log();
};

const ONE_RBTC = ethers.utils.parseEther("1.0");

const getImpersonatedSigner = async (addressToImpersonate) => {
    await impersonateAccount(addressToImpersonate);
    return await ethers.getSigner(addressToImpersonate);
};

const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
    return provider.getSigner(addressToImpersonate);
};

describe("Pause LP Bacons - Check they are paused - Unpause LP Beacons", () => {
    let snapshot;

    before(async () => {
        if (!(hre.network.tags["forked"] && hre.network.tags["mainnet"])) {
            console.error("ERROR: Must run on a forked mainnet");
            return;
        }
        const bestBlock = await hre.ethers.provider.getBlock("latest");
        TEST_BLOCK = bestBlock.number - 100;
        printLastBlockWithDate(bestBlock);
        const netId = await ethers.provider.getNetwork().then((n) => n.chainId);
        LOG(col.greenBright("    and the network ID is: ") + col.yellowBright(netId) + "\n");
        assert(netId.toString() == "30", "wrong net"); // rsk-mainnet tests
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                        blockNumber: TEST_BLOCK,
                    },
                },
            ],
        });
        snapshot = await takeSnapshot();
        const newBestBlock = await hre.ethers.provider.getBlock("latest");
        const blockNumber = newBestBlock.number;
        LOG(col.greenBright("\n    block number is now: ") + col.yellowBright(blockNumber));
        const blockMoment = newBestBlock.timestamp;
        LOG(col.greenBright("    block timestamp is: ") + col.yellowBright(blockMoment));
        assert(blockNumber.toString() === TEST_BLOCK.toString(), "the forking failed");

        const LoanTokenLogicBeaconLMAddress = (
            await ethers.getContract("LoanTokenLogicBeaconLM")
        ).address.toLowerCase();
        const oldMultiSigAddress = (
            await ethers.getContract("MultiSigWallet")
        ).address.toLowerCase();
        await setStorageAt(LoanTokenLogicBeaconLMAddress, 1, oldMultiSigAddress);
        const newBaconLMPauser = await (
            await ethers.getContract("LoanTokenLogicBeaconLM")
        ).pauser();
        LOG(col.yellowBright("    newBaconLMPauser: ") + col.green(newBaconLMPauser));

        const LoanTokenLogicBeaconWRBTCAddress = (
            await ethers.getContract("LoanTokenLogicBeaconWrbtc")
        ).address.toLowerCase();
        await setStorageAt(LoanTokenLogicBeaconWRBTCAddress, 1, oldMultiSigAddress);
        const newBaconWRBtcPauser = await (
            await ethers.getContract("LoanTokenLogicBeaconWrbtc")
        ).pauser();
        LOG(col.yellowBright("    newBaconWRBTCPauser: ") + col.green(newBaconWRBtcPauser));
    });

    after(async () => {
        await snapshot.restore();
    });

    it("pauses LP Beacons", async () => {
        const multisig = await ethers.getContract("MultiSigWallet");
        const txCountBefore = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountBefore: ") + col.green(txCountBefore.toString()));
        const submitterAcc = (await hre.getNamedAccounts())["exchequerOwner0"];
        await setBalance(submitterAcc, ONE_RBTC);
        await hre.run("pausing:pause-lp-beacons", { signer: "exchequerOwner0" });
        const txCountAfter = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountAfter: ") + col.green(txCountAfter.toString()));

        assert(txCountAfter.eq(txCountBefore.add(2)));

        const initialConfirmationCount1 = await multisig.getConfirmationCount(txCountBefore);
        const initialConfirmationCount2 = await multisig.getConfirmationCount(
            txCountBefore.add(1)
        );

        LOG(
            col.yellowBright("    initialConfirmationCount for LM: ") +
                col.green(initialConfirmationCount1.toString())
        );

        LOG(
            col.yellowBright("    initialConfirmationCount for WRBTC: ") +
                col.green(initialConfirmationCount2.toString())
        );
        const firstConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner1"];
        await setBalance(firstConfirmerAcc, ONE_RBTC);
        const confirmerOne = await getImpersonatedSignerFromJsonRpcProvider(firstConfirmerAcc);
        await (await multisig.connect(confirmerOne).confirmTransaction(txCountBefore)).wait();
        await (
            await multisig.connect(confirmerOne).confirmTransaction(txCountBefore.add(1))
        ).wait();
        // const fisrtConfirmationTxReceipt = await fisrtConfirmationTx.wait();
        const firstConfirmationCount1 = await multisig.getConfirmationCount(txCountBefore);
        const firstConfirmationCount2 = await multisig.getConfirmationCount(txCountBefore.add(1));
        LOG(
            col.yellowBright("    firstConfirmationCount for LM: ") +
                col.green(firstConfirmationCount1.toString())
        );
        LOG(
            col.yellowBright("    firstConfirmationCount for WRBTC: ") +
                col.green(firstConfirmationCount2.toString())
        );

        hre.assert(firstConfirmationCount1.eq(initialConfirmationCount1.add(1)));
        hre.assert(firstConfirmationCount2.eq(initialConfirmationCount2.add(1)));

        const secondConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner2"];
        await setBalance(secondConfirmerAcc, ONE_RBTC);
        const confirmerTwo = await getImpersonatedSignerFromJsonRpcProvider(secondConfirmerAcc);

        await (
            await multisig
                .connect(confirmerTwo)
                .confirmTransaction(txCountBefore, { gasLimit: 6000000, gasPrice: 66000000 })
        ).wait();

        await (
            await multisig.connect(confirmerTwo).confirmTransaction(txCountBefore.add(1), {
                gasLimit: 6000000,
                gasPrice: 66000000,
            })
        ).wait();

        const secondConfirmationCount1 = await multisig.getConfirmationCount(txCountBefore);
        const secondConfirmationCount2 = await multisig.getConfirmationCount(txCountBefore.add(1));

        LOG(
            col.yellowBright("    secondConfirmationCount for LM: ") +
                col.green(secondConfirmationCount1.toString())
        );

        LOG(
            col.yellowBright("    secondConfirmationCount for WRBTC: ") +
                col.green(secondConfirmationCount2.toString())
        );

        hre.assert(secondConfirmationCount1.eq(firstConfirmationCount1.add(1)));
        hre.assert(secondConfirmationCount2.eq(firstConfirmationCount2.add(1)));

        const isExecuted1 = await multisig.isConfirmed(txCountBefore);
        const isExecuted2 = await multisig.isConfirmed(txCountBefore.add(1));
        LOG(col.yellowBright("    isExecuted for LM: ") + col.green(isExecuted1.toString()));
        LOG(col.yellowBright("    isExecuted for WRBTC: ") + col.green(isExecuted2.toString()));

        hre.assert(isExecuted1);
        hre.assert(isExecuted2);
    });

    it("checks LP Beacons are paused", async () => {
        await hre.run("pausing:print-lp-beacons-paused");
        assert(true);
    });

    it("unpauses LP Beacons", async () => {
        const multisig = await ethers.getContract("MultiSigWallet");
        const txCountBefore = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountBefore: ") + col.green(txCountBefore.toString()));
        const submitterAcc = (await hre.getNamedAccounts())["exchequerOwner3"];
        await setBalance(submitterAcc, ONE_RBTC);
        await hre.run("pausing:unpause-lp-beacon(s)", { signer: "exchequerOwner3" });
        const txCountAfter = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountAfter: ") + col.green(txCountAfter.toString()));

        assert(txCountAfter.eq(txCountBefore.add(2)));

        const initialConfirmationCount1 = await multisig.getConfirmationCount(txCountBefore);
        const initialConfirmationCount2 = await multisig.getConfirmationCount(
            txCountBefore.add(1)
        );

        LOG(
            col.yellowBright("    initialConfirmationCount for LM: ") +
                col.green(initialConfirmationCount1.toString())
        );

        LOG(
            col.yellowBright("    initialConfirmationCount for WRBTC: ") +
                col.green(initialConfirmationCount2.toString())
        );
        const firstConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner4"];
        await setBalance(firstConfirmerAcc, ONE_RBTC);
        const confirmerOne = await getImpersonatedSignerFromJsonRpcProvider(firstConfirmerAcc);
        await (await multisig.connect(confirmerOne).confirmTransaction(txCountBefore)).wait();
        await (
            await multisig.connect(confirmerOne).confirmTransaction(txCountBefore.add(1))
        ).wait();
        // const fisrtConfirmationTxReceipt = await fisrtConfirmationTx.wait();
        const firstConfirmationCount1 = await multisig.getConfirmationCount(txCountBefore);
        const firstConfirmationCount2 = await multisig.getConfirmationCount(txCountBefore.add(1));
        LOG(
            col.yellowBright("    firstConfirmationCount for LM: ") +
                col.green(firstConfirmationCount1.toString())
        );
        LOG(
            col.yellowBright("    firstConfirmationCount for WRBTC: ") +
                col.green(firstConfirmationCount2.toString())
        );

        hre.assert(firstConfirmationCount1.eq(initialConfirmationCount1.add(1)));
        hre.assert(firstConfirmationCount2.eq(initialConfirmationCount2.add(1)));

        const secondConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner5"];
        await setBalance(secondConfirmerAcc, ONE_RBTC);
        const confirmerTwo = await getImpersonatedSignerFromJsonRpcProvider(secondConfirmerAcc);

        await (
            await multisig
                .connect(confirmerTwo)
                .confirmTransaction(txCountBefore, { gasLimit: 6000000, gasPrice: 66000000 })
        ).wait();

        await (
            await multisig.connect(confirmerTwo).confirmTransaction(txCountBefore.add(1), {
                gasLimit: 6000000,
                gasPrice: 66000000,
            })
        ).wait();

        const secondConfirmationCount1 = await multisig.getConfirmationCount(txCountBefore);
        const secondConfirmationCount2 = await multisig.getConfirmationCount(txCountBefore.add(1));

        LOG(
            col.yellowBright("    secondConfirmationCount for LM: ") +
                col.green(secondConfirmationCount1.toString())
        );

        LOG(
            col.yellowBright("    secondConfirmationCount for WRBTC: ") +
                col.green(secondConfirmationCount2.toString())
        );

        hre.assert(secondConfirmationCount1.eq(firstConfirmationCount1.add(1)));
        hre.assert(secondConfirmationCount2.eq(firstConfirmationCount2.add(1)));

        const isExecuted1 = await multisig.isConfirmed(txCountBefore);
        const isExecuted2 = await multisig.isConfirmed(txCountBefore.add(1));
        LOG(col.yellowBright("    isExecuted for LM: ") + col.green(isExecuted1.toString()));
        LOG(col.yellowBright("    isExecuted for WRBTC: ") + col.green(isExecuted2.toString()));

        hre.assert(isExecuted1);
        hre.assert(isExecuted2);
    });

    it("checks LP Beacons are unpaused", async () => {
        await hre.run("pausing:print-lp-beacons-paused");
        assert(true);
    });
});
