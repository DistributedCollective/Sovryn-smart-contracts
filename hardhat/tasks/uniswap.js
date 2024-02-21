const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");
const { Percent } = require("@uniswap/sdk-core");
const { nearestUsableTick, Position } = require("@uniswap/v3-sdk");

task("migrateLiquidityFromV2ToV3", "Migrate Liquidity from V2 to V3 pool")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        const {
            deployments: { get },
            ethers,
        } = hre;

        const config = {
            percentageToMigrate: 100,
            fee: 10000,
            refundAsETH: false,
            deadlineInSeconds: 1200, // 20 mins
            slippageTolerance: new Percent(50, 10_000),
        };

        const signerAcc = (await hre.getNamedAccounts())[signer];

        const multisigDeployment = await get("MultiSigWallet");

        const uniswapV2SovPool = await ethers.getContract("UniswapV2SovPool");
        const uniswapV3SovPool = await ethers.getContract("UniswapV3SovPool");

        const uniswapV3MigratorDeployment = await get("UniswapV3Migrator");
        const uniswapV2SovPoolDeployment = await get("UniswapV2SovPool");
        const uniswapV3SovPoolDeployment = await get("UniswapV3SovPool");

        const multisigV2PoolBalance = await uniswapV2SovPool.balanceOf(multisigDeployment.address);
        const token0Address = await uniswapV2SovPool.token0();
        const token1Address = await uniswapV2SovPool.token1();
        const v3PoolTickSpacing = await uniswapV3SovPool.tickSpacing();
        const v3PoolTick = (await uniswapV3SovPool.slot0())[1];

        const token0Contract = await ethers.getContractAt("ERC20", token0Address);
        const token1Contract = await ethers.getContractAt("ERC20", token1Address);

        const amount0Min = (await token0Contract.balanceOf(uniswapV2SovPoolDeployment.address))
            .mul(ethers.BigNumber.from(config.percentageToMigrate))
            .div(ethers.BigNumber.from(100));
        const amount1Min = (await token1Contract.balanceOf(uniswapV2SovPoolDeployment.address))
            .mul(ethers.BigNumber.from(config.percentageToMigrate))
            .div(ethers.BigNumber.from(100));

        const migrationParams = {
            pair: uniswapV2SovPoolDeployment.address,
            liquidityToMigrate: multisigV2PoolBalance.toString(),
            percentageToMigrate: config.percentageToMigrate,
            token0: token0Address,
            token1: token1Address,
            fee: config.fee,
            tickLower: nearestUsableTick(v3PoolTick, v3PoolTickSpacing) - v3PoolTickSpacing * 2,
            tickUpper: nearestUsableTick(v3PoolTick, v3PoolTickSpacing) + v3PoolTickSpacing * 2,
            amount0Min: amount0Min.toString(),
            amount1Min: amount1Min.toString(),
            recipient: multisigDeployment.address,
            deadline: Math.floor(Date.now() / 1000) + config.deadlineInSeconds,
            refundAsETH: config.refundAsETH,
        };

        // await uniswapV3Migrator.migrate(migrationParams);
        const uniswapV3MigratorInterface = new ethers.utils.Interface(
            uniswapV3MigratorDeployment.abi
        );

        logger.info("Migrating liquidity...");
        logger.info(migrationParams);
        let data = uniswapV3MigratorInterface.encodeFunctionData("migrate", [migrationParams]);
        await sendWithMultisig(
            multisigDeployment.address,
            uniswapV3MigratorDeployment.address,
            data,
            signerAcc
        );
    });
