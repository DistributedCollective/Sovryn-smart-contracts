const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const hre = require("hardhat");
const { ethers, network } = hre;
const TASK = "feeSharingCollector:withdrawProtocolWithheldFees";

describe("withheld fee withdrawal task", function () {
    this.timeout(90000);
    let snapshot, directory;

    beforeEach(async function () {
        snapshot = await network.provider.send("evm_snapshot");
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "fsc-withheld-"));
    });

    afterEach(async function () {
        await network.provider.send("evm_revert", [snapshot]);
        fs.rmSync(directory, { recursive: true, force: true });
    });

    async function fixture() {
        const signers = await ethers.getSigners();
        const owners = await Promise.all(signers.slice(0, 3).map((s) => s.getAddress()));
        const wallet = await (await ethers.getContractFactory("MultiSigWallet")).deploy(owners, 3);
        const logic = await (await ethers.getContractFactory("FeeSharingCollector")).deploy();
        const proxy = await (
            await ethers.getContractFactory("FeeSharingCollectorProxy")
        ).deploy(ethers.constants.AddressZero, ethers.constants.AddressZero);
        await proxy.setImplementation(logic.address);
        const collector = logic.attach(proxy.address);
        const token = await (
            await ethers.getContractFactory("TestToken")
        ).deploy("Withheld test token", "WHT", 18, 10000);
        const native = await collector.RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT();
        await collector.addProtocolWithholdToken(native);
        await collector.addProtocolWithholdToken(token.address);
        await collector.transferRBTC({ value: ethers.utils.parseEther("1") });
        await token.approve(collector.address, 500);
        await collector.transferTokens(token.address, 500);
        // Extra custody is outside the protocol-withheld ledger and must remain.
        await signers[0].sendTransaction({ to: collector.address, value: 111 });
        await token.transfer(collector.address, 77);
        await collector.transferOwnership(wallet.address);
        await proxy.setProxyOwner(wallet.address);
        const args = {
            collector: collector.address,
            multisig: wallet.address,
            implementation: logic.address,
            signer: owners[0],
            journal: path.join(directory, "journal.json"),
        };
        return { args, wallet, proxy, collector, token, native, signers };
    }

    it("prepares exact withheld-only calls without loading a signer or moving custody", async function () {
        const { args, wallet, collector, token, native } = await fixture();
        const ops = await hre.run(TASK, args);
        assert.equal(ops.length, 2);
        for (const op of ops) {
            assert.equal(op.to.toLowerCase(), collector.address.toLowerCase());
            assert.equal(op.value, 0);
            const decoded = collector.interface.decodeFunctionData(
                "withdrawProtocolWithheldFees",
                op.data
            );
            assert.equal(decoded._receiver.toLowerCase(), wallet.address.toLowerCase());
            assert.equal(decoded._token.toLowerCase(), op.token.toLowerCase());
        }
        assert.equal(
            ops.find((o) => o.token.toLowerCase() === native.toLowerCase()).amount,
            "1000000000000000000"
        );
        assert.equal(
            ops.find((o) => o.token.toLowerCase() === token.address.toLowerCase()).amount,
            "500"
        );
        assert((await token.balanceOf(collector.address)).eq(577));
        assert((await wallet.transactionCount()).isZero());
        assert(!fs.existsSync(args.journal));
    });

    it("submits each asset sequentially without wallet history scans, then transfers only withheld fees after quorum", async function () {
        const { args, wallet, collector, token, native, signers } = await fixture();
        const module = require("../../hardhat/tasks/fsc-withheld-withdrawals");
        let outstanding = false;
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                if (method === "eth_call") {
                    assert(
                        !["0x54741525", "0xa8abe69a"].includes(params[0].data.slice(0, 10)),
                        "Wallet history scan forbidden"
                    );
                }
                if (method === "eth_sendTransaction" && outstanding) {
                    throw new Error("transaction nonce too high");
                }
                const result = await network.provider.request({ method, params });
                if (method === "eth_sendTransaction") outstanding = true;
                if (method === "eth_getTransactionReceipt" && result) outstanding = false;
                return result;
            },
        });
        provider.getNetwork = async () => ({ name: "local", chainId: 30 });
        const runtime = {
            ethers: { ...ethers, provider, getSigner: async (a) => provider.getSigner(a) },
        };
        const state = await module.withdrawWithheld({ ...args, submit: true }, runtime);
        assert.equal(state.submissions.length, 2);
        for (const record of state.submissions) {
            assert.equal((await wallet.getConfirmationCount(record.proposalId)).toNumber(), 1);
            assert.equal((await wallet.transactions(record.proposalId)).executed, false);
        }
        await module.withdrawWithheld({ ...args, submit: true }, runtime);
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
        for (const record of state.submissions) {
            await wallet.connect(signers[1]).confirmTransaction(record.proposalId);
            await wallet
                .connect(signers[2])
                .confirmTransaction(record.proposalId, { gasLimit: 1000000 });
            assert.equal((await wallet.transactions(record.proposalId)).executed, true);
        }
        assert(
            (await ethers.provider.getBalance(wallet.address)).eq(ethers.utils.parseEther("1"))
        );
        assert((await ethers.provider.getBalance(collector.address)).eq(111));
        assert((await token.balanceOf(wallet.address)).eq(500));
        assert((await token.balanceOf(collector.address)).eq(77));
        assert((await collector.getProtocolWithheldFees(native)).isZero());
        assert((await collector.getProtocolWithheldFees(token.address)).isZero());
    });

    it("accepts RBTC explicitly and can withdraw a token removed from the current withhold list", async function () {
        const { args, wallet, collector, token, native } = await fixture();
        const nativeOps = await hre.run(TASK, { ...args, token: "RBTC" });
        assert.equal(nativeOps.length, 1);
        assert.equal(nativeOps[0].token.toLowerCase(), native.toLowerCase());
        await network.provider.send("hardhat_impersonateAccount", [wallet.address]);
        await network.provider.send("hardhat_setBalance", [
            wallet.address,
            "0x1000000000000000000",
        ]);
        await collector
            .connect(await ethers.getSigner(wallet.address))
            .removeProtocolWithholdToken(token.address);
        const ops = await hre.run(TASK, { ...args, token: token.address });
        assert.equal(ops.length, 1);
        assert.equal(ops[0].amount, "500");
    });

    it("skips a zero withheld balance without submitting a transaction", async function () {
        const { args, wallet, signers } = await fixture();
        const ops = await hre.run(TASK, { ...args, token: signers[8].address, submit: true });
        assert.equal(ops.length, 0);
        assert((await wallet.transactionCount()).isZero());
    });

    it("refuses an unexpected implementation and a non-owner configured signer", async function () {
        const { args, wallet, signers } = await fixture();
        await assert.rejects(
            hre.run(TASK, { ...args, implementation: signers[7].address }),
            /implementation/i
        );
        await assert.rejects(
            hre.run(TASK, { ...args, signer: signers[7].address, submit: true }),
            /not a multisig owner/i
        );
        assert((await wallet.transactionCount()).isZero());
    });

    it("rejects an explicitly empty token instead of expanding to all assets", async function () {
        const { args, wallet } = await fixture();
        for (const token of ["", "   "]) {
            await assert.rejects(hre.run(TASK, { ...args, token, submit: true }), /token.*empty/i);
        }
        assert((await wallet.transactionCount()).isZero());
        assert(!fs.existsSync(args.journal));
    });

    it("revalidates a completed journal submission after a chain reorg before sending anything else", async function () {
        const { args, wallet } = await fixture();
        const beforeSubmission = await network.provider.send("evm_snapshot");
        const state = await hre.run(TASK, { ...args, token: "RBTC", submit: true });
        assert.equal(state.submissions.length, 1);
        assert.equal(state.submissions[0].proposalId, "0");
        await network.provider.send("evm_revert", [beforeSubmission]);
        assert((await wallet.transactionCount()).isZero());
        const provider = new ethers.providers.Web3Provider(network.provider);
        provider.getNetwork = async () => ({ name: "local", chainId: 30 });
        provider.waitForTransaction = (hash) => provider.getTransactionReceipt(hash);
        const runtime = {
            ethers: { ...ethers, provider, getSigner: async (a) => provider.getSigner(a) },
        };
        const { withdrawWithheld } = require("../../hardhat/tasks/fsc-withheld-withdrawals");
        await assert.rejects(
            withdrawWithheld({ ...args, submit: true }, runtime),
            /failed\/pending/i
        );
        assert((await wallet.transactionCount()).isZero());
    });

    it("stops on receipt interruption and resumes the recorded broadcast before another send", async function () {
        const { args, wallet } = await fixture();
        const { withdrawWithheld } = require("../../hardhat/tasks/fsc-withheld-withdrawals");
        const provider = new ethers.providers.Web3Provider(network.provider);
        provider.getNetwork = async () => ({ name: "local", chainId: 30 });
        const runtime = {
            ethers: { ...ethers, provider, getSigner: async (a) => provider.getSigner(a) },
        };
        const wait = provider.waitForTransaction;
        provider.waitForTransaction = async () => null;
        try {
            await assert.rejects(
                withdrawWithheld({ ...args, submit: true }, runtime),
                /failed\/pending/i
            );
        } finally {
            provider.waitForTransaction = wait;
        }
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
        const state = await withdrawWithheld({ ...args, submit: true }, runtime);
        assert.equal(state.submissions.length, 2);
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });

    for (const [message, uncertain] of [
        ["socket hang up", true],
        ["transaction nonce too high", false],
    ]) {
        it(`preserves the correct retry state after ${message}`, async function () {
            const { args, wallet } = await fixture();
            const { withdrawWithheld } = require("../../hardhat/tasks/fsc-withheld-withdrawals");
            const provider = new ethers.providers.Web3Provider({
                request: async ({ method, params }) => {
                    if (method === "eth_sendTransaction") {
                        if (uncertain) await network.provider.request({ method, params });
                        throw new Error(message);
                    }
                    return network.provider.request({ method, params });
                },
            });
            provider.getNetwork = async () => ({ name: "local", chainId: 30 });
            const runtime = {
                ethers: { ...ethers, provider, getSigner: async (a) => provider.getSigner(a) },
            };
            await assert.rejects(
                withdrawWithheld({ ...args, submit: true }, runtime),
                new RegExp(message)
            );
            const state = JSON.parse(fs.readFileSync(args.journal, "utf8"));
            assert.equal(Boolean(state.inFlight), uncertain);
            assert.equal(state.submissions.length, 0);
            assert.equal((await wallet.transactionCount()).toNumber(), uncertain ? 1 : 0);
            if (uncertain) {
                await assert.rejects(
                    withdrawWithheld({ ...args, submit: true }, hre),
                    /Uncertain prior send/
                );
                assert.equal((await wallet.transactionCount()).toNumber(), 1);
            } else {
                const complete = await withdrawWithheld({ ...args, submit: true }, hre);
                assert.equal(complete.submissions.length, 2);
            }
        });
    }

    it("stops before another submission when the stored multisig transaction mismatches", async function () {
        const { args, wallet } = await fixture();
        const { withdrawWithheld } = require("../../hardhat/tasks/fsc-withheld-withdrawals");
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                const result = await network.provider.request({ method, params });
                if (
                    method === "eth_call" &&
                    params[0].to.toLowerCase() === wallet.address.toLowerCase() &&
                    params[0].data.startsWith(wallet.interface.getSighash("transactions"))
                ) {
                    const stored = wallet.interface.decodeFunctionResult("transactions", result);
                    return wallet.interface.encodeFunctionResult("transactions", [
                        stored.destination,
                        1,
                        stored.data,
                        stored.executed,
                    ]);
                }
                return result;
            },
        });
        provider.getNetwork = async () => ({ name: "local", chainId: 30 });
        const runtime = {
            ethers: { ...ethers, provider, getSigner: async (a) => provider.getSigner(a) },
        };
        await assert.rejects(
            withdrawWithheld({ ...args, submit: true }, runtime),
            /Stored multisig transaction mismatch/
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
        const partial = JSON.parse(fs.readFileSync(args.journal, "utf8"));
        assert.equal(partial.submissions.length, 1);
        assert.equal(partial.submissions[0].proposalId, undefined);
        const complete = await withdrawWithheld({ ...args, submit: true }, hre);
        assert.equal(complete.submissions.length, 2);
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });
});
