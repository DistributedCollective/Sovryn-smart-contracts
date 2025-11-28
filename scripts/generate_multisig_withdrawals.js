const OUTPUT_FILE = "bridgeMultisigWithdrawCommands.txt";
const fs = require("fs");
// Usage: node scripts/generate_multisig_withdrawals.js
// This script fetches all non-zero token balances for specified multisig addresses on Ethereum, BSC, and Rootstock,
// filters tokens with value > $50, and outputs Hardhat multisig:send-tokens commands to withdraw all funds to a target address.

require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");

// ----------- CONFIG -----------
const ETH_BSC_TARGET_ADDRESS = "0xDd2311ecEB6Ec8A83C027FDe4aa04eA455ee3FC4";
const RSK_TARGET_ADDRESS = "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711";
const MIN_USD = 50;

const MULTISIGS = [
    {
        chain: "ethereum",
        rpc:
            process.env.INFURA_KEY &&
            typeof process.env.INFURA_KEY === "string" &&
            process.env.INFURA_KEY.length > 5
                ? `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`
                : "https://rpc.ankr.com/eth",
        multisig: "0x062c74f9d27b1178bb76186c1756128ccb3ccd2e",
        coingeckoPlatform: "ethereum",
        tokens: [
            "GasToken", // ETH
            "0xbdab72602e9ad40fc6a6852caf43258113b8f7a5", // eSOV
            "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
            "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
            "0x13239c268beddd88ad0cb02050d3ff6a9d00de6d", // BitcoinOS
            "0xbdbb63f938c8961af31ead3deba5c96e6a323dd1", // eDLLR
        ],
    },
    {
        chain: "bsc",
        rpc: "https://bsc-dataseed.binance.org/",
        multisig: "0xec3fabc3517e64e07669dd1d2d673f466f93a328",
        coingeckoPlatform: "binance-smart-chain",
        tokens: [
            "GasToken", // BNB
            "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", // DAI
            "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", // BUSD
            "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
            "0x55d398326f99059fF775485246999027B3197955", // USDT
            "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", // ETH
        ],
    },
    {
        chain: "rootstock",
        rpc: "https://public-node.rsk.co",
        multisig: "0xb64322e10b5ae1be121b8bb0dead560c53d9dbc3",
        coingeckoPlatform: "rootstock",
        tokens: [
            "GasToken", // RBTC
            "0x1a37c482465e78e6dabe1ec77b9a24d4236d2a11", // DAIes
            "0x3e3006896458f0acfe79b57a1a0fe067b3a1ce6f", // BOS
            "0x8d1f7cbc6391d95e2774380e80a666febf655d6b", // USDCes
            "0xc1411567d2670e24d9c4daaa7cda95686e1250aa", // DLLR
            "0xd9665ea8f5ff70cf97e1b1cd1b4cd0317b0976e8", // USDTes
            "0xefc78fc7d48b64958315949279ba181c2114abbd", // SOV
            "0xfe878227c8f334038dab20a99fc3b373ffe0a755", // ETHes
        ],
    },
    {
        chain: "rootstock",
        rpc: "https://public-node.rsk.co",
        multisig: "0xee9ea57555d9533d71f6f77e0e480961f068a6c5",
        coingeckoPlatform: "rootstock",
        tokens: [
            "GasToken", // RBTC
            "0x30d1b36924c2c0cd1c03ec257d7fff31bd8c3007", // ETHbs
            "0x61e9604e31a736129d7f5c58964c75935b2d80d6", // BUSDbs
            "0x6a42ff12215a90f50866a5ce43a9c9c870116e76", // DAIbs
            "0x91edcee9567cd5612c9dedeaae24d5e574820af1", // USDCbs
            "0xd2a826b78200c8434b957913ce4067e6e3169385", // BNBbs
            "0xefc78fc7d48b64958315949279ba181c2114abbd", // SOV
            "0xff4299bca0313c20a61dc5ed597739743bef3f6d", // USDTbs
        ],
    },
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
];

async function getTokenList(chainConfig) {
    // Use explicit token list from config
    return chainConfig.tokens || [];
}

async function getTokenBalanceAndDecimals(provider, token, multisig) {
    try {
        const contract = new ethers.Contract(token, ERC20_ABI, provider);
        const [balance, decimals, symbol] = await Promise.all([
            contract.balanceOf(multisig),
            contract.decimals(),
            contract.symbol().catch(() => token),
        ]);
        return { balance, decimals, symbol };
    } catch (e) {
        console.warn(
            `Error fetching balance/decimals/symbol for token ${token} on ${multisig}: ${e.message}`
        );
        return { balance: ethers.BigNumber.from(0), decimals: 18, symbol: token };
    }
}

async function getTokenPrice(token, platform) {
    // CoinGecko API
    try {
        const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${token}&vs_currencies=usd`;
        const res = await axios.get(url);
        return res.data[token.toLowerCase()]?.usd || 0;
    } catch (e) {
        return 0;
    }
}

async function processMultisig(chainConfig) {
    console.log(`Using RPC for ${chainConfig.chain}: ${chainConfig.rpc}`);
    let provider;
    try {
        provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);
        // Try to get network to check connectivity
        await provider.getNetwork();
    } catch (err) {
        console.error(`Failed to connect to RPC for ${chainConfig.chain}: ${chainConfig.rpc}`);
        return [];
    }
    const tokens = await getTokenList(chainConfig);
    const transfers = [];
    // Select correct target address
    const targetAddress =
        chainConfig.chain === "rootstock" ? RSK_TARGET_ADDRESS : ETH_BSC_TARGET_ADDRESS;

    // 1. Check native token balance (ETH, BNB, RBTC)
    let nativeSymbol;
    if (chainConfig.chain === "ethereum") {
        nativeSymbol = "ETH";
    } else if (chainConfig.chain === "bsc") {
        nativeSymbol = "BNB";
    } else if (chainConfig.chain === "rootstock") {
        nativeSymbol = "RBTC";
    }
    try {
        const nativeBalance = await provider.getBalance(chainConfig.multisig);
        if (!nativeBalance.isZero()) {
            transfers.push({
                token: "GasToken",
                to: targetAddress,
                amount: nativeBalance.toString(), // in wei
                symbol: nativeSymbol,
            });
        }
    } catch (err) {
        console.warn(
            `Could not fetch native token balance for ${chainConfig.chain}:`,
            err.message
        );
    }

    // 2. Check ERC20 tokens
    for (const token of tokens) {
        if (token === "GasToken") continue;
        const { balance, decimals, symbol } = await getTokenBalanceAndDecimals(
            provider,
            token,
            chainConfig.multisig
        );
        if (!balance.isZero()) {
            transfers.push({
                token,
                to: targetAddress,
                amount: balance.toString(), // Use raw value for Hardhat task
                symbol,
            });
        }
    }
    return transfers;
}

async function main() {
    let output = "";
    for (const chainConfig of MULTISIGS) {
        output += `\n--- ${chainConfig.chain.toUpperCase()} multisig: ${chainConfig.multisig} ---\n`;
        const transfers = await processMultisig(chainConfig);
        if (transfers.length === 0) {
            output += "No non-zero token balances found.\n";
            continue;
        }
        const transfersForTask = transfers.map(({ token, to, amount }) => ({ token, to, amount }));
        output += `npx hardhat multisig:send-tokens \\\n`;
        output += `  --transfers '${JSON.stringify(transfersForTask)}' \\\n`;
        output += `  --multisig ${chainConfig.multisig}\n`;
        output += `# Token symbols: ${transfers.map((t) => t.symbol || t.token).join(", ")}\n`;
        transfers.forEach((t) => {
            output += `# ${t.token}: ${t.amount} (~ $${t.usdValue})\n`;
        });
    }
    fs.writeFileSync(OUTPUT_FILE, output);
    console.log(`Output written to ${OUTPUT_FILE}`);
}

main().catch(console.error);
