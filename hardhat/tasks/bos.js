const { task } = require("hardhat/config");

task(
    "bos:tenderly:deploy-simulation",
    "Funds deployer on Tenderly VT and runs BOSPriceFeed deployment"
).setAction(async (_, hre) => {
    const { ethers, network } = hre;
    const [deployer] = await ethers.getSigners();

    const parseEther = ethers.utils?.parseEther ?? ethers.parseEther;
    const hexlify = ethers.utils?.hexlify ?? ethers.hexlify;
    const toBeHex = ethers.utils?.toBeHex ?? ethers.toBeHex;
    const formatEther = ethers.utils?.formatEther ?? ethers.formatEther;
    const getAddress = ethers.utils?.getAddress ?? ethers.getAddress;
    const fundAmount = parseEther(process.env.BOS_TENDERLY_FUND_AMOUNT ?? "1"); // 1 rBTC default

    // Tenderly cheatcode to top up native balance on the VT
    // Normalize hex without leading zero nibble (Tenderly examples use 0xde0b6b3a7640000 for 1e18)
    const rawHex = typeof fundAmount === "bigint" ? toBeHex(fundAmount) : hexlify(fundAmount);
    const balanceHex = "0x" + BigInt(rawHex).toString(16);
    const addr = getAddress(deployer.address);
    const rpcUrl = hre.network.config.url;
    const accessKey =
        process.env.TENDERLY_SOVRYN_ACCESS_KEY ?? process.env.TENDERLY_ACCESS_KEY ?? "";
    const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "tenderly_setBalance",
        params: [[addr], balanceHex], // documented VT shape: addresses array + hex balance
    };
    console.log("VT funding payload:", {
        rpcUrl,
        addr,
        balanceHex,
        accessKey,
    });
    const res = await fetch(rpcUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(accessKey ? { "X-Access-Key": accessKey } : {}),
        },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.error) {
        throw new Error(`tenderly_setBalance failed: ${json.error.message || "unknown error"}`);
    }

    console.log(
        `Funded ${deployer.address} with ${formatEther(fundAmount)} native token on ${network.name}`
    );

    // Run only the BOS price feed deploy script directly to avoid unrelated deploy scripts
    const bosDeploy = require("../../deployment/deploy/2160-deploy-BOSPriceFeedV1PoolOracle.js");
    await bosDeploy(hre);
});

task(
    "bos:tenderly:deploy-on-rsk-mainnet",
    "runs DIRECTLY BOSPriceFeed deployment - check you have funds on RSK mainnet"
).setAction(async (_, hre) => {
    const { network } = hre;

    // Check if we are on the RSK network (chainId 30)
    const chainIdHex = await network.provider.send("eth_chainId");
    const chainId = parseInt(chainIdHex, 16);
    if (chainId !== 30) {
        throw new Error("This task can only be run on the RSK mainnet (chainId 30).");
    }

    // Ensure the network is not marked as forked
    const tags = Array.isArray(network.config.tags) ? network.config.tags : [];
    if (tags.includes("forked")) {
        throw new Error("This task cannot run on a forked network.");
    }

    // Run only the BOS price feed deploy script directly to avoid unrelated deploy scripts
    const bosDeploy = require("../../deployment/deploy/2160-deploy-BOSPriceFeedV1PoolOracle.js");
    await bosDeploy(hre);
});
