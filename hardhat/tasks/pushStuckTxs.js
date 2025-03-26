const { ethers } = require("ethers");
const dotenv = require("dotenv");

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const CHECK_INTERVAL = 30000; // check every 30 seconds
const GAS_BUMP_PERCENTAGE = 1.2; // increase gas by 20%

async function getFirstStuckNonce() {
    const latestNonce = await provider.getTransactionCount(wallet.address, "latest");
    const pendingNonce = await provider.getTransactionCount(wallet.address, "pending");

    console.log(`Latest confirmed nonce: ${latestNonce}`);
    console.log(`Next pending nonce: ${pendingNonce}`);

    return latestNonce < pendingNonce ? latestNonce : null;
}

async function fetchTransactionByNonce(nonce) {
    const txs = await provider.getBlockWithTransactions("pending");
    return txs.transactions.find(
        (tx) => tx.nonce === nonce && tx.from.toLowerCase() === wallet.address.toLowerCase()
    );
}

async function replaceTransaction(tx) {
    try {
        console.log(`Replacing stuck transaction with nonce ${tx.nonce}`);

        const newTx = {
            to: tx.to,
            value: tx.value,
            gasLimit: tx.gasLimit,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas.mul(GAS_BUMP_PERCENTAGE),
            maxFeePerGas: tx.maxFeePerGas.mul(GAS_BUMP_PERCENTAGE),
            nonce: tx.nonce,
        };

        const sentTx = await wallet.sendTransaction(newTx);
        console.log(`Resent transaction: ${sentTx.hash}`);
    } catch (error) {
        console.error(`Error replacing nonce ${tx.nonce}:`, error);
    }
}

async function monitorAndReplace() {
    while (true) {
        const stuckNonce = await getFirstStuckNonce();

        if (stuckNonce !== null) {
            console.log(
                `Checking nonce ${stuckNonce} again in ${CHECK_INTERVAL / 1000} seconds...`
            );
            await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));

            const stuckNonceCheck = await getFirstStuckNonce();
            if (stuckNonceCheck === stuckNonce) {
                console.log(`Nonce ${stuckNonce} is still stuck, replacing...`);
                const stuckTx = await fetchTransactionByNonce(stuckNonce);
                if (stuckTx) {
                    await replaceTransaction(stuckTx);
                } else {
                    console.log(`Could not find the stuck transaction in mempool.`);
                }
            }
        }

        await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
    }
}

// start monitoring
monitorAndReplace();
