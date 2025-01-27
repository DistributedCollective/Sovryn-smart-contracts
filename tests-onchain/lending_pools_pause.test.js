// first run a local forked mainnet node in a separate terminal window:
//     export NETWORK_ID=30 && npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now, in another terminal run the test:
// npx hardhat test ./tests-onchain/protocol_pause.test.js --network rskForkedMainnet
//@note     hh test ./tests-onchain/protocol_pause.test.js --network rskForkedMainnet

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

describe("Pause Lending Pools - Check they are paused - Unpause Lending Pools", () => {
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
    });

    after(async () => {
        await snapshot.restore();
    });

    it("pauses all Lending Pools", async () => {
        const multisig = await ethers.getContract("MultiSigWallet");
        const txCountBefore = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountBefore: ") + col.green(txCountBefore.toString()));
        const submitterAcc = (await hre.getNamedAccounts())["exchequerOwner0"];
        await setBalance(submitterAcc, ONE_RBTC);
        await hre.run("pausing:pause-protocol", { signer: "exchequerOwner0" });
        const txCountAfter = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountAfter: ") + col.green(txCountAfter.toString()));

        assert(txCountAfter.eq(txCountBefore.add(1)));

        const initialConfirmationCount = await multisig.getConfirmationCount(txCountBefore);
        LOG(
            col.yellowBright("    initialConfirmationCount: ") +
                col.green(initialConfirmationCount.toString())
        );
        const firstConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner1"];
        await setBalance(firstConfirmerAcc, ONE_RBTC);
        const confirmerOne = await getImpersonatedSignerFromJsonRpcProvider(firstConfirmerAcc);
        await (await multisig.connect(confirmerOne).confirmTransaction(txCountBefore)).wait();
        // const fisrtConfirmationTxReceipt = await fisrtConfirmationTx.wait();
        const firstConfirmationCount = await multisig.getConfirmationCount(txCountBefore);
        LOG(
            col.yellowBright("    firstConfirmationCount: ") +
                col.green(firstConfirmationCount.toString())
        );

        hre.assert(firstConfirmationCount.eq(initialConfirmationCount.add(1)));

        const secondConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner2"];
        await setBalance(secondConfirmerAcc, ONE_RBTC);
        const confirmerTwo = await getImpersonatedSignerFromJsonRpcProvider(secondConfirmerAcc);
        await (await multisig.connect(confirmerTwo).confirmTransaction(txCountBefore)).wait();
        // const secondConfirmationTxReceipt = await secondConfirmationTx.wait();
        const secondConfirmationCount = await multisig.getConfirmationCount(txCountBefore);
        LOG(
            col.yellowBright("    secondConfirmationCount: ") +
                col.green(secondConfirmationCount.toString())
        );

        hre.assert(secondConfirmationCount.eq(firstConfirmationCount.add(1)));

        const isExecuted = await multisig.isConfirmed(txCountBefore);
        LOG(col.yellowBright("    isExecuted: ") + col.green(isExecuted.toString()));

        hre.assert(isExecuted);
    });

    it("checks Lending Pools are paused", async () => {
        const pauser = await (await ethers.getContract("ISovryn")).getPauser();
        LOG(col.yellowBright("    pauser: ") + col.green(pauser));
        const multiSigAddress = await (await ethers.getContract("MultiSigWallet")).address;
        LOG(col.yellowBright("    multiSigAddress: ") + col.green(multiSigAddress));
        const isPaused = await (await ethers.getContract("ISovryn")).isProtocolPaused();
        LOG(col.yellowBright("    is the protocol paused?: ") + col.green(isPaused.toString()));
        assert(isPaused);
    });

    it("unpauses all Lending Pools", async () => {
        const multisig = await ethers.getContract("MultiSigWallet");
        const txCountBefore = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountBefore: ") + col.green(txCountBefore.toString()));
        const submitterAcc = (await hre.getNamedAccounts())["exchequerOwner3"];
        await setBalance(submitterAcc, ONE_RBTC);
        await hre.run("pausing:unpause-protocol", { signer: "exchequerOwner3" });
        const txCountAfter = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountAfter: ") + col.green(txCountAfter.toString()));

        assert(txCountAfter.eq(txCountBefore.add(1)));

        const initialConfirmationCount = await multisig.getConfirmationCount(txCountBefore);
        LOG(
            col.yellowBright("    initialConfirmationCount: ") +
                col.green(initialConfirmationCount.toString())
        );
        const firstConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner4"];
        await setBalance(firstConfirmerAcc, ONE_RBTC);
        const confirmerOne = await getImpersonatedSignerFromJsonRpcProvider(firstConfirmerAcc);
        await (await multisig.connect(confirmerOne).confirmTransaction(txCountBefore)).wait();
        // const fisrtConfirmationTxReceipt = await fisrtConfirmationTx.wait();
        const firstConfirmationCount = await multisig.getConfirmationCount(txCountBefore);
        LOG(
            col.yellowBright("    firstConfirmationCount: ") +
                col.green(firstConfirmationCount.toString())
        );

        hre.assert(firstConfirmationCount.eq(initialConfirmationCount.add(1)));

        const secondConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner5"];
        await setBalance(secondConfirmerAcc, ONE_RBTC);
        const confirmerTwo = await getImpersonatedSignerFromJsonRpcProvider(secondConfirmerAcc);
        await (await multisig.connect(confirmerTwo).confirmTransaction(txCountBefore)).wait();
        // const secondConfirmationTxReceipt = await secondConfirmationTx.wait();
        const secondConfirmationCount = await multisig.getConfirmationCount(txCountBefore);
        LOG(
            col.yellowBright("    secondConfirmationCount: ") +
                col.green(secondConfirmationCount.toString())
        );

        hre.assert(secondConfirmationCount.eq(firstConfirmationCount.add(1)));

        const isExecuted = await multisig.isConfirmed(txCountBefore);
        LOG(col.yellowBright("    isExecuted: ") + col.green(isExecuted.toString()));

        hre.assert(isExecuted);
    });

    it("checks Lending Pools are unpaused", async () => {
        const isPaused = await (await ethers.getContract("ISovryn")).isProtocolPaused();
        LOG(col.yellowBright("    isPaused?: ") + col.green(isPaused.toString()));
        assert(!isPaused);
    });
});
