const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { configuredSigner } = require("./fsc-full-rescue");
const { MS_ABI } = require("./fsc-whitelist-removals");

const MASSET = "0x1440d19436bEeaF8517896bffB957a88EC95a00F";
const PAUSE_MANAGER = "0x3e96B99993B39a01e620Be71eFB5bF8AC6F7fb0E";
const MULTISIG = "0xbD687d470A7E8B36C666968bb79376904725E4DD";
const MASSET_ABI = [
    "function getPauseManager() view returns(address)",
    "function getBasketManager() view returns(address)",
];
const BASKET_ABI = ["function getBassets() view returns(address[])"];
const PAUSE_ABI = [
    "function owner() view returns(address)",
    "function isPaused(address) view returns(bool)",
    "function pause(address)",
    "function unpause(address)",
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

async function changeBassetPause(args, hre, action) {
    const reversing = action === "unpause";
    const { ethers } = hre;
    const provider = ethers.provider;
    const massetAddress = ethers.utils.getAddress(args.masset || MASSET);
    const pauseAddress = ethers.utils.getAddress(args.pausemanager || PAUSE_MANAGER);
    const wallet = ethers.utils.getAddress(args.multisig || MULTISIG);
    const file = path.resolve(args.journal || `babelfish-${action}-bassets.json`);
    const reader = new ethers.VoidSigner(wallet, provider);
    const masset = new ethers.Contract(massetAddress, MASSET_ABI, reader);
    const pm = new ethers.Contract(pauseAddress, PAUSE_ABI, reader);
    const ms = new ethers.Contract(wallet, MS_ABI, reader);
    check((await provider.getNetwork()).chainId === 30, "Rootstock mainnet chain ID 30 required");
    const basketAddress = await masset.getBasketManager();
    const basket = new ethers.Contract(basketAddress, BASKET_ABI, reader);
    async function authority() {
        const [network, manager, currentBasket] = await Promise.all([
            provider.getNetwork(),
            masset.getPauseManager(),
            masset.getBasketManager(),
        ]);
        check(network.chainId === 30, "Rootstock mainnet chain ID 30 required");
        check(same(manager, pauseAddress), "Unexpected Babelfish pause manager");
        check(same(currentBasket, basketAddress), "Basket manager changed: stop and review");
        const [owner, required] = await Promise.all([pm.owner(), ms.required()]);
        check(same(owner, wallet), "Pause manager owner mismatch");
        check(required.eq(3), "Expected multisig quorum 3");
    }
    await authority();
    const baselineBlock = await provider.getBlockNumber();
    const current = (await basket.getBassets({ blockTag: baselineBlock })).map(
        ethers.utils.getAddress
    );
    check(
        current.length <= 100 && new Set(current).size === current.length,
        "Invalid basket size/duplicates"
    );
    check(!current.includes(ethers.constants.AddressZero), "Zero basset refused");

    async function readPauseRun() {
        const sourceFile = path.resolve(args.pausejournal || "babelfish-pause-bassets.json");
        check(sourceFile !== file, "Use different pause and unpause journal files");
        check(
            !fs.existsSync(`${sourceFile}.lock`),
            "Pause run lock exists: pause task may still be running"
        );
        check(
            fs.existsSync(sourceFile) && !fs.lstatSync(sourceFile).isSymbolicLink(),
            "Original pause journal missing or symlinked"
        );
        const raw = fs.readFileSync(sourceFile, "utf8");
        const source = JSON.parse(raw);
        check(
            source.chainId === 30 &&
                same(source.masset, massetAddress) &&
                same(source.pauseManager, pauseAddress) &&
                same(source.basketManager, basketAddress) &&
                same(source.wallet, wallet) &&
                (!source.action || source.action === "pause"),
            "Source pause journal context mismatch"
        );
        check(!source.inFlight, "Uncertain original pause send: resolve it before reversing");
        check(
            Array.isArray(source.submissions) &&
                source.submissions.length > 0 &&
                source.submissions.length <= 100,
            "Source pause journal has no valid submissions"
        );
        const sourceTokens = [],
            blocks = [];
        for (const record of source.submissions) {
            const token = ethers.utils.getAddress(record.token);
            const data = pm.interface.encodeFunctionData("pause", [token]);
            check(same(data, record.data), "Source pause calldata mismatch");
            check(!sourceTokens.includes(token), "Duplicate source pause token");
            const receipt = await provider.getTransactionReceipt(record.hash);
            check(receipt && receipt.status === 1, "Original pause submission failed/pending");
            const tx = await provider.getTransaction(record.hash);
            const expected = ms.interface.encodeFunctionData("submitTransaction", [
                pauseAddress,
                0,
                data,
            ]);
            check(
                tx &&
                    same(tx.from, source.sender) &&
                    same(tx.to, wallet) &&
                    tx.nonce === record.nonce &&
                    tx.value.isZero() &&
                    same(tx.data, expected),
                "Source pause transaction mismatch"
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
            check(events.length === 1, "Source pause Submission event mismatch");
            const id = events[0].args.transactionId;
            check(
                record.multisigTransactionId === undefined ||
                    record.multisigTransactionId === id.toString(),
                "Source multisig transaction ID mismatch"
            );
            const stored = await ms.transactions(id);
            check(
                same(stored.destination, pauseAddress) &&
                    stored.value.isZero() &&
                    same(stored.data, data),
                "Source stored pause transaction mismatch"
            );
            check(
                stored.executed,
                `Original pause multisig transaction ${id} is not executed; resolve pending pause transactions before reversing`
            );
            sourceTokens.push(token);
            blocks.push(receipt.blockNumber);
        }
        // Older pause journals lack a baseline. Recover it from the block before
        // the first mined submission; never use the currently paused-token list.
        const firstSubmission = Math.min(...blocks);
        const blockNumber = source.baseline ? source.baseline.blockNumber : firstSubmission - 1;
        check(
            Number.isSafeInteger(blockNumber) && blockNumber >= 0 && blockNumber < firstSubmission,
            "Invalid pause baseline block"
        );
        const baselineBasket = await basket.getBassets({ blockTag: blockNumber });
        const pausedTokens = [];
        for (const token of baselineBasket) {
            if (await pm.isPaused(token, { blockTag: blockNumber }))
                pausedTokens.push(ethers.utils.getAddress(token));
        }
        const ordered = (list) => list.map((t) => ethers.utils.getAddress(t)).sort();
        if (source.baseline)
            check(
                JSON.stringify(ordered(source.baseline.pausedTokens)) ===
                    JSON.stringify(ordered(pausedTokens)),
                "Source pause baseline mismatch"
            );
        for (const token of sourceTokens) {
            check(
                baselineBasket.some((t) => same(t, token)) &&
                    !pausedTokens.some((t) => same(t, token)),
                "Source pause run includes a pre-existing paused or non-basket token"
            );
            check(
                current.some((t) => same(t, token)),
                "Pause-run basset removed from current basket"
            );
        }
        return {
            file: sourceFile,
            hash: crypto.createHash("sha256").update(raw).digest("hex"),
            tokens: sourceTokens,
            baseline: { blockNumber, pausedTokens },
        };
    }
    const source = reversing ? await readPauseRun() : null;
    const baseline = source ? source.baseline : { blockNumber: baselineBlock, pausedTokens: [] };
    if (!reversing) {
        for (const token of current) {
            if (await pm.isPaused(token, { blockTag: baselineBlock }))
                baseline.pausedTokens.push(token);
        }
    }
    let tokens = source ? source.tokens : current;
    if (args.token !== undefined) {
        check(args.token.trim() !== "", "Explicit --token must not be empty");
        const token = ethers.utils.getAddress(args.token.trim());
        check(
            tokens.some((t) => same(t, token)),
            reversing
                ? "Selected token is not part of this pause run"
                : "Selected token is not in the current basket"
        );
        tokens = [token];
    }
    const ops = [];
    for (const token of tokens) {
        if (!reversing && baseline.pausedTokens.some((t) => same(t, token))) continue;
        const paused = await pm.isPaused(token);
        if (reversing ? !paused : paused) continue;
        const data = pm.interface.encodeFunctionData(action, [token]);
        check(
            (await provider.call({ from: wallet, to: pauseAddress, data })) === "0x",
            "Pause simulation failed"
        );
        ops.push({ to: pauseAddress, value: 0, token, data });
    }
    console.log(
        `${ops.length} bassets to ${action}. Multisig: ${wallet}. Redemptions remain enabled.`
    );
    if (!args.submit || (!ops.length && !fs.existsSync(file))) {
        console.log(JSON.stringify(ops, null, 2));
        console.log("No submissions. Add --submit to create multisig transactions.");
        return ops;
    }
    const signer = await configuredSigner(hre, args.signer || "deployer");
    const sender = await signer.getAddress();
    check(await ms.isOwner(sender), `Configured signer ${sender} is not a multisig owner`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const lockFile = `${file}.lock`;
    const lock = fs.openSync(lockFile, "wx", 0o600);
    let sourceLock;
    try {
        if (source) {
            sourceLock = fs.openSync(`${source.file}.lock`, "wx", 0o600);
            check(
                crypto.createHash("sha256").update(fs.readFileSync(source.file)).digest("hex") ===
                    source.hash,
                "Original pause journal changed before locking"
            );
        }
        check(
            !fs.existsSync(file) || !fs.lstatSync(file).isSymbolicLink(),
            "Symlinked journal refused"
        );
        const state = fs.existsSync(file)
            ? JSON.parse(fs.readFileSync(file, "utf8"))
            : {
                  chainId: 30,
                  action,
                  baseline,
                  ...(source ? { pauseJournal: source.file, pauseJournalHash: source.hash } : {}),
                  masset: massetAddress,
                  pauseManager: pauseAddress,
                  basketManager: basketAddress,
                  wallet,
                  sender,
                  submissions: [],
                  inFlight: null,
              };
        check(
            state.chainId === 30 &&
                same(state.masset, massetAddress) &&
                same(state.pauseManager, pauseAddress) &&
                same(state.basketManager, basketAddress) &&
                same(state.wallet, wallet) &&
                same(state.sender, sender),
            "Journal context mismatch"
        );
        check(state.action === action || (!state.action && !reversing), "Journal action mismatch");
        if (source)
            check(
                state.pauseJournal === source.file && state.pauseJournalHash === source.hash,
                "Original pause journal changed: stop and review"
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
                pauseAddress,
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
                record.multisigTransactionId === undefined ||
                    record.multisigTransactionId === id.toString(),
                "Recorded multisig transaction ID changed"
            );
            const stored = await ms.transactions(id);
            check(
                same(stored.destination, pauseAddress) &&
                    stored.value.isZero() &&
                    same(stored.data, record.data),
                "Stored multisig transaction mismatch"
            );
            record.multisigTransactionId = id.toString();
            save(file, state);
            console.log(
                `MULTISIG TRANSACTION ${record.multisigTransactionId}: ${action} ${record.token}`
            );
        }
        // Recover every recorded broadcast before allowing any subsequent send.
        for (const record of state.submissions) await confirm(record);
        const recorded = new Set(state.submissions.map((r) => r.data.toLowerCase()));
        if (!reversing) {
            // Legacy journals recover the state before their first submission.
            if (!state.baseline) {
                const receipts = await Promise.all(
                    state.submissions.map((r) => provider.getTransactionReceipt(r.hash))
                );
                const blockNumber = receipts.length
                    ? Math.min(...receipts.map((r) => r.blockNumber)) - 1
                    : baselineBlock;
                const originalBasket = await basket.getBassets({ blockTag: blockNumber });
                const pausedTokens = [];
                for (const token of originalBasket) {
                    if (await pm.isPaused(token, { blockTag: blockNumber }))
                        pausedTokens.push(ethers.utils.getAddress(token));
                }
                state.baseline = { blockNumber, pausedTokens };
                state.action = action;
                save(file, state);
            }
            const originalBasket = await basket.getBassets({
                blockTag: state.baseline.blockNumber,
            });
            for (const op of ops) {
                if (
                    recorded.has(op.data.toLowerCase()) ||
                    state.baseline.pausedTokens.some((t) => same(t, op.token))
                )
                    continue;
                check(
                    originalBasket.some((t) => same(t, op.token)),
                    "Basset outside the original pause-run basket: use a new run after review"
                );
            }
        }
        const signingWallet = ms.connect(signer);
        for (const op of ops) {
            if (recorded.has(op.data.toLowerCase())) continue;
            if (!reversing && state.baseline.pausedTokens.some((t) => same(t, op.token))) continue;
            await authority();
            if (source)
                check(
                    crypto
                        .createHash("sha256")
                        .update(fs.readFileSync(source.file))
                        .digest("hex") === source.hash,
                    "Original pause journal changed"
                );
            check(await ms.isOwner(sender), "Signer no longer a multisig owner");
            const latestBasket = await basket.getBassets();
            check(
                latestBasket.some((t) => same(t, op.token)),
                "Basset removed from basket: stop and review"
            );
            const paused = await pm.isPaused(op.token);
            if (reversing ? !paused : paused) continue;
            check(
                (await provider.call({ from: wallet, to: pauseAddress, data: op.data })) === "0x",
                "Pause simulation failed"
            );
            const estimate = await signingWallet.estimateGas.submitTransaction(
                pauseAddress,
                0,
                op.data
            );
            const nonce = await provider.getTransactionCount(sender, "pending");
            const gasPrice = await provider.getGasPrice();
            state.inFlight = { token: op.token, nonce, data: op.data };
            save(file, state);
            let tx;
            try {
                tx = await signingWallet.submitTransaction(pauseAddress, 0, op.data, {
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
            console.log(`Submitted ${action} ${op.token}: ${tx.hash}. Waiting for receipt...`);
            await confirm(record);
            recorded.add(op.data.toLowerCase());
        }
        console.log(
            `Submission complete. Each multisig transaction has its first confirmation; two other owners must confirm to execute. Verify executed=true and isPaused(token)=${!reversing} after quorum.`
        );
        return state;
    } finally {
        if (sourceLock !== undefined) {
            fs.closeSync(sourceLock);
            fs.unlinkSync(`${source.file}.lock`);
        }
        fs.closeSync(lock);
        fs.unlinkSync(lockFile);
    }
}

async function pauseBassets(args, hre) {
    return changeBassetPause(args, hre, "pause");
}

async function unpauseBassets(args, hre) {
    return changeBassetPause(args, hre, "unpause");
}

task(
    "babelfish:pause-bassets",
    "Create sequential multisig transactions to pause Babelfish deposits"
)
    .addOptionalParam("token", "One basset address; omitted means every current unpaused basset")
    .addOptionalParam("signer", "Existing configured signer name/address/index", "deployer")
    .addOptionalParam("masset", "Babelfish Masset proxy", MASSET)
    .addOptionalParam("pausemanager", "Expected PauseManager", PAUSE_MANAGER)
    .addOptionalParam("multisig", "PauseManager owner multisig", MULTISIG)
    .addOptionalParam("journal", "Keep SAME journal when resuming", "babelfish-pause-bassets.json")
    .addFlag("submit", "Submit multisig transactions using the configured signer")
    .setAction(pauseBassets);

task(
    "babelfish:unpause-bassets",
    "Reverse only executed basset pauses from the original pause journal"
)
    .addOptionalParam(
        "pausejournal",
        "Original pause run journal; never the current paused-token list",
        "babelfish-pause-bassets.json"
    )
    .addOptionalParam(
        "token",
        "One token paused by the original run; omitted means all eligible tokens"
    )
    .addOptionalParam("signer", "Existing configured signer name/address/index", "deployer")
    .addOptionalParam("masset", "Babelfish Masset proxy", MASSET)
    .addOptionalParam("pausemanager", "Expected PauseManager", PAUSE_MANAGER)
    .addOptionalParam("multisig", "PauseManager owner multisig", MULTISIG)
    .addOptionalParam(
        "journal",
        "Separate unpause journal; keep SAME file when resuming",
        "babelfish-unpause-bassets.json"
    )
    .addFlag("submit", "Submit reversing multisig transactions using the configured signer")
    .setAction(unpauseBassets);

module.exports = { pauseBassets, unpauseBassets };
