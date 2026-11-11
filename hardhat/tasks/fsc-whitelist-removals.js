const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");

const COLLECTOR = "0x115caf168c51ed15ec535727f64684d33b7b08d1";
const MULTISIG = "0x924f5ad34698fd20c90fe5d5a8a0abd3b42dc711";
const IMPLEMENTATION = "0xccb75e444f4808012a57eb2db06648249f370d2f";
const FSC_ABI = [
    "function owner() view returns(address)",
    "function getProxyOwner() view returns(address)",
    "function getImplementation() view returns(address)",
    "function getWhitelistedConverterList() view returns(address[])",
    "function removeWhitelistedConverterAddress(address)",
];
const MS_ABI = [
    "function required() view returns(uint256)",
    "function isOwner(address) view returns(bool)",
    "function transactions(uint256) view returns(address destination,uint256 value,bytes data,bool executed)",
    "function submitTransaction(address,uint256,bytes) returns(uint256)",
    "event Submission(uint256 indexed transactionId)",
];
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const check = (ok, message) => {
    if (!ok) throw new Error(message);
};

function operations(ethers, collector, converters, first) {
    const list = converters.map(ethers.utils.getAddress);
    check(
        list.length <= 100 && new Set(list).size === list.length,
        "Invalid whitelist size/duplicates"
    );
    check(!list.some((a) => same(a, ethers.constants.AddressZero)), "Zero converter");
    if (first) list.sort((a, b) => Number(same(b, first)) - Number(same(a, first)));
    const iface = new ethers.utils.Interface(FSC_ABI);
    return list.map((converter) => ({
        to: collector,
        value: 0,
        converter,
        data: iface.encodeFunctionData("removeWhitelistedConverterAddress", [converter]),
    }));
}

function checkAuthority(chain, owner, proxyOwner, wallet, impl, expectedImpl, required) {
    check(chain === 30, "Rootstock mainnet chain ID 30 required");
    check(same(owner, wallet) && same(proxyOwner, wallet), "Collector owner/proxy owner mismatch");
    check(same(impl, expectedImpl), "Collector implementation changed: stop and review");
    check(Number(required) === 3, "Expected quorum 3; refusing unexpected execution conditions");
}

function save(file, value) {
    const target = path.resolve(file);
    check(
        !fs.existsSync(target) || !fs.lstatSync(target).isSymbolicLink(),
        "Symlinked output refused"
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
        fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n");
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.renameSync(temporary, target);
}

async function run(args, hre) {
    const { ethers } = hre;
    const provider = ethers.provider;
    const collector = args.collector || COLLECTOR;
    const wallet = args.multisig || MULTISIG;
    const expectedImpl = args.implementation || IMPLEMENTATION;
    const readOnly = new ethers.VoidSigner(wallet, provider);
    const fsc = new ethers.Contract(collector, FSC_ABI, readOnly);
    const ms = new ethers.Contract(wallet, MS_ABI, readOnly);
    async function authority() {
        const [network, owner, proxyOwner, impl, required] = await Promise.all([
            provider.getNetwork(),
            fsc.owner(),
            fsc.getProxyOwner(),
            fsc.getImplementation(),
            ms.required(),
        ]);
        checkAuthority(network.chainId, owner, proxyOwner, wallet, impl, expectedImpl, required);
    }
    await authority();
    const list = await fsc.getWhitelistedConverterList();
    const ops = operations(ethers, collector, list, args.first);
    for (const op of ops) {
        check(
            (await provider.call({ from: wallet, to: collector, data: op.data })) === "0x",
            "Removal simulation failed"
        );
    }
    console.log(`${ops.length} current converters. Removal calls simulated as the multisig.`);
    if (!args.submit) {
        console.log(JSON.stringify(ops, null, 2));
        console.log(
            "DRY RUN. Add --submit to create proposals using your configured Hardhat signer."
        );
        return ops;
    }
    let signer;
    if (/^\d+$/.test(args.signer || "")) {
        signer = (await ethers.getSigners())[Number(args.signer)];
    } else {
        const selected = ethers.utils.isAddress(args.signer || "")
            ? args.signer
            : (await hre.getNamedAccounts())[args.signer || "deployer"];
        check(Boolean(selected), "Configured signer not found");
        signer = await ethers.getSigner(selected);
    }
    check(Boolean(signer), "Configured signer index not found");
    const sender = await signer.getAddress();
    check(await ms.isOwner(sender), `Configured signer ${sender} is not a multisig owner`);
    const stateFile = args.journal || "fsc-hardhat-removals.json";
    const lockFile = `${stateFile}.lock`;
    fs.mkdirSync(path.dirname(path.resolve(lockFile)), { recursive: true });
    const lock = fs.openSync(lockFile, "wx", 0o600);
    try {
        const state = fs.existsSync(stateFile)
            ? JSON.parse(fs.readFileSync(stateFile, "utf8"))
            : {
                  collector,
                  wallet,
                  sender,
                  submissions: [],
                  inFlight: null,
              };
        check(
            same(state.collector, collector) &&
                same(state.wallet, wallet) &&
                same(state.sender, sender),
            "Journal context mismatch"
        );
        check(!state.inFlight, "Uncertain prior send: inspect wallet/journal before retrying");
        async function confirmSubmission(record) {
            if (record.proposalId !== undefined) return;
            const receipt = await provider.waitForTransaction(record.hash, 1, 180000);
            check(
                receipt && receipt.status === 1,
                "Submission failed/pending; keep same journal and inspect"
            );
            const transaction = await provider.getTransaction(record.hash);
            const expectedData = ms.interface.encodeFunctionData("submitTransaction", [
                collector,
                0,
                record.data,
            ]);
            check(
                same(transaction.from, sender) &&
                    same(transaction.to, wallet) &&
                    transaction.value.isZero() &&
                    transaction.data.toLowerCase() === expectedData.toLowerCase(),
                "Submitted transaction mismatch"
            );
            const logs = receipt.logs
                .filter((log) => same(log.address, wallet))
                .map((log) => {
                    try {
                        return ms.interface.parseLog(log);
                    } catch (_) {
                        return null;
                    }
                })
                .filter((log) => log && log.name === "Submission");
            check(logs.length === 1, "Expected one wallet Submission event");
            const id = logs[0].args.transactionId;
            const stored = await ms.transactions(id);
            check(
                same(stored.destination, collector) &&
                    stored.value.isZero() &&
                    stored.data.toLowerCase() === record.data.toLowerCase(),
                "Stored proposal mismatch"
            );
            record.proposalId = id.toString();
            record.executedAtCheck = stored.executed;
            save(stateFile, state);
            console.log(`PROPOSAL ${record.proposalId}: ${record.converter}`);
        }
        // Finish any recorded broadcasts before allowing another submission.
        for (const record of state.submissions) await confirmSubmission(record);
        const recorded = new Set(state.submissions.map((r) => r.data.toLowerCase()));
        const signingWallet = ms.connect(signer);
        for (const op of ops) {
            if (recorded.has(op.data.toLowerCase())) continue;
            await authority();
            const current = await fsc.getWhitelistedConverterList();
            if (!current.some((a) => same(a, op.converter))) continue;
            check(await ms.isOwner(sender), "Signer no longer an owner");
            const estimate = await signingWallet.estimateGas.submitTransaction(
                collector,
                0,
                op.data
            );
            const nonce = await provider.getTransactionCount(sender, "pending");
            const gasPrice = await provider.getGasPrice();
            state.inFlight = { converter: op.converter, nonce, data: op.data };
            save(stateFile, state);
            let tx;
            try {
                tx = await signingWallet.submitTransaction(collector, 0, op.data, {
                    nonce,
                    type: 0,
                    gasPrice,
                    gasLimit: estimate.mul(130).div(100),
                });
            } catch (error) {
                // This RPC rejection did not accept a transaction. Transport failures
                // remain uncertain and retain the marker for operator inspection.
                if (/transaction nonce too high/i.test(error.message)) {
                    state.inFlight = null;
                    save(stateFile, state);
                }
                throw error;
            }
            const record = { converter: op.converter, data: op.data, hash: tx.hash, nonce };
            state.submissions.push(record);
            state.inFlight = null;
            save(stateFile, state);
            console.log(`Submitted ${op.converter}: ${tx.hash}. Waiting for receipt...`);
            await confirmSubmission(record);
            recorded.add(op.data.toLowerCase());
        }
        console.log(
            "Proposal creation complete. Submission adds its first confirmation; total quorum is 3."
        );
        console.log(
            "No separate confirmation/execution calls sent. Verify execution and empty whitelist after quorum."
        );
        return state;
    } finally {
        fs.closeSync(lock);
        fs.unlinkSync(lockFile);
    }
}

task("amm:remove-all-fee-converters", "Create multisig proposals to stop AMM fee collection")
    .addOptionalParam("signer", "Existing configured signer name, address or index", "deployer")
    .addOptionalParam("collector", "FeeSharingCollector proxy", COLLECTOR)
    .addOptionalParam("multisig", "Owner multisig", MULTISIG)
    .addOptionalParam("implementation", "Expected collector implementation", IMPLEMENTATION)
    .addOptionalParam(
        "first",
        "Prioritize converter if still listed",
        "0xa9c3d9681215ef7623dc28ea6b75bf87fdf285d9"
    )
    .addOptionalParam("journal", "Use SAME journal on retry", "fsc-hardhat-removals.json")
    .addFlag("submit", "Broadcast proposal submissions using configured signer")
    .setAction(run);

module.exports = { run, operations, checkAuthority, FSC_ABI, MS_ABI };
