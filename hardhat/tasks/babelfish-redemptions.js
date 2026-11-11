const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { configuredSigner } = require("./fsc-full-rescue");
const { MS_ABI } = require("./fsc-whitelist-removals");

const MASSET = "0x1440d19436bEeaF8517896bffB957a88EC95a00F";
const XUSD = "0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F";
const MULTISIG = "0xbD687d470A7E8B36C666968bb79376904725E4DD";
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const MASSET_ABI = [
    "function owner() view returns(address)",
    "function getToken() view returns(address)",
    "function setTokenOwner(address)",
];
const TOKEN_ABI = [
    "function owner() view returns(address)",
    "function transferOwnership(address)",
];
const same = (a, b) =>
    typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
const check = (ok, message) => {
    if (!ok) throw new Error(message);
};
const digest = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function read(file) {
    check(!fs.lstatSync(file).isSymbolicLink(), "Symlinked journal refused");
    const raw = fs.readFileSync(file, "utf8");
    return { raw, state: JSON.parse(raw) };
}
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

async function changeRedemptions(args, hre, action) {
    const reversing = action === "unpause";
    const { ethers } = hre,
        provider = ethers.provider;
    const massetAddress = ethers.utils.getAddress(args.masset || MASSET);
    const tokenAddress = ethers.utils.getAddress(args.xusd || XUSD);
    const wallet = ethers.utils.getAddress(args.multisig || MULTISIG);
    check(
        new Set([massetAddress, tokenAddress, wallet]).size === 3,
        "Distinct contracts required"
    );
    const file = path.resolve(args.journal || `babelfish-${action}-redemptions.json`);
    const sourceFile = reversing
        ? path.resolve(args.pausejournal || "babelfish-pause-redemptions.json")
        : null;
    check(sourceFile !== file, "Use different pause and unpause journal files");
    const reader = new ethers.VoidSigner(wallet, provider);
    const masset = new ethers.Contract(massetAddress, MASSET_ABI, reader);
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, reader);
    const ms = new ethers.Contract(
        wallet,
        [...MS_ABI, "function getOwners() view returns(address[])"],
        reader
    );
    const stop = {
        to: massetAddress,
        value: 0,
        data: masset.interface.encodeFunctionData("setTokenOwner", [wallet]),
    };
    // XUSD's owner is the wallet after the stop; Masset cannot restore it.
    const restore = {
        to: tokenAddress,
        value: 0,
        data: token.interface.encodeFunctionData("transferOwnership", [massetAddress]),
    };
    const operation = reversing ? restore : stop;

    async function authority() {
        check(
            (await provider.getNetwork()).chainId === 30,
            "Rootstock mainnet chain ID 30 required"
        );
        check(same(await masset.getToken(), tokenAddress), "Masset token mismatch");
        check(same(await masset.owner(), wallet), "Masset owner mismatch");
        check((await ms.required()).eq(3), "Expected multisig quorum 3");
        const owners = (await ms.getOwners()).map(ethers.utils.getAddress).sort();
        check(
            owners.length === 5 &&
                new Set(owners).size === 5 &&
                !owners.includes(ethers.constants.AddressZero),
            "Expected 5 owners"
        );
        for (const owner of owners) check(await ms.isOwner(owner), "Multisig owner list mismatch");
        const identities = { owners };
        for (const [name, address] of [
            ["masset", massetAddress],
            ["xusd", tokenAddress],
            ["wallet", wallet],
        ]) {
            const code = await provider.getCode(address);
            check(code !== "0x", `${name} has no contract code`);
            const slot = await provider.getStorageAt(address, IMPLEMENTATION_SLOT);
            const implementation = ethers.utils.getAddress(`0x${slot.slice(-40)}`);
            let implementationCodeHash = null;
            if (implementation !== ethers.constants.AddressZero) {
                const implementationCode = await provider.getCode(implementation);
                check(implementationCode !== "0x", `${name} implementation has no contract code`);
                implementationCodeHash = ethers.utils.keccak256(implementationCode);
            }
            identities[name] = {
                codeHash: ethers.utils.keccak256(code),
                implementation,
                implementationCodeHash,
            };
        }
        const owner = await token.owner();
        check(
            same(owner, massetAddress) || same(owner, wallet),
            "Unexpected XUSD owner: stop and review"
        );
        return { identities, owner };
    }
    const initial = await authority();
    function validate(state, expectedAction, expectedOperation, sender) {
        check(
            state.version === 1 &&
                state.chainId === 30 &&
                state.action === expectedAction &&
                same(state.masset, massetAddress) &&
                same(state.xusd, tokenAddress) &&
                same(state.wallet, wallet),
            "Journal context mismatch"
        );
        check(
            equal(state.identities, initial.identities),
            "Journal runtime/implementation/owners identity mismatch"
        );
        check(equal(state.operation, expectedOperation), "Journal operation mismatch");
        check(
            ethers.utils.isAddress(state.sender) && (!sender || same(state.sender, sender)),
            "Journal sender mismatch"
        );
        check(!state.inFlight, "Uncertain prior send: inspect chain and journal before retrying");
        check(
            Array.isArray(state.submissions) && state.submissions.length <= 1,
            "Journal must have at most one submission"
        );
        for (const record of state.submissions)
            check(
                same(record.to, expectedOperation.to) &&
                    record.value === 0 &&
                    same(record.data, expectedOperation.data),
                "Recorded operation mismatch"
            );
    }
    async function verify(record, state, expectedOperation, wait) {
        check(
            /^0x[0-9a-fA-F]{64}$/.test(record.hash) &&
                Number.isSafeInteger(record.nonce) &&
                record.nonce >= 0,
            "Recorded transaction mismatch"
        );
        const receipt = wait
            ? await provider.waitForTransaction(record.hash, 1, 180000)
            : await provider.getTransactionReceipt(record.hash);
        check(
            receipt && receipt.status === 1,
            "Submission failed/pending; keep same journal and inspect"
        );
        check(
            same(receipt.transactionHash, record.hash) &&
                same(receipt.to, wallet) &&
                same(receipt.from, state.sender),
            "Submission receipt mismatch"
        );
        const tx = await provider.getTransaction(record.hash);
        const expected = ms.interface.encodeFunctionData("submitTransaction", [
            expectedOperation.to,
            0,
            expectedOperation.data,
        ]);
        check(
            tx &&
                same(tx.hash, record.hash) &&
                same(tx.from, state.sender) &&
                same(tx.to, wallet) &&
                tx.nonce === record.nonce &&
                tx.value.isZero() &&
                same(tx.data, expected) &&
                same(tx.blockHash, receipt.blockHash),
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
        const id = events[0].args.transactionId.toString();
        check(
            record.multisigTransactionId === undefined || record.multisigTransactionId === id,
            "Recorded multisig transaction ID mismatch"
        );
        const stored = await ms.transactions(id);
        check(
            same(stored.destination, expectedOperation.to) &&
                stored.value.isZero() &&
                same(stored.data, expectedOperation.data),
            "Stored multisig transaction mismatch"
        );
        return { id, executed: stored.executed };
    }
    let lock, sourceLock;
    try {
        if (args.submit) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            lock = fs.openSync(`${file}.lock`, "wx", 0o600);
        } else
            check(
                !fs.existsSync(`${file}.lock`),
                "Output journal lock exists: task may still be running"
            );
        let source;
        if (reversing) {
            check(fs.existsSync(sourceFile), "Original pause journal missing");
            if (args.submit) sourceLock = fs.openSync(`${sourceFile}.lock`, "wx", 0o600);
            else check(!fs.existsSync(`${sourceFile}.lock`), "Source pause journal lock exists");
            source = read(sourceFile);
            validate(source.state, "pause", stop);
            check(
                source.state.submissions.length === 1,
                "Original pause journal must have one submission"
            );
            const original = await verify(source.state.submissions[0], source.state, stop, false);
            check(
                original.executed,
                `Original pause multisig transaction ${original.id} is not executed; resolve it before restoration`
            );
        }
        const existing = fs.existsSync(file) ? read(file).state : null;
        let sender;
        let signer;
        if (args.submit) {
            signer = await configuredSigner(hre, args.signer || "deployer");
            sender = await signer.getAddress();
            check(await ms.isOwner(sender), "Configured signer is not a multisig owner");
        }
        const state = existing || {
            version: 1,
            chainId: 30,
            action,
            masset: massetAddress,
            xusd: tokenAddress,
            wallet,
            identities: initial.identities,
            sender,
            operation,
            ...(source ? { pauseJournal: sourceFile, pauseJournalHash: digest(source.raw) } : {}),
            submissions: [],
            inFlight: null,
        };
        if (existing) validate(state, action, operation, sender);
        if (source)
            check(
                state.pauseJournal === sourceFile && state.pauseJournalHash === digest(source.raw),
                "Original pause journal changed: stop and review"
            );
        if (state.submissions.length) {
            const record = state.submissions[0];
            const result = await verify(record, state, operation, Boolean(args.submit));
            console.log(
                `MULTISIG TRANSACTION ${result.id}: ${action} redemptions; executed=${result.executed}. Current XUSD owner: ${initial.owner}.`
            );
            check(
                reversing || !result.executed || same(initial.owner, wallet),
                "Stop already restored: use a fresh journal for a new stop run"
            );
            check(
                !reversing || !result.executed || same(initial.owner, massetAddress),
                "Restoration state changed: stop and review"
            );
            if (args.submit) {
                record.multisigTransactionId = result.id;
                save(file, state);
            }
            console.log(
                result.executed
                    ? "Verify current token owner and asset pauses before the next operator action."
                    : "Submission mined; collect confirmations until the 3-signature threshold is reached, then verify execution."
            );
            return args.submit ? state : [];
        }
        const expectedOwner = reversing ? wallet : massetAddress;
        if (!same(initial.owner, expectedOwner)) {
            console.log(
                `XUSD already owned by ${initial.owner}; no submission. Keep any original journals for audit.`
            );
            return [];
        }
        console.log(
            `This control stops both mint and redemption. Transfers/allowances and basset pauses remain. The multisig temporarily has direct XUSD supply authority. Current XUSD owner: ${initial.owner}.`
        );
        check(
            (await provider.call({
                from: wallet,
                to: operation.to,
                data: operation.data,
                value: 0,
            })) === "0x",
            "Ownership call simulation failed"
        );
        if (!args.submit) {
            console.log(JSON.stringify([operation], null, 2));
            console.log(
                "Read-only preview. Add --submit to create one multisig transaction with the first confirmation."
            );
            return [operation];
        }
        const latest = await authority();
        check(
            equal(latest.identities, initial.identities),
            "Runtime/implementation/owners changed: stop and review"
        );
        check(same(latest.owner, expectedOwner), "XUSD owner changed: stop and review");
        check(await ms.isOwner(sender), "Signer no longer a multisig owner");
        if (source) {
            check(
                digest(read(sourceFile).raw) === digest(source.raw),
                "Original pause journal changed"
            );
            const original = await verify(source.state.submissions[0], source.state, stop, false);
            check(original.executed, "Original pause multisig transaction is not executed");
        }
        check(
            (await provider.call({
                from: wallet,
                to: operation.to,
                data: operation.data,
                value: 0,
            })) === "0x",
            "Ownership call simulation failed"
        );
        const signingWallet = ms.connect(signer);
        const estimate = await signingWallet.estimateGas.submitTransaction(
            operation.to,
            0,
            operation.data
        );
        const nonce = await provider.getTransactionCount(sender, "pending");
        const gasPrice = await provider.getGasPrice();
        state.inFlight = { ...operation, nonce };
        save(file, state);
        // Every thrown send is uncertain, even when a transport error looks definitive.
        const tx = await signingWallet.submitTransaction(operation.to, 0, operation.data, {
            nonce,
            type: 0,
            gasPrice,
            gasLimit: estimate.mul(130).div(100),
        });
        const record = { ...operation, hash: tx.hash, nonce };
        state.submissions.push(record);
        state.inFlight = null;
        save(file, state);
        const result = await verify(record, state, operation, true);
        record.multisigTransactionId = result.id;
        save(file, state);
        console.log(
            `MULTISIG TRANSACTION ${result.id}: ${action} redemptions; executed=${result.executed}. Current XUSD owner: ${await token.owner()}.`
        );
        console.log(
            result.executed
                ? "Multisig transaction executed; verify current XUSD owner and asset pauses."
                : "Submission mined; collect confirmations until the 3-signature threshold is reached, then verify execution."
        );
        return state;
    } finally {
        if (sourceLock !== undefined) {
            fs.closeSync(sourceLock);
            fs.unlinkSync(`${sourceFile}.lock`);
        }
        if (lock !== undefined) {
            fs.closeSync(lock);
            fs.unlinkSync(`${file}.lock`);
        }
    }
}
async function pauseRedemptions(args, hre) {
    return changeRedemptions(args, hre, "pause");
}
async function unpauseRedemptions(args, hre) {
    return changeRedemptions(args, hre, "unpause");
}
function withOwnershipOptions(definition, journal) {
    return definition
        .addOptionalParam(
            "signer",
            "Existing configured multisig owner name/address/index",
            "deployer"
        )
        .addOptionalParam("masset", "Expected Babelfish Masset proxy", MASSET)
        .addOptionalParam("xusd", "Expected XUSD token", XUSD)
        .addOptionalParam("multisig", "Expected Masset owner multisig", MULTISIG)
        .addOptionalParam("journal", "Keep SAME journal on retry", journal)
        .addFlag("submit", "Submit one multisig transaction with its first confirmation");
}
withOwnershipOptions(
    task(
        "babelfish:emergency-pause",
        "Stop Babelfish mint and redemption through its owner multisig"
    ),
    "babelfish-pause-redemptions.json"
).setAction(pauseRedemptions);
withOwnershipOptions(
    task(
        "babelfish:emergency-pause-mint-redemptions",
        "Alias for babelfish:emergency-pause: stop both minting and redemption"
    ),
    "babelfish-pause-redemptions.json"
).setAction(pauseRedemptions);
withOwnershipOptions(
    task(
        "babelfish:unpause-redemptions",
        "Restore XUSD ownership directly after an executed journaled stop"
    ),
    "babelfish-unpause-redemptions.json"
)
    .addOptionalParam(
        "pausejournal",
        "Original executed stop journal",
        "babelfish-pause-redemptions.json"
    )
    .setAction(unpauseRedemptions);
module.exports = { pauseRedemptions, unpauseRedemptions };
