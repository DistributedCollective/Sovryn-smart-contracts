const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const solc = require("solc");
const hre = require("hardhat");
const { ethers, network } = hre;
const TASK = "babelfish:pause-bassets";

// Only the external Babelfish discovery/pause API is a fixture. Submissions,
// confirmations, receipts and execution use the repository's real multisig.
const source = `pragma solidity ^0.7.3;
contract BabelfishPauseFixture {
    address public owner;
    address public pauseManager;
    address public basketManager;
    address[] private bassets;
    mapping(address => bool) public isPaused;
    constructor(address wallet, address[] memory tokens) {
        owner = wallet; pauseManager = address(this); basketManager = address(this); bassets = tokens;
    }
    function getPauseManager() external view returns(address) { return pauseManager; }
    function getBasketManager() external view returns(address) { return basketManager; }
    function getBassets() external view returns(address[] memory) { return bassets; }
    function setOwner(address value) external { owner = value; }
    function setBassets(address[] calldata value) external { bassets = value; }
    function setPauseManager(address value) external { pauseManager = value; }
    function setPaused(address token, bool value) external { isPaused[token] = value; }
    function unpause(address token) external {
        require(msg.sender == owner, "not owner");
        require(isPaused[token], "not paused"); isPaused[token] = false;
    }
    function pause(address token) external {
        require(msg.sender == owner, "not pauser or owner");
        require(!isPaused[token], "already paused"); isPaused[token] = true;
    }
}`;
let artifact;
function fixtureArtifact() {
    if (!artifact) {
        const output = JSON.parse(
            solc.compile(
                JSON.stringify({
                    language: "Solidity",
                    sources: { "Fixture.sol": { content: source } },
                    settings: {
                        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
                    },
                })
            )
        );
        const errors = (output.errors || []).filter((e) => e.severity === "error");
        assert.equal(errors.length, 0, JSON.stringify(errors));
        artifact = output.contracts["Fixture.sol"].BabelfishPauseFixture;
    }
    return artifact;
}

describe("Babelfish basset pause task", function () {
    this.timeout(90000);
    let snapshot, directory;
    beforeEach(async function () {
        snapshot = await network.provider.send("evm_snapshot");
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "babelfish-pause-task-"));
    });
    afterEach(async function () {
        await network.provider.send("evm_revert", [snapshot]);
        fs.rmSync(directory, { recursive: true, force: true });
    });
    async function fixture(required = 3) {
        const signers = await ethers.getSigners();
        const owners = signers.slice(0, 5).map((s) => s.address);
        const wallet = await (
            await ethers.getContractFactory("MultiSigWallet")
        ).deploy(owners, required);
        const tokens = signers.slice(7, 10).map((s) => s.address);
        const a = fixtureArtifact();
        const masset = await new ethers.ContractFactory(
            a.abi,
            a.evm.bytecode.object,
            signers[0]
        ).deploy(wallet.address, tokens);
        await masset.setPaused(tokens[1], true);
        const args = {
            masset: masset.address,
            pausemanager: masset.address,
            multisig: wallet.address,
            signer: owners[0],
            journal: path.join(directory, "journal.json"),
        };
        return { args, masset, wallet, tokens, signers };
    }
    function runtime(provider) {
        return { ethers: { ...ethers, provider, getSigner: async (a) => provider.getSigner(a) } };
    }

    it("prepares only current unpaused bassets, with no signer or submission", async function () {
        const { args, masset, wallet, tokens } = await fixture();
        const provider = new ethers.providers.Web3Provider(network.provider);
        const rt = runtime(provider);
        rt.ethers.getSigner = async () => {
            throw new Error("Dry run must not load a signer");
        };
        const { pauseBassets } = require("../../hardhat/tasks/babelfish");
        const ops = await pauseBassets(args, rt);
        assert.deepEqual(
            ops.map((o) => o.token),
            [tokens[0], tokens[2]]
        );
        for (const op of ops) {
            assert.equal(op.to, masset.address);
            assert.equal(op.value, 0);
            assert.equal(masset.interface.decodeFunctionData("pause", op.data)[0], op.token);
        }
        assert((await wallet.transactionCount()).isZero());
        assert(!fs.existsSync(args.journal));
    });

    it("waits for each successful receipt and stored multisig transaction before sending the next", async function () {
        const { args, masset, wallet, tokens, signers } = await fixture();
        let outstanding = false,
            receipts = 0,
            sends = 0;
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                if (method === "eth_sendTransaction") {
                    assert(!outstanding, "Next submission sent before previous receipt");
                    outstanding = true;
                    sends++;
                }
                const result = await network.provider.request({ method, params });
                if (method === "eth_getTransactionReceipt" && result) {
                    outstanding = false;
                    receipts++;
                }
                return result;
            },
        });
        const { pauseBassets } = require("../../hardhat/tasks/babelfish");
        const state = await pauseBassets({ ...args, submit: true }, runtime(provider));
        assert.equal(sends, 2);
        assert(receipts >= 2);
        assert.equal(state.submissions.length, 2);
        for (const r of state.submissions) {
            assert.equal(
                (await wallet.getConfirmationCount(r.multisigTransactionId)).toNumber(),
                1
            );
            const stored = await wallet.transactions(r.multisigTransactionId);
            assert.equal(stored.destination, masset.address);
            assert(stored.value.isZero());
            assert.equal(stored.executed, false);
            assert.equal(await masset.isPaused(r.token), false);
        }
        await pauseBassets({ ...args, submit: true }, runtime(provider));
        assert.equal(sends, 2, "Same journal must not duplicate submissions");
        for (const r of state.submissions) {
            await wallet.connect(signers[1]).confirmTransaction(r.multisigTransactionId);
            assert.equal(await masset.isPaused(r.token), false);
            await wallet
                .connect(signers[2])
                .confirmTransaction(r.multisigTransactionId, { gasLimit: 500000 });
            assert.equal(await masset.isPaused(r.token), true);
        }
        assert.equal(await masset.isPaused(tokens[1]), true);
    });

    it("stops on a missing receipt and resumes that broadcast before another send", async function () {
        const { args, wallet } = await fixture();
        const provider = new ethers.providers.Web3Provider(network.provider);
        provider.waitForTransaction = async () => null;
        const { pauseBassets } = require("../../hardhat/tasks/babelfish");
        await assert.rejects(
            pauseBassets({ ...args, submit: true }, runtime(provider)),
            /failed\/pending/i
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
        const state = await pauseBassets({ ...args, submit: true }, hre);
        assert.equal(state.submissions.length, 2);
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });

    it("refuses a mismatched stored transaction before sending another", async function () {
        const { args, wallet } = await fixture();
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                const result = await network.provider.request({ method, params });
                if (
                    method === "eth_call" &&
                    params[0].to.toLowerCase() === wallet.address.toLowerCase() &&
                    params[0].data.startsWith(wallet.interface.getSighash("transactions"))
                ) {
                    const r = wallet.interface.decodeFunctionResult("transactions", result);
                    return wallet.interface.encodeFunctionResult("transactions", [
                        r.destination,
                        1,
                        r.data,
                        r.executed,
                    ]);
                }
                return result;
            },
        });
        const { pauseBassets } = require("../../hardhat/tasks/babelfish");
        await assert.rejects(
            pauseBassets({ ...args, submit: true }, runtime(provider)),
            /Stored multisig transaction mismatch/
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
    });

    it("supports one selected basket asset and rejects empty or non-basket selections", async function () {
        const { args, tokens, signers, wallet } = await fixture();
        const ops = await hre.run(TASK, { ...args, token: tokens[2] });
        assert.deepEqual(
            ops.map((o) => o.token),
            [tokens[2]]
        );
        for (const token of ["", "  ", signers[6].address]) {
            await assert.rejects(
                hre.run(TASK, { ...args, token, submit: true }),
                /empty|not.*basket/i
            );
        }
        assert((await wallet.transactionCount()).isZero());
    });

    it("refuses wrong chain, unexpected pause manager, owner or quorum and a non-owner signer", async function () {
        const { args, masset, wallet, signers } = await fixture();
        const { pauseBassets } = require("../../hardhat/tasks/babelfish");
        const provider = new ethers.providers.Web3Provider(network.provider);
        provider.getNetwork = async () => ({ chainId: 31, name: "wrong" });
        await assert.rejects(pauseBassets(args, runtime(provider)), /chain.*30/i);
        await assert.rejects(
            hre.run(TASK, { ...args, pausemanager: signers[6].address }),
            /pause manager/i
        );
        await assert.rejects(
            hre.run(TASK, { ...args, signer: signers[6].address, submit: true }),
            /not a multisig owner/i
        );
        await masset.setOwner(signers[6].address);
        await assert.rejects(hre.run(TASK, args), /owner.*mismatch/i);
        assert((await wallet.transactionCount()).isZero());
        const other = await fixture(1);
        await assert.rejects(hre.run(TASK, other.args), /quorum.*3/i);
    });

    it("retains an uncertain send marker and refuses automatic resubmission", async function () {
        const { args, wallet } = await fixture();
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                const result = await network.provider.request({ method, params });
                if (method === "eth_sendTransaction") throw new Error("socket hang up");
                return result;
            },
        });
        const { pauseBassets } = require("../../hardhat/tasks/babelfish");
        await assert.rejects(
            pauseBassets({ ...args, submit: true }, runtime(provider)),
            /socket hang up/
        );
        assert(JSON.parse(fs.readFileSync(args.journal)).inFlight);
        await assert.rejects(pauseBassets({ ...args, submit: true }, hre), /Uncertain prior send/);
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
    });

    async function executeAll(state, wallet, signers) {
        for (const record of state.submissions) {
            await wallet.connect(signers[1]).confirmTransaction(record.multisigTransactionId);
            await wallet
                .connect(signers[2])
                .confirmTransaction(record.multisigTransactionId, { gasLimit: 500000 });
            assert((await wallet.transactions(record.multisigTransactionId)).executed);
        }
    }
    function reverseArgs(args) {
        return {
            ...args,
            pausejournal: args.journal,
            journal: path.join(directory, "unpause.json"),
        };
    }

    it("unpause preview selects only executed pauses from this run and preserves the original baseline", async function () {
        const { args, masset, wallet, tokens, signers } = await fixture();
        const paused = await hre.run(TASK, { ...args, submit: true });
        await executeAll(paused, wallet, signers);
        assert.deepEqual(paused.baseline.pausedTokens, [tokens[1]]);
        const ops = await hre.run("babelfish:unpause-bassets", reverseArgs(args));
        assert.deepEqual(
            ops.map((o) => o.token),
            [tokens[0], tokens[2]]
        );
        for (const op of ops)
            assert.equal(masset.interface.decodeFunctionData("unpause", op.data)[0], op.token);
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
        assert(!fs.existsSync(reverseArgs(args).journal));
    });

    it("unpause transactions wait for previous receipts, resume without duplicates and leave pre-existing pauses intact", async function () {
        const { args, masset, wallet, tokens, signers } = await fixture();
        const paused = await hre.run(TASK, { ...args, submit: true });
        await executeAll(paused, wallet, signers);
        const original = fs.readFileSync(args.journal, "utf8");
        let outstanding = false,
            sends = 0;
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                if (method === "eth_sendTransaction") {
                    assert(!outstanding, "Next unpause submission sent before previous receipt");
                    outstanding = true;
                    sends++;
                }
                const result = await network.provider.request({ method, params });
                if (method === "eth_getTransactionReceipt" && result) outstanding = false;
                return result;
            },
        });
        const { unpauseBassets } = require("../../hardhat/tasks/babelfish");
        const state = await unpauseBassets(
            { ...reverseArgs(args), submit: true },
            runtime(provider)
        );
        assert.equal(sends, 2);
        assert.equal(await masset.isPaused(tokens[0]), true);
        await unpauseBassets({ ...reverseArgs(args), submit: true }, runtime(provider));
        assert.equal(sends, 2);
        await executeAll(state, wallet, signers);
        assert.equal(await masset.isPaused(tokens[0]), false);
        assert.equal(await masset.isPaused(tokens[2]), false);
        assert.equal(await masset.isPaused(tokens[1]), true);
        assert.equal(fs.readFileSync(args.journal, "utf8"), original);
    });

    it("refuses unpause while any original pause transaction remains unexecuted", async function () {
        const { args, wallet } = await fixture();
        await hre.run(TASK, { ...args, submit: true });
        await assert.rejects(
            hre.run("babelfish:unpause-bassets", { ...reverseArgs(args), submit: true }),
            /pause.*not executed/i
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });

    it("recovers the baseline for original journals and refuses a pre-existing paused token", async function () {
        const { args, wallet, tokens, signers } = await fixture();
        const paused = await hre.run(TASK, { ...args, submit: true });
        await executeAll(paused, wallet, signers);
        delete paused.baseline;
        delete paused.action;
        fs.writeFileSync(args.journal, JSON.stringify(paused));
        const ops = await hre.run("babelfish:unpause-bassets", reverseArgs(args));
        assert.deepEqual(
            ops.map((o) => o.token),
            [tokens[0], tokens[2]]
        );
        await assert.rejects(
            hre.run("babelfish:unpause-bassets", {
                ...reverseArgs(args),
                token: tokens[1],
                submit: true,
            }),
            /not.*pause run/i
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });

    it("refuses tampered pause calldata or baseline instead of expanding unpause scope", async function () {
        const { args, wallet, tokens, signers } = await fixture();
        const paused = await hre.run(TASK, { ...args, submit: true });
        await executeAll(paused, wallet, signers);
        const original = fs.readFileSync(args.journal, "utf8");
        const tampered = JSON.parse(original);
        tampered.submissions[0].token = tokens[1];
        fs.writeFileSync(args.journal, JSON.stringify(tampered));
        await assert.rejects(
            hre.run("babelfish:unpause-bassets", { ...reverseArgs(args), submit: true }),
            /pause.*calldata|source.*mismatch/i
        );
        const wrongBaseline = JSON.parse(original);
        wrongBaseline.baseline.pausedTokens = [];
        fs.writeFileSync(args.journal, JSON.stringify(wrongBaseline));
        await assert.rejects(
            hre.run("babelfish:unpause-bassets", { ...reverseArgs(args), submit: true }),
            /baseline.*mismatch/i
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });

    it("refuses an active or uncertain pause run and prevents overwriting its source journal", async function () {
        const { args, wallet, signers } = await fixture();
        const paused = await hre.run(TASK, { ...args, submit: true });
        await executeAll(paused, wallet, signers);
        await assert.rejects(
            hre.run("babelfish:unpause-bassets", {
                ...reverseArgs(args),
                journal: args.journal,
                submit: true,
            }),
            /different.*journal/i
        );
        fs.writeFileSync(args.journal + ".lock", "");
        await assert.rejects(
            hre.run("babelfish:unpause-bassets", reverseArgs(args)),
            /pause.*running|pause.*lock/i
        );
        fs.unlinkSync(args.journal + ".lock");
        paused.inFlight = { token: paused.submissions[0].token };
        fs.writeFileSync(args.journal, JSON.stringify(paused));
        await assert.rejects(
            hre.run("babelfish:unpause-bassets", reverseArgs(args)),
            /uncertain.*pause/i
        );
    });
    it("resumed pause runs do not add assets that were protected by their original baseline", async function () {
        const { args, masset, wallet, tokens } = await fixture();
        await hre.run(TASK, { ...args, token: tokens[0], submit: true });
        await masset.setPaused(tokens[1], false);
        const state = await hre.run(TASK, { ...args, submit: true });
        assert.deepEqual(
            state.submissions.map((r) => r.token),
            [tokens[0], tokens[2]]
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });

    it("refuses to extend a resumed pause run to newly added basket assets", async function () {
        const { args, masset, wallet, tokens, signers } = await fixture();
        await hre.run(TASK, { ...args, token: tokens[0], submit: true });
        await masset.setBassets([...tokens, signers[10].address]);
        await assert.rejects(
            hre.run(TASK, { ...args, submit: true }),
            /outside.*original.*basket/i
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
    });

    it("locks the original pause journal throughout reversal so a concurrent pause resume is refused", async function () {
        const { args, wallet, signers } = await fixture();
        const paused = await hre.run(TASK, { ...args, submit: true });
        await executeAll(paused, wallet, signers);
        let checked = false;
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                if (method === "eth_sendTransaction" && !checked) {
                    checked = true;
                    await assert.rejects(
                        hre.run(TASK, { ...args, submit: true }),
                        (e) => e.code === "EEXIST"
                    );
                }
                return network.provider.request({ method, params });
            },
        });
        const { unpauseBassets } = require("../../hardhat/tasks/babelfish");
        await unpauseBassets({ ...reverseArgs(args), submit: true }, runtime(provider));
        assert(checked);
        assert(!fs.existsSync(args.journal + ".lock"));
        assert(!fs.existsSync(reverseArgs(args).journal + ".lock"));
    });
});
