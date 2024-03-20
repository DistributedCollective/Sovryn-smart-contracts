const { ethers, network, deploy } = require("hardhat");

const { TENDERLY_USERNAME, TENDERLY_PROJECT, TENDERLY_ACCESS_KEY } = process.env;
const SIMULATE_API = `https://api.tenderly.co/api/v1/account/${TENDERLY_USERNAME}/project/${TENDERLY_PROJECT}/simulate`;

const ETH_NATIVE_TOKEN_ADDRS = "0x0000000000000000000000000000000000000001";

const axios = require("axios");

const TOKENS = [
    {
        tokenName: "WBTC",
        tokenAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        from: "0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8",
        amountToSend: "1600000",
    },
    {
        tokenName: "ETH",
        tokenAddress: ETH_NATIVE_TOKEN_ADDRS,
        from: "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489",
        amountToSend: "300000000000000000",
    },
    {
        tokenName: "WETH",
        tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        from: "0xF04a5cC80B1E94C69B48f5ee68a08CD2F09A7c3E",
        amountToSend: "300000000000000000",
    },
    {
        tokenName: "USDT",
        tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        from: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
        amountToSend: "1000000000",
    },
    {
        tokenName: "USDC",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        from: "0x28C6c06298d514Db089934071355E5743bf21d60",
        amountToSend: "1000000000",
    },
    {
        tokenName: "DAI",
        tokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        from: "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf",
        amountToSend: "1000000000000000000000",
    },
];
async function main() {
    console.log("🖖🏽[ethers] Preparing token balance for safe in tenderly");
    console.log(TENDERLY_ACCESS_KEY);

    const { get } = deployments;

    const safeMultisigDeployment = await get("SafeBobDeposits");

    for (const token of TOKENS) {
        if (token.tokenAddress.toLowerCase() == ETH_NATIVE_TOKEN_ADDRS) continue;

        console.log(
            `Sending token ${token.tokenName} - ${token.tokenAddress} - ${token.amountToSend}`
        );
        const tokenContract = await ethers.getContractAt("TestToken", token.tokenAddress);
        const TX_DATA = await tokenContract.populateTransaction.transfer(
            safeMultisigDeployment.address,
            token.amountToSend
        );

        const transaction = {
            network_id: "1",
            from: token.from,
            input: TX_DATA.data,
            to: token.tokenAddress,
            value: "0",
            // tenderly specific
            save: true,
        };

        const opts = {
            headers: {
                "X-Access-Key": TENDERLY_ACCESS_KEY || "",
            },
        };

        const resp = await axios.post(SIMULATE_API, transaction, opts);
        console.log(resp.data);

        // Make the simulation publicly accessible
        if (resp.data && resp.data.simulation && resp.data.simulation.id) {
            const responseShare = await axios.post(
                `https://api.tenderly.co/api/v1/account/${TENDERLY_USERNAME}/project/${TENDERLY_PROJECT}/simulations/${resp.data.simulation.id}/share`,
                {},
                opts
            );

            console.log(responseShare.data);
        }
    }
}

main().catch((error) => {
    console.error(error.response);
    process.exitCode = 1;
});
