const { task } = require("hardhat/config");
const https = require("https");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

const EXPLORER_API_URLS = {
    30: "https://rootstock.blockscout.com/api",
    31: "https://rootstock-testnet.blockscout.com/api",
};

const explorerGetJson = (url) =>
    new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(
                            new Error(`Failed to parse explorer response: ${data.slice(0, 200)}`)
                        );
                    }
                });
            })
            .on("error", reject);
    });

const fetchLogsViaExplorer = async (explorerApiUrl, { address, fromBlock, toBlock, topics }) => {
    const url = new URL(explorerApiUrl);
    url.searchParams.set("module", "logs");
    url.searchParams.set("action", "getLogs");
    url.searchParams.set("fromBlock", String(fromBlock));
    url.searchParams.set("toBlock", String(toBlock));
    url.searchParams.set("address", address);

    if (topics[0]) url.searchParams.set("topic0", topics[0]);
    if (topics[1]) {
        url.searchParams.set("topic0_1_opr", "and");
        url.searchParams.set("topic1", topics[1]);
    }

    const json = await explorerGetJson(url.toString());

    if (json.status === "0") {
        const msg = (json.message || "").toLowerCase();
        if (msg.includes("no") && (msg.includes("record") || msg.includes("log"))) {
            return [];
        }
        throw new Error(`Explorer API error: ${json.message || json.result || "Unknown error"}`);
    }

    if (json.status !== "1") {
        throw new Error(`Explorer API error: ${json.message || json.result || "Unknown error"}`);
    }

    if (!Array.isArray(json.result)) {
        return [];
    }

    const parseNum = (v) => {
        if (typeof v === "number") return v;
        if (typeof v === "string") return v.startsWith("0x") ? parseInt(v, 16) : parseInt(v, 10);
        return 0;
    };

    return json.result.map((entry) => ({
        address: entry.address,
        topics: (entry.topics || []).filter(Boolean),
        data: entry.data,
        blockNumber: parseNum(entry.blockNumber),
        transactionHash: entry.transactionHash,
        transactionIndex: parseNum(entry.transactionIndex),
        logIndex: parseNum(entry.logIndex),
        blockHash: entry.blockHash || null,
    }));
};

task(
    "feeSharingCollector:initialize",
    "Initialize feeSharingCollector: set WRBTC and Loan Token WRBTC addresses to the FeeSharingCollector storage"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await initializeFeeSharingCollector(hre, signer, true);
    });

task("feeSharingCollector:setWrtbcTokenAddress", "Set WRBTC token address in feeSharingCollector")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await setWrbtcTokenAddress(hre, signer, true);
    });

task(
    "feeSharingCollector:setLoanTokenWrtbcAddress",
    "Set WRBTC loan token address in feeSharingCollector"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await setLoanTokenWrbtcAddress(hre, signer, true);
    });

task(
    "feeSharingCollector:getWithheldFees",
    "Print protocol withheld fees by token: symbol | address | amount (4 decimals)"
).setAction(async (_, hre) => {
    const { ethers } = hre;

    const toCommaSeparated = (value) => {
        return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const formatRoundedAmount = (amount, decimals) => {
        const tenThousand = ethers.BigNumber.from(10000);
        const ten = ethers.BigNumber.from(10);
        const decimalsNum = Number(decimals);

        let amountInTenThousandths;
        if (decimalsNum >= 4) {
            const factor = ten.pow(decimalsNum - 4);
            amountInTenThousandths = amount.add(factor.div(2)).div(factor);
        } else {
            const factor = ten.pow(4 - decimalsNum);
            amountInTenThousandths = amount.mul(factor);
        }

        const whole = amountInTenThousandths.div(tenThousand).toString();
        const fraction = amountInTenThousandths.mod(tenThousand).toString().padStart(4, "0");
        return `${toCommaSeparated(whole)}.${fraction}`;
    };

    const readTokenMeta = async (tokenAddress) => {
        const rbtcSpecialAddress = "0xeabd29be3c3187500df86a2613c6470e12f2d77d";
        if (tokenAddress.toLowerCase() === rbtcSpecialAddress) {
            return { symbol: "RBTC", decimals: 18 };
        }

        let symbol = "UNKNOWN";
        let decimals;

        try {
            const tokenStringSymbol = await ethers.getContractAt(
                ["function symbol() view returns (string)"],
                tokenAddress
            );
            symbol = await tokenStringSymbol.symbol();
        } catch (e) {
            try {
                const tokenBytesSymbol = await ethers.getContractAt(
                    ["function symbol() view returns (bytes32)"],
                    tokenAddress
                );
                const rawSymbol = await tokenBytesSymbol.symbol();
                symbol = ethers.utils.parseBytes32String(rawSymbol);
            } catch (_ignored) {}
        }

        try {
            const tokenDecimals = await ethers.getContractAt(
                ["function decimals() view returns (uint8)"],
                tokenAddress
            );
            decimals = await tokenDecimals.decimals();
        } catch (e) {
            throw new Error(
                `Could not read decimals() for token ${tokenAddress}. ERC20 token must implement decimals().`
            );
        }

        return { symbol, decimals };
    };

    const protocol = await ethers.getContract("ISovryn");
    const fscAddress = await protocol.feesController();
    if (!ethers.utils.isAddress(fscAddress)) {
        throw new Error(
            `Invalid FeeSharingCollector address from ISovryn.feesController(): ${fscAddress}`
        );
    }
    const feeSharingCollector = await ethers.getContractAt("FeeSharingCollector", fscAddress);
    const network = await ethers.provider.getNetwork();
    const tokenAddresses = await feeSharingCollector.getProtocolWithholdTokensList();

    if (tokenAddresses.length === 0) {
        logger.info(
            `No tokens found in protocol withhold list. network=${network.chainId} fsc=${fscAddress}`
        );
        return;
    }

    const rows = [];
    for (const tokenAddress of tokenAddresses) {
        const { symbol, decimals } = await readTokenMeta(tokenAddress);
        const rawWithheldAmount = await feeSharingCollector.getProtocolWithheldFees(tokenAddress);
        rows.push({
            symbol,
            address: tokenAddress,
            amount: formatRoundedAmount(rawWithheldAmount, decimals),
        });
    }

    const headers = {
        symbol: "TOKEN",
        address: "ADDRESS",
        amount: "WITHHELD",
    };

    const symbolWidth = Math.max(headers.symbol.length, ...rows.map((r) => r.symbol.length));
    const addressWidth = Math.max(headers.address.length, ...rows.map((r) => r.address.length));
    const amountWidth = Math.max(headers.amount.length, ...rows.map((r) => r.amount.length));

    const headerLine = `${headers.symbol.padEnd(symbolWidth)} | ${headers.address.padEnd(
        addressWidth
    )} | ${headers.amount.padStart(amountWidth)}`;
    const dividerLine = `${"-".repeat(symbolWidth)}-+-${"-".repeat(
        addressWidth
    )}-+-${"-".repeat(amountWidth)}`;

    console.log(`\nnetwork: ${network.chainId}`);
    console.log(`feeSharingCollector: ${fscAddress}\n`);
    console.log(headerLine);
    console.log(dividerLine);
    rows.forEach((row) => {
        console.log(
            `${row.symbol.padEnd(symbolWidth)} | ${row.address.padEnd(
                addressWidth
            )} | ${row.amount.padStart(amountWidth)}`
        );
    });
});

task(
    "feeSharingCollector:protocolRevenueTxs",
    "List txs that emitted ProtocolRevenueAccumulated in the last N days"
)
    .addOptionalParam("days", "Lookback window in days", "10")
    .addOptionalParam("chunk", "Max block range per eth_getLogs request", "2000")
    .addOptionalParam("sleep", "Sleep in ms between requests", "120")
    .addOptionalParam(
        "token",
        "Optional token address filter. Use 'RBTC' for RBTC dummy address filter."
    )
    .setAction(async ({ days, chunk, sleep, token }, hre) => {
        const { ethers } = hre;
        const rbtcDummyAddress = "0xEaBD29bE3C3187500DF86a2613C6470E12F2D77d";

        const lookbackDays = Number(days);
        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            throw new Error(`Invalid --days value: ${days}`);
        }
        const sleepMs = Number(sleep);
        if (!Number.isFinite(sleepMs) || sleepMs < 0) {
            throw new Error(`Invalid --sleep value: ${sleep}`);
        }
        let chunkSize = Number(chunk);
        if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
            throw new Error(`Invalid --chunk value: ${chunk}`);
        }
        chunkSize = Math.floor(chunkSize);

        const protocol = await ethers.getContract("ISovryn");
        const fscAddress = await protocol.feesController();
        if (!ethers.utils.isAddress(fscAddress)) {
            throw new Error(
                `Invalid FeeSharingCollector address from ISovryn.feesController(): ${fscAddress}`
            );
        }
        const feeSharingCollector = await ethers.getContractAt("FeeSharingCollector", fscAddress);

        const provider = ethers.provider;
        const latestBlock = await provider.getBlock("latest");
        const cutoffTimestamp = latestBlock.timestamp - Math.floor(lookbackDays * 24 * 60 * 60);

        const findStartBlock = async (targetTimestamp) => {
            let low = 0;
            let high = latestBlock.number;
            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                const block = await provider.getBlock(mid);
                if (block.timestamp < targetTimestamp) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }
            return low;
        };

        const startBlock = await findStartBlock(cutoffTimestamp);
        const topic0 = ethers.utils.id("ProtocolRevenueAccumulated(address,uint256)");

        const topics = [topic0];
        let normalizedTokenFilter;
        if (token) {
            normalizedTokenFilter =
                token.toUpperCase() === "RBTC" ? rbtcDummyAddress : ethers.utils.getAddress(token);
            topics.push(ethers.utils.hexZeroPad(normalizedTokenFilter, 32).toLowerCase());
        }

        const sleepFor = async (ms) =>
            new Promise((resolve) => {
                setTimeout(resolve, ms);
            });

        const collectLogsInChunks = async () => {
            const logs = [];
            const minChunkSize = 100;
            let fromBlock = startBlock;
            let useExplorer = false;
            let explorerUrl = null;

            while (fromBlock <= latestBlock.number) {
                const toBlock = Math.min(fromBlock + chunkSize - 1, latestBlock.number);
                let retrySameRange = false;

                if (useExplorer) {
                    for (let attempt = 1; attempt <= 5; attempt++) {
                        try {
                            const chunkLogs = await fetchLogsViaExplorer(explorerUrl, {
                                address: feeSharingCollector.address,
                                fromBlock,
                                toBlock,
                                topics,
                            });
                            logs.push(...chunkLogs);
                            break;
                        } catch (error) {
                            const msg = String(
                                error && error.message ? error.message : error
                            ).toLowerCase();
                            if (
                                (msg.includes("429") || msg.includes("rate")) &&
                                chunkSize > minChunkSize
                            ) {
                                chunkSize = Math.max(minChunkSize, Math.floor(chunkSize / 2));
                                console.log(
                                    `Explorer rate-limited. Reducing chunk to ${chunkSize}, retrying ${fromBlock}-${toBlock}.`
                                );
                                retrySameRange = true;
                                await sleepFor(Math.max(1000, sleepMs));
                                break;
                            }
                            if (attempt < 5) {
                                await sleepFor(Math.max(500, sleepMs * attempt));
                                continue;
                            }
                            throw error;
                        }
                    }

                    if (retrySameRange) continue;
                    fromBlock = toBlock + 1;
                    if (sleepMs > 0) await sleepFor(sleepMs);
                    continue;
                }

                for (let attempt = 1; attempt <= 5; attempt++) {
                    try {
                        const chunkLogs = await provider.getLogs({
                            address: feeSharingCollector.address,
                            fromBlock,
                            toBlock,
                            topics,
                        });
                        logs.push(...chunkLogs);
                        break;
                    } catch (error) {
                        const message = String(error && error.message ? error.message : error);
                        const msgLower = message.toLowerCase();
                        const unsupportedLogsMethod =
                            msgLower.includes("eth_getlogs does not exist") ||
                            msgLower.includes("eth_getlogs is not available");
                        const rateLimitedOrForbidden =
                            msgLower.includes("403") ||
                            msgLower.includes("429") ||
                            msgLower.includes("forbidden");
                        const rangeTooWide =
                            msgLower.includes("block range") ||
                            msgLower.includes("query returned more than") ||
                            msgLower.includes("response size exceeded");

                        if (unsupportedLogsMethod) {
                            const network = await provider.getNetwork();
                            explorerUrl = EXPLORER_API_URLS[network.chainId];
                            if (!explorerUrl) {
                                throw new Error(
                                    `eth_getLogs is not supported by this RPC and no explorer API is configured for chain ${network.chainId}. ` +
                                        "Use an RPC endpoint that supports logs or a self-hosted node."
                                );
                            }
                            console.log(
                                `eth_getLogs not supported by RPC; falling back to explorer API (${explorerUrl})`
                            );
                            useExplorer = true;
                            retrySameRange = true;
                            break;
                        }

                        if ((rateLimitedOrForbidden || rangeTooWide) && chunkSize > minChunkSize) {
                            chunkSize = Math.max(minChunkSize, Math.floor(chunkSize / 2));
                            console.log(
                                `Reducing chunk size due RPC limits. New chunk=${chunkSize}, retrying block range ${fromBlock}-${toBlock}.`
                            );
                            retrySameRange = true;
                            await sleepFor(Math.max(500, sleepMs));
                            break;
                        }

                        if (attempt < 5) {
                            await sleepFor(Math.max(500, sleepMs * attempt));
                            continue;
                        }

                        throw error;
                    }
                }

                if (retrySameRange) continue;

                fromBlock = toBlock + 1;
                if (sleepMs > 0) await sleepFor(sleepMs);
            }

            return logs;
        };

        const logs = await collectLogsInChunks();

        if (logs.length === 0) {
            console.log(
                `No ProtocolRevenueAccumulated events found in the last ${lookbackDays} day(s).`
            );
            return;
        }

        const tokenMeta = new Map();
        const getTokenMeta = async (tokenAddress) => {
            const addr = ethers.utils.getAddress(tokenAddress);
            if (tokenMeta.has(addr)) return tokenMeta.get(addr);

            if (addr.toLowerCase() === rbtcDummyAddress.toLowerCase()) {
                const meta = { symbol: "RBTC", decimals: 18 };
                tokenMeta.set(addr, meta);
                return meta;
            }

            const tokenContract = await ethers.getContractAt(
                [
                    "function symbol() view returns (string)",
                    "function decimals() view returns (uint8)",
                ],
                addr
            );
            const [symbol, decimals] = await Promise.all([
                tokenContract.symbol(),
                tokenContract.decimals(),
            ]);
            const meta = { symbol, decimals: Number(decimals) };
            tokenMeta.set(addr, meta);
            return meta;
        };

        const blockTsCache = new Map();
        const getBlockTimestamp = async (blockNumber) => {
            if (blockTsCache.has(blockNumber)) return blockTsCache.get(blockNumber);
            const block = await provider.getBlock(blockNumber);
            blockTsCache.set(blockNumber, block.timestamp);
            return block.timestamp;
        };

        const network = await provider.getNetwork();
        console.log(`\nnetwork: ${network.chainId}`);
        console.log(`feeSharingCollector: ${feeSharingCollector.address}`);
        console.log(`window: last ${lookbackDays} day(s)`);
        console.log(`blocks: ${startBlock} -> ${latestBlock.number}`);
        if (normalizedTokenFilter) {
            console.log(`token filter: ${normalizedTokenFilter}`);
        }

        console.log("\nTIMESTAMP (UTC)       | BLOCK    | TOKEN  | AMOUNT              | TX HASH");
        console.log(
            "----------------------+----------+--------+---------------------+------------------------------------------------------------------"
        );

        for (const log of logs) {
            const parsed = feeSharingCollector.interface.parseLog(log);
            const tokenAddress = parsed.args.token;
            const amount = parsed.args.amount;

            const { symbol, decimals } = await getTokenMeta(tokenAddress);
            const ts = await getBlockTimestamp(log.blockNumber);
            const iso = new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19);
            const humanAmount = ethers.utils.formatUnits(amount, decimals);

            console.log(
                `${iso.padEnd(21)} | ${String(log.blockNumber).padEnd(8)} | ${symbol.padEnd(
                    6
                )} | ${humanAmount.padStart(19)} | ${log.transactionHash}`
            );
        }
    });

const initializeFeeSharingCollector = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    let initializeSelector = ethers.utils.id("initialize(address,address)").substring(0, 10);
    const isInitialized = await (
        await ethers.getContract("FeeSharingCollector")
    ).isFunctionExecuted(initializeSelector);
    if (isInitialized) {
        logger.error("FeeSharingCollector has already been initialized");
        return;
    }

    const wrbtcToken = (await get("WRBTC")).address;
    const loanWrbtcToken = (await get("LoanToken_iRBTC")).address;

    if (!ethers.utils.isAddress(wrbtcToken)) {
        logger.error(`WRBTC - ${wrbtcToken} is invalid address`);
        return;
    }

    if (!ethers.utils.isAddress(loanWrbtcToken)) {
        logger.error(`loan token iRBTC - ${loanWrbtcToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function initialize(address wrbtcToken, address loanWrbtcToken)",
    ]);
    let data = await iface.encodeFunctionData("initialize", [wrbtcToken, loanWrbtcToken]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};

const setWrbtcTokenAddress = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const wrbtcToken = (await get("WRBTC")).address;
    if (!ethers.utils.isAddress(wrbtcToken)) {
        logger.error(`wrbtcToken - ${wrbtcToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function setWrbtcToken(address newWrbtcTokenAddress)",
    ]);
    let data = await iface.encodeFunctionData("setWrbtcToken", [wrbtcToken]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};

task(
    "feeSharingCollector:getAccumulatedFees",
    "Print accumulated fee-sharing rewards for a user on a (possibly old) FeeSharingCollector"
)
    .addParam("user", "Address of the user (staker) to query")
    .addOptionalParam(
        "fsc",
        "FeeSharingCollector address to query (defaults to current one from protocol)"
    )
    .setAction(async ({ user, fsc: fscOverride }, hre) => {
        const { ethers } = hre;

        // --- resolve FeeSharingCollector address ---
        let fscAddress;
        if (fscOverride) {
            fscAddress = ethers.utils.getAddress(fscOverride);
        } else {
            const protocol = await ethers.getContract("ISovryn");
            fscAddress = await protocol.feesController();
        }

        // Use a minimal ABI that works with both old and new FeeSharingCollector.
        // The old contract exposes `numTokenCheckpoints` (auto-getter before rename);
        // the new one renamed the storage to `totalTokenCheckpoints` but added a
        // backwards-compat `numTokenCheckpoints` wrapper.  Both expose
        // `processedCheckpoints` and `getAccumulatedFees`.
        const fscAbi = [
            "function numTokenCheckpoints(address) view returns (uint256)",
            "function totalTokenCheckpoints(address) view returns (uint256)",
            "function processedCheckpoints(address,address) view returns (uint256)",
            "function getAccumulatedFees(address,address) view returns (uint256)",
        ];
        const feeSharingCollector = await ethers.getContractAt(fscAbi, fscAddress);

        // Detect which checkpoint getter works on this contract
        const getNumCheckpoints = async (token) => {
            for (const fn of ["numTokenCheckpoints", "totalTokenCheckpoints"]) {
                try {
                    return await feeSharingCollector[fn](token);
                } catch {
                    // try next
                }
            }
            return ethers.BigNumber.from(0);
        };

        const userAddress = ethers.utils.getAddress(user);
        const network = await ethers.provider.getNetwork();

        console.log(`\nnetwork:               ${network.chainId}`);
        console.log(`feeSharingCollector:   ${fscAddress}`);
        console.log(`user:                  ${userAddress}\n`);

        // --- build candidate token list ---
        // RBTC dummy
        const rbtcDummy = "0xEaBD29bE3C3187500DF86a2613C6470E12F2D77d";
        // Well-known mainnet addresses
        const mainnetContracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const candidateTokens = [
            { label: "RBTC (dummy)", address: rbtcDummy },
            { label: "WRBTC", address: mainnetContracts.WRBTC },
            { label: "iRBTC", address: mainnetContracts.iRBTC },
            { label: "iDOC", address: mainnetContracts.iDOC },
            { label: "iXUSD", address: mainnetContracts.iXUSD },
            { label: "iUSDT", address: mainnetContracts.iUSDT },
            { label: "iBPro", address: mainnetContracts.iBPro },
            { label: "iDLLR", address: mainnetContracts.iDLLR },
            { label: "SOV", address: mainnetContracts.SOV },
            { label: "MYNT", address: mainnetContracts.MYNT },
        ].filter((t) => t.address);

        // --- query each token ---
        const rows = [];
        for (const candidate of candidateTokens) {
            const totalCheckpoints = await getNumCheckpoints(candidate.address);
            if (totalCheckpoints.eq(0)) continue;

            const processed = await feeSharingCollector.processedCheckpoints(
                userAddress,
                candidate.address
            );

            let accumulated;
            try {
                accumulated = await feeSharingCollector.getAccumulatedFees(
                    userAddress,
                    candidate.address
                );
            } catch {
                accumulated = ethers.BigNumber.from(0);
            }

            if (accumulated.eq(0) && processed.gte(totalCheckpoints)) continue;

            rows.push({
                label: candidate.label,
                address: candidate.address,
                totalCheckpoints: totalCheckpoints.toString(),
                processed: processed.toString(),
                accumulated,
            });
        }

        if (rows.length === 0) {
            console.log("No accumulated fees found for this user.");
            return;
        }

        // --- resolve underlying values for iTokens ---
        const iTokenLabels = new Set(["iRBTC", "iDOC", "iXUSD", "iUSDT", "iBPro", "iDLLR"]);
        const underlyingMap = {
            iRBTC: { symbol: "WRBTC", decimals: 18 },
            iDOC: { symbol: "DoC", decimals: 18 },
            iXUSD: { symbol: "XUSD", decimals: 18 },
            iUSDT: { symbol: "USDT", decimals: 18 },
            iBPro: { symbol: "BPro", decimals: 18 },
            iDLLR: { symbol: "DLLR", decimals: 18 },
        };

        const output = [];
        for (const row of rows) {
            const entry = {
                token: row.label,
                tokenAddress: row.address,
                checkpoints: `${row.processed} / ${row.totalCheckpoints}`,
                accumulatedRaw: row.accumulated,
            };

            if (iTokenLabels.has(row.label) && row.accumulated.gt(0)) {
                try {
                    const iToken = await ethers.getContractAt(
                        [
                            "function tokenPrice() view returns (uint256)",
                            "function loanTokenAddress() view returns (address)",
                        ],
                        row.address
                    );
                    const price = await iToken.tokenPrice();
                    // underlying = iTokenAmount * tokenPrice / 1e18
                    const underlyingAmount = row.accumulated
                        .mul(price)
                        .div(ethers.constants.WeiPerEther);
                    const meta = underlyingMap[row.label] || { symbol: "?", decimals: 18 };
                    entry.underlyingSymbol = meta.symbol;
                    entry.underlyingAmount = underlyingAmount;
                    entry.underlyingFormatted = ethers.utils.formatUnits(
                        underlyingAmount,
                        meta.decimals
                    );
                    entry.iTokenPrice = ethers.utils.formatUnits(price, 18);
                } catch (e) {
                    entry.underlyingSymbol = "ERR";
                    entry.underlyingAmount = ethers.BigNumber.from(0);
                    entry.underlyingFormatted = `error: ${e.message}`;
                }
            }

            output.push(entry);
        }

        // --- print table ---
        const hdr =
            "TOKEN".padEnd(8) +
            " | " +
            "CHECKPOINTS".padEnd(14) +
            " | " +
            "ACCUMULATED (pool token)".padStart(28) +
            " | " +
            "UNDERLYING".padStart(28);

        const div =
            "-".repeat(8) +
            "-+-" +
            "-".repeat(14) +
            "-+-" +
            "-".repeat(28) +
            "-+-" +
            "-".repeat(28);

        console.log(hdr);
        console.log(div);

        for (const entry of output) {
            const accFormatted = ethers.utils.formatUnits(entry.accumulatedRaw, 18);
            let underlyingStr = "";
            if (entry.underlyingSymbol) {
                underlyingStr = `${entry.underlyingFormatted} ${entry.underlyingSymbol}`;
            }
            console.log(
                `${entry.token.padEnd(8)} | ${entry.checkpoints.padEnd(14)} | ${accFormatted.padStart(28)} | ${underlyingStr.padStart(28)}`
            );
        }

        // --- also print iToken prices for reference ---
        const iTokenRows = output.filter((e) => e.iTokenPrice);
        if (iTokenRows.length > 0) {
            console.log("\niToken prices (underlying per 1 iToken):");
            for (const e of iTokenRows) {
                console.log(`  ${e.token}: ${e.iTokenPrice}`);
            }
        }
    });

const setLoanTokenWrbtcAddress = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const loanWrbtcToken = (await get("iRBTC")).address;
    if (!ethers.utils.isAddress(loanWrbtcToken)) {
        logger.error(`loanWrbtcToken - ${loanWrbtcToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function setLoanTokenWrbtc(address newLoanTokenWrbtcAddress)",
    ]);
    let data = await iface.encodeFunctionData("setLoanTokenWrbtc", [loanWrbtcToken]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};
