const path = require("path");
const { expect } = require("chai");
const {
    impersonateAccount,
    setBalance,
    stopImpersonatingAccount,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

const { ethers, network } = hre;

// Built artifacts of the sibling oracle-based-amm checkout. Defaults to it
// sitting beside this repo; override when it lives elsewhere. An absolute
// path here only ever resolves on the machine that wrote it.
const AMM_ARTIFACTS =
    process.env.USDT0_AMM_ARTIFACTS ||
    path.resolve(__dirname, "../../oracle-based-amm/solidity/build/contracts");
const RSK_MAINNET_RPC = process.env.USDT0_AMM_FORK_URL || "https://mainnet-dev.sovryn.app/rpc";
const FORK_BLOCK_NUMBER = process.env.USDT0_AMM_FORK_BLOCK
    ? Number(process.env.USDT0_AMM_FORK_BLOCK)
    : undefined;
const ZERO_ADDRESS = ethers.constants.AddressZero;
const TRANSFER_TOPIC = ethers.utils.id("Transfer(address,address,uint256)");

const MAINNET = {
    CONTRACT_REGISTRY: "0x46ebc03ef2277308bdb106a73d11c65109c4b89b",
    CONVERTER_REGISTRY: "0x31a0f8400c75d52fdb413372233f28e3bdfb1c06",
    SOVRYN_SWAP_NETWORK: "0x98ace08d2b759a265ae326f010496bcd63c15afc",
    WRBTC: "0x542fda317318ebf1d3deaf76e0b632741a7e677d",
    USDT0: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
};

const CONVERTER_TYPE_V1 = 1;
const WEIGHT_50_PERCENT = 500000;
const MAX_CONVERSION_FEE = 1000000;
const CONVERSION_FEE = 3500; // 0.35%
const ORACLE_K = 6779;

const SEED_WRBTC = ethers.utils.parseEther("0.0009");
const SEED_USDT0 = ethers.utils.parseUnits("100", 6);
const SWAP_WRBTC = ethers.utils.parseEther("0.000001");
const SWAP_USDT0 = ethers.utils.parseUnits("0.05", 6);

const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
];

const WRBTC_ABI = [...ERC20_ABI, "function deposit() payable"];

function ammArtifact(name) {
    return require(path.join(AMM_ARTIFACTS, `${name}.json`));
}

function ammContract(name, address, signerOrProvider) {
    return new ethers.Contract(address, ammArtifact(name).abi, signerOrProvider);
}

async function resetMainnetFork() {
    const forking = { jsonRpcUrl: RSK_MAINNET_RPC };
    if (FORK_BLOCK_NUMBER) {
        forking.blockNumber = FORK_BLOCK_NUMBER;
    }

    await network.provider.request({
        method: "hardhat_reset",
        params: [{ forking }],
    });
}

async function findUsdt0Holder(provider, minBalance) {
    if (process.env.USDT0_AMM_USDT0_HOLDER) {
        return ethers.utils.getAddress(process.env.USDT0_AMM_USDT0_HOLDER);
    }

    const usdt0 = new ethers.Contract(MAINNET.USDT0, ERC20_ABI, provider);
    const latestBlock = await provider.getBlockNumber();
    const chunkSize = 9500;
    const maxBlocks = Number(process.env.USDT0_AMM_HOLDER_SCAN_BLOCKS || 400000);
    const minBlock = Math.max(0, latestBlock - maxBlocks);

    for (let toBlock = latestBlock; toBlock >= minBlock; toBlock -= chunkSize) {
        const fromBlock = Math.max(minBlock, toBlock - chunkSize + 1);
        const logs = await provider.getLogs({
            address: MAINNET.USDT0,
            topics: [TRANSFER_TOPIC],
            fromBlock,
            toBlock,
        });

        for (let i = logs.length - 1; i >= 0; i--) {
            const to = ethers.utils.getAddress(`0x${logs[i].topics[2].slice(26)}`);
            if (to === ZERO_ADDRESS) {
                continue;
            }

            if ((await usdt0.balanceOf(to)).gte(minBalance)) {
                return to;
            }
        }
    }

    throw new Error(
        `No USDT0 holder with at least ${ethers.utils.formatUnits(minBalance, 6)} USDT0 found in the last ${maxBlocks} blocks. Set USDT0_AMM_USDT0_HOLDER to a funded holder.`
    );
}

describe("USDT0 AMM deployment simulation on forked Rootstock mainnet", function () {
    this.timeout(180000);

    let deployer;
    let converterRegistry;
    let sovrynSwapNetwork;
    let wrbtc;
    let usdt0;

    before(async function () {
        await resetMainnetFork();

        [deployer] = await ethers.getSigners();
        converterRegistry = ammContract("ConverterRegistry", MAINNET.CONVERTER_REGISTRY, deployer);
        sovrynSwapNetwork = ammContract(
            "SovrynSwapNetwork",
            MAINNET.SOVRYN_SWAP_NETWORK,
            deployer
        );
        wrbtc = new ethers.Contract(MAINNET.WRBTC, WRBTC_ABI, deployer);
        usdt0 = new ethers.Contract(MAINNET.USDT0, ERC20_ABI, deployer);
    });

    it("creates, registers, seeds, and swaps through a USDT0/WRBTC V1 converter", async function () {
        expect(await usdt0.decimals()).to.equal(6);

        const reserveTokens = [MAINNET.WRBTC, MAINNET.USDT0];
        const reserveWeights = [WEIGHT_50_PERCENT, WEIGHT_50_PERCENT];
        const existingPool = await converterRegistry.getLiquidityPoolByConfig(
            CONVERTER_TYPE_V1,
            reserveTokens,
            reserveWeights
        );
        expect(existingPool).to.equal(ZERO_ADDRESS);

        const predictedConverter = await converterRegistry.callStatic.newConverter(
            CONVERTER_TYPE_V1,
            "(WR)BTC/USDT0 Liquidity Pool",
            "(WR)BTC/USDT0",
            18,
            MAX_CONVERSION_FEE,
            reserveTokens,
            reserveWeights
        );

        await converterRegistry.newConverter(
            CONVERTER_TYPE_V1,
            "(WR)BTC/USDT0 Liquidity Pool",
            "(WR)BTC/USDT0",
            18,
            MAX_CONVERSION_FEE,
            reserveTokens,
            reserveWeights
        );
        await converterRegistry.setupConverter(
            CONVERTER_TYPE_V1,
            reserveTokens,
            reserveWeights,
            predictedConverter
        );

        const converter = ammContract("LiquidityPoolV1Converter", predictedConverter, deployer);
        const poolTokenAddress = await converter.token();
        const poolToken = new ethers.Contract(poolTokenAddress, ERC20_ABI, deployer);

        expect(await converterRegistry.isLiquidityPool(poolTokenAddress)).to.equal(true);
        expect((await converter.owner()).toLowerCase()).to.equal(MAINNET.CONVERTER_REGISTRY);

        await converter.acceptOwnership();
        expect(await converter.owner()).to.equal(deployer.address);
        await converter.setConversionFee(CONVERSION_FEE);

        const oracleArtifact = ammArtifact("Oracle");
        const oracleFactory = new ethers.ContractFactory(
            oracleArtifact.abi,
            oracleArtifact.bytecode,
            deployer
        );
        const oracle = await oracleFactory.deploy(predictedConverter, MAINNET.WRBTC);
        await oracle.deployed();
        await oracle.setK(ORACLE_K);
        await converter.setOracle(oracle.address);

        await wrbtc.deposit({ value: SEED_WRBTC.add(SWAP_WRBTC.mul(2)) });

        const usdt0Holder = await findUsdt0Holder(
            ethers.provider,
            SEED_USDT0.add(SWAP_USDT0.mul(2))
        );
        await setBalance(usdt0Holder, ethers.utils.parseEther("1"));
        await impersonateAccount(usdt0Holder);
        await usdt0
            .connect(await ethers.getSigner(usdt0Holder))
            .transfer(deployer.address, SEED_USDT0.add(SWAP_USDT0.mul(2)));
        await stopImpersonatingAccount(usdt0Holder);

        await wrbtc.approve(predictedConverter, SEED_WRBTC);
        await usdt0.approve(predictedConverter, SEED_USDT0);
        await converter.addLiquidity(reserveTokens, [SEED_WRBTC, SEED_USDT0], 1);

        expect(await poolToken.balanceOf(deployer.address)).to.be.gt(0);
        expect(await wrbtc.balanceOf(predictedConverter)).to.equal(SEED_WRBTC);
        expect(await usdt0.balanceOf(predictedConverter)).to.equal(SEED_USDT0);

        const assertSwapAccounting = async ({
            sourceToken,
            targetToken,
            sourceAddress,
            targetAddress,
            path,
            amount,
            minHumanScaleReturn,
            maxHumanScaleReturn,
        }) => {
            const converterQuote = await converter.targetAmountAndFee(
                sourceAddress,
                targetAddress,
                amount
            );
            const expectedReturn = converterQuote[0];
            const networkQuote = await sovrynSwapNetwork.rateByPath(path, amount);
            await sourceToken.approve(MAINNET.SOVRYN_SWAP_NETWORK, amount);
            const staticReturn = await sovrynSwapNetwork.callStatic.convertByPath(
                path,
                amount,
                1,
                deployer.address,
                ZERO_ADDRESS,
                0
            );

            expect(expectedReturn).to.equal(networkQuote);
            expect(expectedReturn).to.equal(staticReturn);
            expect(expectedReturn).to.be.gte(minHumanScaleReturn);
            expect(expectedReturn).to.be.lte(maxHumanScaleReturn);

            const sourceReserveBefore = await sourceToken.balanceOf(predictedConverter);
            const targetReserveBefore = await targetToken.balanceOf(predictedConverter);
            const sourceWalletBefore = await sourceToken.balanceOf(deployer.address);
            const targetWalletBefore = await targetToken.balanceOf(deployer.address);

            await sovrynSwapNetwork.convertByPath(
                path,
                amount,
                expectedReturn,
                deployer.address,
                ZERO_ADDRESS,
                0
            );

            const sourceReserveAfter = await sourceToken.balanceOf(predictedConverter);
            const targetReserveAfter = await targetToken.balanceOf(predictedConverter);
            const sourceWalletAfter = await sourceToken.balanceOf(deployer.address);
            const targetWalletAfter = await targetToken.balanceOf(deployer.address);

            expect(sourceWalletBefore.sub(sourceWalletAfter)).to.equal(amount);
            expect(targetWalletAfter.sub(targetWalletBefore)).to.equal(expectedReturn);
            expect(sourceReserveAfter.sub(sourceReserveBefore)).to.equal(amount);
            expect(targetReserveBefore.sub(targetReserveAfter)).to.equal(expectedReturn);
        };

        const pathWrbtcToUsdt0 = await sovrynSwapNetwork.conversionPath(
            MAINNET.WRBTC,
            MAINNET.USDT0
        );
        expect(pathWrbtcToUsdt0.map((item) => item.toLowerCase())).to.deep.equal([
            MAINNET.WRBTC.toLowerCase(),
            poolTokenAddress.toLowerCase(),
            MAINNET.USDT0.toLowerCase(),
        ]);
        await assertSwapAccounting({
            sourceToken: wrbtc,
            targetToken: usdt0,
            sourceAddress: MAINNET.WRBTC,
            targetAddress: MAINNET.USDT0,
            path: pathWrbtcToUsdt0,
            amount: SWAP_WRBTC,
            minHumanScaleReturn: ethers.utils.parseUnits("0.1", 6),
            maxHumanScaleReturn: ethers.utils.parseUnits("0.12", 6),
        });

        const pathUsdt0ToWrbtc = await sovrynSwapNetwork.conversionPath(
            MAINNET.USDT0,
            MAINNET.WRBTC
        );
        expect(pathUsdt0ToWrbtc.map((item) => item.toLowerCase())).to.deep.equal([
            MAINNET.USDT0.toLowerCase(),
            poolTokenAddress.toLowerCase(),
            MAINNET.WRBTC.toLowerCase(),
        ]);
        await assertSwapAccounting({
            sourceToken: usdt0,
            targetToken: wrbtc,
            sourceAddress: MAINNET.USDT0,
            targetAddress: MAINNET.WRBTC,
            path: pathUsdt0ToWrbtc,
            amount: SWAP_USDT0,
            minHumanScaleReturn: ethers.utils.parseEther("0.0000004"),
            maxHumanScaleReturn: ethers.utils.parseEther("0.0000005"),
        });
    });
});
