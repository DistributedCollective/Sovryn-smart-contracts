const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const solc = require("solc");
const hre = require("hardhat");
const { ethers, network } = hre;
const TASK = "babelfish:emergency-pause";
const EMERGENCY_ALIAS = "babelfish:emergency-pause-mint-redemptions";
const REVERSE = "babelfish:unpause-redemptions";
// Only the external Babelfish API/token is a fixture. All submissions and
// confirmations use the repository's real MultiSigWallet artifact.
const source = `pragma solidity ^0.7.3;
contract SupplyTokenFixture {
 address public owner; uint256 public totalSupply;
 mapping(address => uint256) public balanceOf;
 mapping(address => mapping(address => uint256)) public allowance;
 constructor(address value) { owner = value; }
 function transferOwnership(address value) external { require(msg.sender == owner, "owner"); require(value != address(0), "zero"); owner = value; }
 function mint(address to, uint256 value) external { require(msg.sender == owner, "owner"); totalSupply += value; balanceOf[to] += value; }
 function burn(address from, uint256 value) external { require(msg.sender == owner, "owner"); balanceOf[from] -= value; totalSupply -= value; }
 function transfer(address to, uint256 value) external { balanceOf[msg.sender] -= value; balanceOf[to] += value; }
 function approve(address to, uint256 value) external { allowance[msg.sender][to] = value; }
}
contract RedemptionMassetFixture {
 address public owner; address public token; mapping(address => bool) public isPaused;
 constructor(address wallet) { owner = wallet; }
 function getToken() external view returns(address) { return token; }
 function setToken(address value) external { token = value; }
 function setOwner(address value) external { owner = value; }
 function setPaused(address asset, bool value) external { isPaused[asset] = value; }
 function setTokenOwner(address value) external { require(msg.sender == owner, "owner"); SupplyTokenFixture(token).transferOwnership(value); }
 function mint(uint256 value) external { SupplyTokenFixture(token).mint(msg.sender, value); }
 function redeem(uint256 value) external { SupplyTokenFixture(token).burn(msg.sender, value); }
}`;
let artifacts;
function fixtures() {
    if (!artifacts) {
        const result = JSON.parse(
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
        assert.deepEqual(
            (result.errors || []).filter((e) => e.severity === "error"),
            []
        );
        artifacts = result.contracts["Fixture.sol"];
    }
    return artifacts;
}
function runtime(provider) {
    return { ethers: { ...ethers, provider, getSigner: async (a) => provider.getSigner(a) } };
}
describe("Babelfish aggregate redemption stop tasks", function () {
    this.timeout(90000);
    let snapshot, directory;
    beforeEach(async function () {
        snapshot = await network.provider.send("evm_snapshot");
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "babelfish-redemptions-"));
    });
    afterEach(async function () {
        await network.provider.send("evm_revert", [snapshot]);
        fs.rmSync(directory, { recursive: true, force: true });
    });
    async function fixture(required = 3, ownerCount = 5) {
        const signers = await ethers.getSigners();
        const wallet = await (
            await ethers.getContractFactory("MultiSigWallet")
        ).deploy(
            signers.slice(0, ownerCount).map((s) => s.address),
            required
        );
        async function deploy(name, args) {
            const a = fixtures()[name];
            return new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signers[0]).deploy(
                ...args
            );
        }
        const masset = await deploy("RedemptionMassetFixture", [wallet.address]);
        const token = await deploy("SupplyTokenFixture", [masset.address]);
        await masset.setToken(token.address);
        const args = {
            masset: masset.address,
            xusd: token.address,
            multisig: wallet.address,
            signer: signers[0].address,
            journal: path.join(directory, "stop.json"),
        };
        return { args, masset, token, wallet, signers };
    }
    const reverse = (args) => ({
        ...args,
        pausejournal: args.journal,
        journal: path.join(directory, "restore.json"),
    });
    async function execute(state, wallet, signers) {
        const id = state.submissions[0].multisigTransactionId;
        await wallet.connect(signers[1]).confirmTransaction(id);
        assert.equal((await wallet.transactions(id)).executed, false);
        await wallet.connect(signers[2]).confirmTransaction(id);
        assert.equal((await wallet.transactions(id)).executed, true);
    }
    it("emergency aliases share the original default journal and never duplicate a submission", async function () {
        const { args, wallet } = await fixture();
        const { journal, ...defaults } = args;
        const original = process.cwd();
        process.chdir(directory);
        try {
            const state = await hre.run(TASK, { ...defaults, submit: true });
            const resumed = await hre.run(EMERGENCY_ALIAS, { ...defaults, submit: true });
            assert.equal(resumed.submissions.length, 1);
            assert.equal(
                resumed.submissions[0].multisigTransactionId,
                state.submissions[0].multisigTransactionId
            );
            assert((await wallet.transactionCount()).eq(1));
            assert(fs.existsSync(path.join(directory, "babelfish-pause-redemptions.json")));
        } finally {
            process.chdir(original);
        }
    });
    it("previews exact zero-value stop without signer, writes or submissions", async function () {
        const { args, masset, wallet } = await fixture();
        const rt = runtime(ethers.provider);
        rt.ethers.getSigner = () => {
            throw new Error("preview loaded signer");
        };
        const { pauseRedemptions } = require("../../hardhat/tasks/babelfish-redemptions");
        assert.deepEqual(await pauseRedemptions(args, rt), [
            {
                to: masset.address,
                value: 0,
                data: masset.interface.encodeFunctionData("setTokenOwner", [wallet.address]),
            },
        ]);
        assert(!fs.existsSync(args.journal));
        assert((await wallet.transactionCount()).isZero());
    });
    it("stops after third confirmation and restores directly via token, preserving pauses and transfers", async function () {
        const { args, masset, token, wallet, signers } = await fixture();
        await masset.mint(100);
        await masset.setPaused(signers[7].address, true);
        const stopped = await hre.run(TASK, { ...args, submit: true });
        assert.equal(stopped.submissions.length, 1);
        const id = stopped.submissions[0].multisigTransactionId;
        assert.equal((await wallet.getConfirmationCount(id)).toNumber(), 1);
        assert.equal(await token.owner(), masset.address);
        await masset.redeem(1);
        await execute(stopped, wallet, signers);
        assert.equal(await token.owner(), wallet.address);
        const before = await token.totalSupply();
        await assert.rejects(masset.mint(1), /owner/);
        await assert.rejects(masset.redeem(1), /owner/);
        assert((await token.totalSupply()).eq(before));
        await token.transfer(signers[8].address, 2);
        await token.approve(signers[8].address, 5);
        assert((await token.allowance(signers[0].address, signers[8].address)).eq(5));
        await masset.setPaused(signers[9].address, true);
        assert.deepEqual(await hre.run(REVERSE, reverse(args)), [
            {
                to: token.address,
                value: 0,
                data: token.interface.encodeFunctionData("transferOwnership", [masset.address]),
            },
        ]);
        assert(!fs.existsSync(reverse(args).journal));
        const restored = await hre.run(REVERSE, { ...reverse(args), submit: true });
        assert.equal(await token.owner(), wallet.address);
        await execute(restored, wallet, signers);
        assert.equal(await token.owner(), masset.address);
        await masset.mint(3);
        await masset.redeem(3);
        assert.equal(await masset.isPaused(signers[7].address), true);
        assert.equal(await masset.isPaused(signers[9].address), true);
    });
    it("waits for receipt, prints resumed ID and never duplicates its own submission", async function () {
        const { args, wallet, signers } = await fixture();
        let waits = 0;
        const provider = new ethers.providers.Web3Provider(network.provider);
        const wait = provider.waitForTransaction.bind(provider);
        provider.waitForTransaction = async (...p) => {
            waits++;
            return wait(...p);
        };
        const { pauseRedemptions } = require("../../hardhat/tasks/babelfish-redemptions");
        const state = await pauseRedemptions({ ...args, submit: true }, runtime(provider));
        assert(waits > 0, "submission did not wait for receipt");
        const messages = [],
            log = console.log;
        console.log = (...p) => messages.push(p.join(" "));
        try {
            await pauseRedemptions({ ...args, submit: true }, runtime(provider));
        } finally {
            console.log = log;
        }
        assert(
            messages.some((s) =>
                s.includes(`MULTISIG TRANSACTION ${state.submissions[0].multisigTransactionId}`)
            )
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
        await execute(state, wallet, signers);
        await hre.run(TASK, { ...args, submit: true });
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
    });
    it("requires original stop executed before restoration preview or submission", async function () {
        const { args, wallet } = await fixture();
        await hre.run(TASK, { ...args, submit: true });
        for (const submit of [false, true])
            await assert.rejects(hre.run(REVERSE, { ...reverse(args), submit }), /not executed/i);
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
    });
    it("rejects wrong chain, token pointer, owner, quorum, owner count and signer", async function () {
        let f = await fixture();
        const { pauseRedemptions } = require("../../hardhat/tasks/babelfish-redemptions");
        const provider = new ethers.providers.Web3Provider(network.provider);
        provider.getNetwork = async () => ({ chainId: 31 });
        await assert.rejects(pauseRedemptions(f.args, runtime(provider)), /chain ID 30/);
        await f.masset.setToken(f.signers[8].address);
        await assert.rejects(hre.run(TASK, f.args), /token mismatch/i);
        await f.masset.setToken(f.token.address);
        await f.masset.setOwner(f.signers[8].address);
        await assert.rejects(hre.run(TASK, f.args), /owner mismatch/i);
        f = await fixture(2);
        await assert.rejects(hre.run(TASK, f.args), /quorum 3/);
        f = await fixture(3, 4);
        await assert.rejects(hre.run(TASK, f.args), /5 owners/);
        f = await fixture();
        await assert.rejects(
            hre.run(TASK, { ...f.args, signer: f.signers[9].address, submit: true }),
            /not a multisig owner/
        );
        await assert.rejects(
            hre.run(TASK, { ...f.args, xusd: f.signers[8].address }),
            /token mismatch|code/i
        );
    });
    it("refuses pending, failed and mismatched outer receipts, events or stored calls on resume", async function () {
        const { args } = await fixture();
        await hre.run(TASK, { ...args, submit: true });
        const { pauseRedemptions } = require("../../hardhat/tasks/babelfish-redemptions");
        for (const [kind, expected] of [
            ["pending", /failed\/pending/],
            ["failed", /failed\/pending/],
            ["outer", /transaction mismatch/],
            ["event", /Submission/],
            ["stored", /Stored multisig transaction mismatch/],
        ]) {
            const provider = new ethers.providers.Web3Provider(network.provider),
                wait = provider.waitForTransaction.bind(provider);
            provider.waitForTransaction = async (...p) => {
                const receipt = await wait(...p);
                if (kind === "pending") return null;
                if (kind === "failed") return { ...receipt, status: 0 };
                if (kind === "event") return { ...receipt, logs: [] };
                return receipt;
            };
            if (kind === "outer") {
                const get = provider.getTransaction.bind(provider);
                provider.getTransaction = async (...p) => ({
                    ...(await get(...p)),
                    value: ethers.BigNumber.from(1),
                });
            }
            if (kind === "stored") {
                const call = provider.call.bind(provider),
                    iface = new ethers.utils.Interface([
                        "function transactions(uint256) view returns(address,uint256,bytes,bool)",
                    ]);
                provider.call = async (tx, ...p) => {
                    const actual = await call(tx, ...p);
                    if ((await tx.data).startsWith(iface.getSighash("transactions")))
                        return iface.encodeFunctionResult("transactions", [
                            args.masset,
                            1,
                            "0x",
                            false,
                        ]);
                    return actual;
                };
            }
            await assert.rejects(
                pauseRedemptions({ ...args, submit: true }, runtime(provider)),
                expected
            );
        }
    });
    it("retains uncertain sends and refuses automatic retry without another broadcast", async function () {
        const { args, wallet } = await fixture();
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                if (method === "eth_sendTransaction")
                    throw new Error("uncertain transport failure");
                return network.provider.request({ method, params });
            },
        });
        const { pauseRedemptions } = require("../../hardhat/tasks/babelfish-redemptions");
        await assert.rejects(
            pauseRedemptions({ ...args, submit: true }, runtime(provider)),
            /uncertain transport/
        );
        assert(JSON.parse(fs.readFileSync(args.journal)).inFlight);
        await assert.rejects(hre.run(TASK, { ...args, submit: true }), /Uncertain/);
        assert((await wallet.transactionCount()).isZero());
    });
    it("rejects changed context, operation, identity and duplicate own submissions", async function () {
        const { args, wallet } = await fixture(),
            state = await hre.run(TASK, { ...args, submit: true }),
            original = JSON.stringify(state);
        for (const mutate of [
            (s) => {
                s.operation.to = s.xusd;
            },
            (s) => {
                s.sender = s.wallet;
            },
            (s) => {
                s.identities = {};
            },
            (s) => {
                s.submissions.push(s.submissions[0]);
            },
            (s) => {
                s.submissions[0].data = "0x";
            },
        ]) {
            const changed = JSON.parse(original);
            mutate(changed);
            fs.writeFileSync(args.journal, JSON.stringify(changed));
            await assert.rejects(
                hre.run(TASK, { ...args, submit: true }),
                /mismatch|one submission/i
            );
        }
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
    });
    it("locks source during restore, binds exact content, and rejects uncertain source", async function () {
        const { args, wallet, signers } = await fixture(),
            state = await hre.run(TASK, { ...args, submit: true });
        await execute(state, wallet, signers);
        const saved = fs.readFileSync(args.journal, "utf8");
        fs.writeFileSync(args.journal + ".lock", "");
        await assert.rejects(hre.run(REVERSE, reverse(args)), /lock/);
        fs.unlinkSync(args.journal + ".lock");
        fs.writeFileSync(args.journal, JSON.stringify({ ...state, inFlight: {} }));
        await assert.rejects(hre.run(REVERSE, reverse(args)), /Uncertain/);
        fs.writeFileSync(args.journal, saved);
        await assert.rejects(
            hre.run(REVERSE, { ...reverse(args), journal: args.journal }),
            /different/
        );
        let checked = false;
        const provider = new ethers.providers.Web3Provider({
            request: async ({ method, params }) => {
                if (method === "eth_sendTransaction") {
                    checked = true;
                    assert(fs.existsSync(args.journal + ".lock"));
                    await assert.rejects(hre.run(TASK, { ...args, submit: true }), /EEXIST|lock/);
                }
                return network.provider.request({ method, params });
            },
        });
        const { unpauseRedemptions } = require("../../hardhat/tasks/babelfish-redemptions");
        await unpauseRedemptions({ ...reverse(args), submit: true }, runtime(provider));
        assert(checked);
        assert.equal(fs.readFileSync(args.journal, "utf8"), saved);
        fs.writeFileSync(args.journal, saved + "\n");
        await assert.rejects(hre.run(REVERSE, { ...reverse(args), submit: true }), /changed/);
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });
    it("refuses completed stop journal after restoration and resumes restored ID", async function () {
        const { args, wallet, signers } = await fixture(),
            stopped = await hre.run(TASK, { ...args, submit: true });
        await execute(stopped, wallet, signers);
        const restored = await hre.run(REVERSE, { ...reverse(args), submit: true });
        await execute(restored, wallet, signers);
        await hre.run(REVERSE, { ...reverse(args), submit: true });
        await assert.rejects(hre.run(TASK, { ...args, submit: true }), /fresh journal/i);
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });
    it("rejects live runtime and implementation drift before resuming a recorded operation", async function () {
        const { args, masset, token } = await fixture();
        await hre.run(TASK, { ...args, submit: true });
        const { pauseRedemptions } = require("../../hardhat/tasks/babelfish-redemptions");
        for (const kind of ["runtime", "implementation"]) {
            const provider = new ethers.providers.Web3Provider(network.provider);
            if (kind === "runtime") {
                const get = provider.getCode.bind(provider);
                provider.getCode = async (a, ...p) =>
                    a.toLowerCase() === token.address.toLowerCase() ? "0x6000" : get(a, ...p);
            } else {
                const get = provider.getStorageAt.bind(provider);
                provider.getStorageAt = async (a, ...p) =>
                    a.toLowerCase() === masset.address.toLowerCase()
                        ? ethers.utils.hexZeroPad(token.address, 32)
                        : get(a, ...p);
            }
            await assert.rejects(
                pauseRedemptions({ ...args, submit: true }, runtime(provider)),
                /identity mismatch/
            );
        }
    });
    it("rejects a forged source receipt, operation, sender, identity or unmined record", async function () {
        const { args, wallet, signers } = await fixture(),
            state = await hre.run(TASK, { ...args, submit: true });
        await execute(state, wallet, signers);
        const saved = JSON.stringify(state);
        for (const mutate of [
            (s) => {
                s.action = "unpause";
            },
            (s) => {
                s.operation.to = s.xusd;
            },
            (s) => {
                s.identities = {};
            },
            (s) => {
                s.sender = s.wallet;
            },
            (s) => {
                s.submissions[0].hash = ethers.constants.HashZero;
            },
            (s) => {
                s.submissions[0].multisigTransactionId = "99";
            },
        ]) {
            const changed = JSON.parse(saved);
            mutate(changed);
            fs.writeFileSync(args.journal, JSON.stringify(changed));
            await assert.rejects(
                hre.run(REVERSE, { ...reverse(args), submit: true }),
                /mismatch|failed\/pending/
            );
        }
        assert.equal((await wallet.transactionCount()).toNumber(), 1);
    });
    it("does not overwrite a symlinked journal and refuses an uncontrolled token owner", async function () {
        const { args, token, masset, wallet, signers } = await fixture();
        const target = path.join(directory, "protected.json");
        fs.writeFileSync(target, "protected");
        fs.symlinkSync(target, args.journal);
        await assert.rejects(hre.run(TASK, { ...args, submit: true }), /Symlinked/);
        assert.equal(fs.readFileSync(target, "utf8"), "protected");
        fs.unlinkSync(args.journal);
        const stop = await hre.run(TASK, { ...args, submit: true });
        await execute(stop, wallet, signers);
        const data = token.interface.encodeFunctionData("transferOwnership", [signers[9].address]);
        await wallet.submitTransaction(token.address, 0, data);
        await wallet.connect(signers[1]).confirmTransaction(1);
        await wallet.connect(signers[2]).confirmTransaction(1);
        await assert.rejects(hre.run(REVERSE, reverse(args)), /Unexpected XUSD owner/);
        assert.equal(await masset.owner(), wallet.address);
    });
    it("previews already-stopped and already-restored states without new submissions", async function () {
        const { args, wallet, signers } = await fixture(),
            stopped = await hre.run(TASK, { ...args, submit: true });
        await execute(stopped, wallet, signers);
        assert.deepEqual(
            await hre.run(TASK, { ...args, journal: path.join(directory, "fresh.json") }),
            []
        );
        const restored = await hre.run(REVERSE, { ...reverse(args), submit: true });
        await execute(restored, wallet, signers);
        assert.deepEqual(
            await hre.run(REVERSE, {
                ...reverse(args),
                journal: path.join(directory, "fresh-restore.json"),
            }),
            []
        );
        assert.equal((await wallet.transactionCount()).toNumber(), 2);
    });

    it("refuses an ownership operation that cannot simulate even in read-only preview", async function () {
        const { args, masset } = await fixture();
        const provider = new ethers.providers.Web3Provider(network.provider),
            call = provider.call.bind(provider);
        provider.call = async (tx, ...p) => {
            if ((await tx.data).startsWith(masset.interface.getSighash("setTokenOwner")))
                throw new Error("ownership simulation reverted");
            return call(tx, ...p);
        };
        const { pauseRedemptions } = require("../../hardhat/tasks/babelfish-redemptions");
        await assert.rejects(
            pauseRedemptions(args, runtime(provider)),
            /ownership simulation reverted/
        );
        assert(!fs.existsSync(args.journal));
    });
});
