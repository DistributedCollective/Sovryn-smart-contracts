// first run a local forked mainnet node in a separate terminal window:
//     export NETWORK_ID=30 && npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now, in another terminal run the test:
// npx hardhat test ./tests-onchain/staking_pause_freeze.test.js --network rskForkedMainnet
//@note     hh test ./tests-onchain/staking_pause_freeze.test.js --network rskForkedMainnet

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

describe("Freeze staking - Check is frozen - Unfreeze staking", () => {
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

        const contractAddress = await get("Staking").then((x) => x.address);
        const slot = ethers.BigNumber.from(20); // Staking's storage for pausers mapping: 20
        const oldMultisigAddress = await get("MultiSigWallet").then((x) => x.address);
        const paddedPauserAddress = ethers.utils.hexZeroPad(oldMultisigAddress, 32);
        const paddedSlot = ethers.utils.hexZeroPad(ethers.utils.hexlify(slot), 32);
        const storagePosition = ethers.utils.keccak256(
            paddedPauserAddress + paddedSlot.substring(2)
        );
        const replacingValue = 1;
        await setStorageAt(contractAddress, storagePosition, replacingValue);
        const Staking = await ethers.getContract("Staking");
        const isPauser = await Staking.pausers(oldMultisigAddress);
        LOG(col.yellowBright("    isPauser?: ") + col.green(isPauser.toString()));
    });

    after(async () => {
        await snapshot.restore();
    });

    it("freezes staking", async () => {
        const multisig = await ethers.getContract("MultiSigWallet");
        const txCountBefore = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountBefore: ") + col.green(txCountBefore.toString()));
        const submitterAcc = (await hre.getNamedAccounts())["exchequerOwner0"];
        await setBalance(submitterAcc, ONE_RBTC);
        await hre.run("pausing:freeze-staking-withdrawal", { signer: "exchequerOwner0" });
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
        await (
            await multisig
                .connect(confirmerTwo)
                .confirmTransaction(txCountBefore, { gasLimit: 5000000, gasPrice: 66000000 })
        ).wait();
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

    it("checks staking is frozen", async () => {
        await hre.run("pausing:is-staking-frozen");
        assert(true);
    });

    it("unfreezes staking", async () => {
        const multisig = await ethers.getContract("MultiSigWallet");
        const txCountBefore = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountBefore: ") + col.green(txCountBefore.toString()));
        const submitterAcc = (await hre.getNamedAccounts())["exchequerOwner3"];
        await setBalance(submitterAcc, ONE_RBTC);
        await hre.run("pausing:unfreeze-staking-withdrawal", { signer: "exchequerOwner3" });
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
        const firstConfirmationCount = await multisig.getConfirmationCount(txCountBefore);
        LOG(
            col.yellowBright("    firstConfirmationCount: ") +
                col.green(firstConfirmationCount.toString())
        );

        hre.assert(firstConfirmationCount.eq(initialConfirmationCount.add(1)));

        const secondConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner5"];
        await setBalance(secondConfirmerAcc, ONE_RBTC);
        const confirmerTwo = await getImpersonatedSignerFromJsonRpcProvider(secondConfirmerAcc);
        await (
            await multisig
                .connect(confirmerTwo)
                .confirmTransaction(txCountBefore, { gasLimit: 5000000, gasPrice: 66000000 })
        ).wait();
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

    it("checks staking is unfreezed", async () => {
        await hre.run("pausing:is-staking-frozen");
        assert(true);
    });
});

describe("Pause staking - Check is paused - Unpause staking", () => {
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

        const contractAddress = await get("Staking").then((x) => x.address);
        const slot = ethers.BigNumber.from(20); // Staking's storage for pausers mapping: 20
        const oldMultisigAddress = await get("MultiSigWallet").then((x) => x.address);
        const paddedPauserAddress = ethers.utils.hexZeroPad(oldMultisigAddress, 32);
        const paddedSlot = ethers.utils.hexZeroPad(ethers.utils.hexlify(slot), 32);
        const storagePosition = ethers.utils.keccak256(
            paddedPauserAddress + paddedSlot.substring(2)
        );
        const replacingValue = 1;
        await setStorageAt(contractAddress, storagePosition, replacingValue);
        const Staking = await ethers.getContract("Staking");
        const isPauser = await Staking.pausers(oldMultisigAddress);
        LOG(col.yellowBright("    isPauser?: ") + col.green(isPauser.toString()));
    });

    after(async () => {
        await snapshot.restore();
    });

    it("pauses staking", async () => {
        const multisig = await ethers.getContract("MultiSigWallet");
        const txCountBefore = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountBefore: ") + col.green(txCountBefore.toString()));
        const submitterAcc = (await hre.getNamedAccounts())["exchequerOwner0"];
        await setBalance(submitterAcc, ONE_RBTC);
        await hre.run("pausing:pause-staking", { signer: "exchequerOwner0" });
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
        await (
            await multisig
                .connect(confirmerTwo)
                .confirmTransaction(txCountBefore, { gasLimit: 5000000, gasPrice: 66000000 })
        ).wait();
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

    it("checks staking is paused", async () => {
        await hre.run("pausing:is-staking-paused");
        assert(true);
    });

    it("unpauses staking", async () => {
        const multisig = await ethers.getContract("MultiSigWallet");
        const txCountBefore = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountBefore: ") + col.green(txCountBefore.toString()));
        const submitterAcc = (await hre.getNamedAccounts())["exchequerOwner3"];
        await setBalance(submitterAcc, ONE_RBTC);
        await hre.run("pausing:unpause-staking", { signer: "exchequerOwner3" });
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
        await (
            await multisig
                .connect(confirmerTwo)
                .confirmTransaction(txCountBefore, { gasLimit: 5000000, gasPrice: 66000000 })
        ).wait();
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

    it("checks staking is unpaused", async () => {
        await hre.run("pausing:is-staking-paused");
        assert(true);
    });
});
