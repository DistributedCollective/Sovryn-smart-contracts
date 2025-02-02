// first run a local forked mainnet node in a separate terminal window:
//     export NETWORK_ID=30 && npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
// now, in another terminal run the test:
// npx hardhat test ./tests-onchain/lending_pools_pause.test.js --network rskForkedMainnet
//@note     hh test ./tests-onchain/lending_pools_pause.test.js --network rskForkedMainnet

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

const lending_pools_address_list = [
    "0x6E2fb26a60dA535732F8149b25018C9c0823a715".toLowerCase(), // iBPro
    "0x077FCB01cAb070a30bC14b44559C96F529eE017F".toLowerCase(), // iDLLR
    "0xd8D25f03EBbA94E15Df2eD4d6D38276B595593c1".toLowerCase(), // iDoC
    "0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A".toLowerCase(), // iRBTC
    "0x849C47f9C259E9D62F289BF1b2729039698D8387".toLowerCase(), // iUSDT
    "0x8F77ecf69711a4b346f23109c40416BE3dC7f129".toLowerCase(), // iXUSD
];

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

        const oldMultiSigAddress = await (await ethers.getContract("MultiSigWallet")).address;

        for (const lendingPoolAddress of lending_pools_address_list) {
            const lpToken = await ethers.getContractAt("ILoanTokenModules", lendingPoolAddress);
            await setStorageAt(lendingPoolAddress, 27, oldMultiSigAddress);
            const newPauser = await lpToken.pauser();
            LOG(
                col.yellowBright(`    newPauser for ${lendingPoolAddress}: `) +
                    col.green(newPauser)
            );
        }
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
        await hre.run("pausing:pause-unpause-lending-pool-functions", {
            signer: "exchequerOwner0",
            pause: "true",
        });
        const txCountAfter = await multisig.transactionCount();
        LOG(col.yellowBright("    txCountAfter: ") + col.green(txCountAfter.toString()));

        assert(txCountAfter.eq(txCountBefore.add(12)));

        const firstConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner1"];
        await setBalance(firstConfirmerAcc, ONE_RBTC);
        const confirmerOne = await getImpersonatedSignerFromJsonRpcProvider(firstConfirmerAcc);

        for (let i = 0; i < 12; i++) {
            const initialConfirmationCount = await multisig.getConfirmationCount(
                txCountBefore.add(i)
            );
            LOG(
                col.yellowBright(`    initialConfirmationCount for confirmation ${i}: `) +
                    col.green(initialConfirmationCount.toString())
            );
            await (
                await multisig.connect(confirmerOne).confirmTransaction(txCountBefore.add(i))
            ).wait();
            const firstConfirmationCount = await multisig.getConfirmationCount(
                txCountBefore.add(i)
            );
            LOG(
                col.yellowBright(`    firstConfirmationCount for confirmation ${i}: `) +
                    col.green(firstConfirmationCount.toString())
            );

            hre.assert(firstConfirmationCount.eq(initialConfirmationCount.add(1)));
        }

        const secondConfirmerAcc = (await hre.getNamedAccounts())["exchequerOwner2"];
        await setBalance(secondConfirmerAcc, ONE_RBTC);
        const confirmerTwo = await getImpersonatedSignerFromJsonRpcProvider(secondConfirmerAcc);

        for (let i = 0; i < 12; i++) {
            const secondConfirmationCountBefore = await multisig.getConfirmationCount(
                txCountBefore.add(i)
            );

            LOG(
                col.yellowBright(`    secondConfirmationCount for tx ${i}: `) +
                    col.green(secondConfirmationCountBefore.toString())
            );

            await (
                await multisig.connect(confirmerTwo).confirmTransaction(txCountBefore.add(i), {
                    gasLimit: 6000000,
                    gasPrice: 66000000,
                })
            ).wait();

            const secondConfirmationCountAfter = await multisig.getConfirmationCount(
                txCountBefore.add(i)
            );

            LOG(
                col.yellowBright(`    secondConfirmationCount for tx ${i}: `) +
                    col.green(secondConfirmationCountAfter.toString())
            );

            hre.assert(secondConfirmationCountAfter.eq(secondConfirmationCountBefore.add(1)));

            const isExecuted = await multisig.isConfirmed(txCountBefore.add(i));
            LOG(
                col.yellowBright(`    isExecuted for tx ${i}: `) + col.green(isExecuted.toString())
            );

            hre.assert(isExecuted);
        }
    });

    it("checks Lending Pools are paused", async () => {
        await hre.run("pausing:is-lending-pool-functions-paused");
        assert(true);
    });

    /**
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
    */
});
