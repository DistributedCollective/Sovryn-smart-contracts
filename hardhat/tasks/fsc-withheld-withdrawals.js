const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");
const { configuredSigner } = require("./fsc-full-rescue");
const { MS_ABI } = require("./fsc-whitelist-removals");

const COLLECTOR = "0x115caf168c51ed15ec535727f64684d33b7b08d1";
const EXCHEQUER = "0x924f5ad34698fd20c90fe5d5a8a0abd3b42dc711";
const IMPLEMENTATION = "0xccb75e444f4808012a57eb2db06648249f370d2f";
const ABI = [
    "function owner() view returns(address)",
    "function getProxyOwner() view returns(address)",
    "function getImplementation() view returns(address)",
    "function RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT() view returns(address)",
    "function getProtocolWithholdTokensList() view returns(address[])",
    "function getProtocolWithheldFees(address) view returns(uint256)",
    "function withdrawProtocolWithheldFees(address,address)",
];
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const check = (ok, message) => {
    if (!ok) throw new Error(message);
};

function save(file, state) {
    check(
        !fs.existsSync(file) || !fs.lstatSync(file).isSymbolicLink(),
        "Symlinked journal refused"
    );
    const temporary = `${file}.${process.pid}.tmp`;
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
        fs.writeFileSync(fd, JSON.stringify(state, null, 2) + "\n");
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.renameSync(temporary, file);
}

async function withdrawWithheld(args, hre) {
    const { ethers } = hre;
    const requestedToken = args.token === undefined ? undefined : args.token.trim();
    check(requestedToken !== "", "Explicit --token must not be empty");
    const provider = ethers.provider;
    const collector = ethers.utils.getAddress(args.collector || COLLECTOR);
    const wallet = ethers.utils.getAddress(args.multisig || EXCHEQUER);
    const implementation = ethers.utils.getAddress(args.implementation || IMPLEMENTATION);
    check((await provider.getNetwork()).chainId === 30, "Rootstock mainnet chain ID 30 required");
    const reader = new ethers.VoidSigner(wallet, provider);
    const fsc = new ethers.Contract(collector, ABI, reader);
    const ms = new ethers.Contract(wallet, MS_ABI, reader);
    async function authority() {
        const [owner, proxyOwner, current, quorum] = await Promise.all([
            fsc.owner(),
            fsc.getProxyOwner(),
            fsc.getImplementation(),
            ms.required(),
        ]);
        check(
            same(owner, wallet) && same(proxyOwner, wallet),
            "Collector owner/proxy owner mismatch"
        );
        check(same(current, implementation), "Collector implementation changed: stop and review");
        check(quorum.eq(3), "Expected multisig quorum 3");
    }
    await authority();
    const native = await fsc.RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT();
    const tokens =
        requestedToken !== undefined
            ? [/^(native|rbtc)$/i.test(requestedToken) ? native : requestedToken]
            : await fsc.getProtocolWithholdTokensList();
    check(tokens.length <= 100, "Unexpected withhold list size");
    const ops = [];
    for (const address of tokens) {
        const token = ethers.utils.getAddress(address);
        check(token !== ethers.constants.AddressZero, "Zero token refused");
        const amount = await fsc.getProtocolWithheldFees(token);
        if (amount.isZero()) continue;
        const data = fsc.interface.encodeFunctionData("withdrawProtocolWithheldFees", [
            token,
            wallet,
        ]);
        check(
            (await provider.call({ from: wallet, to: collector, data })) === "0x",
            "Withheld withdrawal simulation failed"
        );
        ops.push({ to: collector, value: 0, token, amount: amount.toString(), data });
    }
    console.log(`${ops.length} nonzero withheld assets. Recipient: Exchequer ${wallet}.`);
    if (!args.submit || !ops.length) {
        console.log(JSON.stringify(ops, null, 2));
        console.log(
            "DRY RUN / no submissions. Amounts are base units; add --submit to create multisig transactions."
        );
        return ops;
    }
    const signer = await configuredSigner(hre, args.signer || "deployer");
    const sender = await signer.getAddress();
    check(
        await ms.isOwner(sender),
        `Configured signer ${sender} is not a multisig owner; unlock your existing CryptoEnv signer`
    );
    const file = path.resolve(args.journal || "fsc-withheld-withdrawals.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const lockFile = `${file}.lock`;
    const lock = fs.openSync(lockFile, "wx", 0o600);
    try {
        check(
            !fs.existsSync(file) || !fs.lstatSync(file).isSymbolicLink(),
            "Symlinked journal refused"
        );
        const state = fs.existsSync(file)
            ? JSON.parse(fs.readFileSync(file, "utf8"))
            : { collector, wallet, implementation, sender, submissions: [], inFlight: null };
        check(
            same(state.collector, collector) &&
                same(state.wallet, wallet) &&
                same(state.implementation, implementation) &&
                same(state.sender, sender),
            "Journal context mismatch"
        );
        check(!state.inFlight, "Uncertain prior send: inspect wallet/journal before retrying");
        async function confirm(record) {
            const receipt = await provider.waitForTransaction(record.hash, 1, 180000);
            check(
                receipt && receipt.status === 1,
                "Submission failed/pending; keep same journal and inspect"
            );
            const tx = await provider.getTransaction(record.hash);
            const expected = ms.interface.encodeFunctionData("submitTransaction", [
                collector,
                0,
                record.data,
            ]);
            check(
                tx &&
                    same(tx.from, sender) &&
                    same(tx.to, wallet) &&
                    tx.value.isZero() &&
                    tx.nonce === record.nonce &&
                    same(tx.data, expected),
                "Submitted transaction mismatch"
            );
            const events = receipt.logs
                .filter((l) => same(l.address, wallet))
                .map((l) => {
                    try {
                        return ms.interface.parseLog(l);
                    } catch (_) {
                        return null;
                    }
                })
                .filter((l) => l && l.name === "Submission");
            check(events.length === 1, "Expected one wallet Submission event");
            const id = events[0].args.transactionId;
            check(
                record.proposalId === undefined || record.proposalId === id.toString(),
                "Recorded multisig transaction ID changed"
            );
            const stored = await ms.transactions(id);
            check(
                same(stored.destination, collector) &&
                    stored.value.isZero() &&
                    same(stored.data, record.data),
                "Stored multisig transaction mismatch"
            );
            record.proposalId = id.toString();
            save(file, state);
            console.log(`MULTISIG TRANSACTION ${record.proposalId}: ${record.token}`);
        }
        for (const record of state.submissions) await confirm(record);
        const recorded = new Set(state.submissions.map((r) => r.data.toLowerCase()));
        const signingWallet = ms.connect(signer);
        for (const op of ops) {
            if (recorded.has(op.data.toLowerCase())) continue;
            await authority();
            check(await ms.isOwner(sender), "Signer no longer a multisig owner");
            if ((await fsc.getProtocolWithheldFees(op.token)).isZero()) continue;
            check(
                (await provider.call({ from: wallet, to: collector, data: op.data })) === "0x",
                "Withheld withdrawal simulation failed"
            );
            const estimate = await signingWallet.estimateGas.submitTransaction(
                collector,
                0,
                op.data
            );
            const nonce = await provider.getTransactionCount(sender, "pending");
            const gasPrice = await provider.getGasPrice();
            state.inFlight = { token: op.token, nonce, data: op.data };
            save(file, state);
            let tx;
            try {
                tx = await signingWallet.submitTransaction(collector, 0, op.data, {
                    nonce,
                    type: 0,
                    gasPrice,
                    gasLimit: estimate.mul(130).div(100),
                });
            } catch (error) {
                if (/transaction nonce too high/i.test(error.message)) {
                    state.inFlight = null;
                    save(file, state);
                }
                throw error;
            }
            const record = { ...op, hash: tx.hash, nonce };
            state.submissions.push(record);
            state.inFlight = null;
            save(file, state);
            console.log(`Submitted ${op.token}: ${tx.hash}. Waiting for receipt...`);
            await confirm(record);
            recorded.add(op.data.toLowerCase());
        }
        console.log(
            "Submission complete; each transaction includes its first confirmation. Reach quorum 3 and verify Execution, stored executed flag and withheld balances."
        );
        return state;
    } finally {
        fs.closeSync(lock);
        fs.unlinkSync(lockFile);
    }
}

task(
    "feeSharingCollector:withdrawProtocolWithheldFees",
    "Propose withdrawal of protocol-withheld fees to Exchequer"
)
    .addOptionalParam("token", "Token address or RBTC/native; omitted means current withhold list")
    .addOptionalParam("signer", "Existing configured signer name/address/index", "deployer")
    .addOptionalParam("collector", "FeeSharingCollector proxy", COLLECTOR)
    .addOptionalParam("multisig", "Exchequer owner and withdrawal recipient", EXCHEQUER)
    .addOptionalParam("implementation", "Expected collector implementation", IMPLEMENTATION)
    .addOptionalParam(
        "journal",
        "Keep SAME journal on retry; new file for a future withdrawal run",
        "fsc-withheld-withdrawals.json"
    )
    .addFlag("submit", "Create multisig transactions using the configured signer")
    .setAction(withdrawWithheld);

module.exports = { withdrawWithheld };
