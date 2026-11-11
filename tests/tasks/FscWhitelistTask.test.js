const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;
const taskModule = require("../../hardhat/tasks/fsc-whitelist-removals");
describe("collector whitelist proposal task", function () {
    it("encodes exact zero-value collector removal operations", function () {
        const collector = "0x" + "11".repeat(20);
        const converters = Array.from({ length: 20 }, (_, i) =>
            ethers.utils.getAddress("0x" + (i + 1).toString(16).padStart(40, "0"))
        );
        const ops = taskModule.operations(ethers, collector, converters);
        assert.equal(ops.length, 20);
        for (const o of ops) {
            assert.equal(o.to, collector);
            assert.equal(o.value, 0);
            assert.equal(
                o.data.toLowerCase(),
                "0xa4955f2a" + "0".repeat(24) + o.converter.slice(2).toLowerCase()
            );
        }
    });
    it("refuses wrong network, owner, implementation or immediate-execution quorum", function () {
        const a = "0x" + "11".repeat(20),
            b = "0x" + "22".repeat(20);
        assert.doesNotThrow(() => taskModule.checkAuthority(30, a, a, a, b, b, 3));
        for (const values of [
            [1, a, a, a, b, b, 3],
            [30, b, a, a, b, b, 3],
            [30, a, a, a, a, b, 3],
            [30, a, a, a, b, b, 1],
        ]) {
            assert.throws(() => taskModule.checkAuthority(...values));
        }
    });
});

describe("collector whitelist sequential submissions", function () {
    this.timeout(90000);
    let directory;
    let snapshot;

    beforeEach(async function () {
        snapshot = await hre.network.provider.send("evm_snapshot");
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "fsc-sequential-"));
    });

    afterEach(async function () {
        await hre.network.provider.send("evm_revert", [snapshot]);
        fs.rmSync(directory, { recursive: true, force: true });
    });

    async function fixture({ rejectHistory = false, sendError, converterCount = 2 } = {}) {
        const signers = await ethers.getSigners();
        const owners = await Promise.all(signers.slice(0, 3).map((s) => s.getAddress()));
        const wallet = await (await ethers.getContractFactory("MultiSigWallet")).deploy(owners, 3);
        const implementation = await (
            await ethers.getContractFactory("FeeSharingCollector")
        ).deploy();
        const proxy = await (
            await ethers.getContractFactory("FeeSharingCollectorProxy")
        ).deploy(ethers.constants.AddressZero, ethers.constants.AddressZero);
        await proxy.setImplementation(implementation.address);
        const collector = await ethers.getContractAt("FeeSharingCollector", proxy.address);
        const converters = [];
        for (let i = 0; i < converterCount; i++) {
            const converter = await new ethers.ContractFactory(
                [],
                "0x6001600c60003960016000f300",
                signers[0]
            ).deploy();
            converters.push(converter.address);
            await collector.addWhitelistedConverterAddress(converter.address);
        }
        await collector.transferOwnership(wallet.address);
        await proxy.setProxyOwner(wallet.address);
        let outstanding = false;
        const historySelectors = new Set([
            "0x54741525", // getTransactionCount(bool,bool)
            ethers.utils.id("getTransactionIds(uint256,uint256,bool,bool)").slice(0, 10),
        ]);
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                if (
                    rejectHistory &&
                    method === "eth_call" &&
                    historySelectors.has(params[0].data.slice(0, 10))
                ) {
                    throw new Error("Wallet history scan disabled");
                }
                if (method === "eth_sendTransaction") {
                    if (sendError) throw new Error(sendError);
                    if (outstanding) throw new Error("transaction nonce too high");
                }
                const result = await hre.network.provider.request({ method, params });
                if (method === "eth_sendTransaction") outstanding = true;
                if (method === "eth_getTransactionReceipt" && result) outstanding = false;
                return result;
            },
        });
        // The contracts run locally; only the task's chain gate sees the mainnet ID.
        provider.getNetwork = async () => ({ chainId: 30, name: "local-mainnet-fixture" });
        return {
            wallet,
            collector,
            args: {
                collector: collector.address,
                multisig: wallet.address,
                implementation: implementation.address,
                signer: owners[0],
                journal: path.join(directory, "journal.json"),
                submit: true,
            },
            runtime: {
                ethers: {
                    ...ethers,
                    provider,
                    getSigner: async (address) => provider.getSigner(address),
                },
            },
        };
    }

    it("submits without scanning wallet history", async function () {
        const { args, runtime, wallet } = await fixture({ rejectHistory: true });
        const converter = (
            await (
                await ethers.getContractAt("FeeSharingCollector", args.collector)
            ).getWhitelistedConverterList()
        )[0];
        const data = new ethers.utils.Interface(taskModule.FSC_ABI).encodeFunctionData(
            "removeWhitelistedConverterAddress",
            [converter]
        );
        await wallet.submitTransaction(args.collector, 0, data);
        const state = await taskModule.run(args, runtime);
        assert.equal(state.submissions.length, 2);
        assert.equal((await wallet.transactionCount()).toNumber(), 3);
    });

    it("mines and verifies each proposal before sending the next, then resumes its journal", async function () {
        const { args, runtime, wallet, collector } = await fixture({ converterCount: 20 });
        const state = await taskModule.run(args, runtime);
        assert.equal(state.submissions.length, 20);
        for (const record of state.submissions) {
            assert.notEqual(record.proposalId, undefined);
            assert.equal((await wallet.getConfirmationCount(record.proposalId)).toNumber(), 1);
            assert.equal((await wallet.transactions(record.proposalId)).executed, false);
        }
        assert.equal((await collector.getWhitelistedConverterList()).length, 20);
        await taskModule.run(args, runtime);
        assert.equal((await wallet.transactionCount()).toNumber(), 20);
    });

    it("keeps a definitive nonce rejection retryable", async function () {
        const { args, runtime, wallet } = await fixture({
            sendError: "transaction nonce too high",
        });
        await assert.rejects(taskModule.run(args, runtime), /transaction nonce too high/);
        const state = JSON.parse(fs.readFileSync(args.journal, "utf8"));
        assert.equal(state.inFlight, null);
        assert.equal(state.submissions.length, 0);
        assert.equal((await wallet.transactionCount()).toNumber(), 0);
    });

    it("stops on an unconfirmed receipt and confirms that recorded broadcast before resuming", async function () {
        const { args, runtime, wallet } = await fixture();
        const wait = runtime.ethers.provider.waitForTransaction.bind(runtime.ethers.provider);
        runtime.ethers.provider.waitForTransaction = async () => null;
        await assert.rejects(taskModule.run(args, runtime), /Submission failed\/pending/);
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
        const partial = JSON.parse(fs.readFileSync(args.journal, "utf8"));
        assert.equal(partial.submissions.length, 1);
        assert.equal(partial.submissions[0].proposalId, undefined);
        runtime.ethers.provider.waitForTransaction = wait;
        const complete = await taskModule.run(args, runtime);
        assert.equal(complete.submissions.length, 2);
        assert(complete.submissions.every((record) => record.proposalId !== undefined));
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });

    it("preserves the uncertain-send marker on a transport failure", async function () {
        const { args, runtime } = await fixture({ sendError: "socket hang up" });
        await assert.rejects(taskModule.run(args, runtime), /socket hang up/);
        const state = JSON.parse(fs.readFileSync(args.journal, "utf8"));
        assert.notEqual(state.inFlight, null);
        await assert.rejects(taskModule.run(args, runtime), /Uncertain prior send/);
    });
});
