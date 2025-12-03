const col = require("cli-color");

const func = async function (hre) {
    const {
        ethers,
        deployments: { deploy, get, log },
        getNamedAccounts,
        network,
    } = hre;
    // Custom deployment record and artifact name for BOS
    const deploymentName = "PriceFeedV1PoolOracleBOS";

    const isAddress = ethers.utils?.isAddress ?? ethers.isAddress;
    const getAddress = ethers.utils?.getAddress ?? ethers.getAddress;
    const parseEther = ethers.utils?.parseEther ?? ethers.parseEther;
    const hexlify = ethers.utils?.hexlify ?? ethers.hexlify;
    const solidityKeccak256 =
        ethers.utils?.solidityKeccak256 ??
        ((types, vals) => ethers.solidityPackedKeccak256(types, vals));
    const addrZero = ethers.constants?.AddressZero ?? ethers.ZeroAddress;
    const hashZero = ethers.constants?.HashZero ?? ethers.ZeroHash;

    const getContractCompat = async (name) => {
        if (ethers.getContract) {
            return ethers.getContract(name);
        }
        const dep = await get(name);
        return ethers.getContractAt(name, dep.address);
    };

    const { deployer } = await getNamedAccounts();

    const resolveAddress = async (value) => {
        if (!value) {
            return value;
        }
        if (isAddress(value)) {
            return getAddress(value);
        }
        const dep = await get(value);
        return dep.address;
    };

    // Required inputs (env-driven to keep config out of code)
    const v1PoolOracle =
        process.env.BOS_V1_POOL_ORACLE ?? "0x7899206a3d55688dafee9e42768ec582bf701050"; // WRBTC-BOS pool oracle
    const bosTokenEnv =
        process.env.BOS_TOKEN_ADDRESS ?? "0x3e3006896458f0acfe79b57a1a0fe067b3a1ce6f"; // BOS side token address
    const bosToken = getAddress(bosTokenEnv);

    // Shared addresses from existing deployments
    const wrbtc = await get("WRBTC");
    const doc = await get("DoC");

    log(col.bgYellow(`Deploying BOS PriceFeedV1PoolOracle on ${network.name}...`));
    const deployment = await deploy(deploymentName, {
        contract: "PriceFeedV1PoolOracleBOS",
        from: deployer,
        args: [v1PoolOracle, wrbtc.address, doc.address, bosToken],
        log: true,
    });

    // Tenderly verification with BOS artifact name
    if (hre.tenderly) {
        log(col.bgYellow("Submitting Tenderly verification..."));
        await hre.tenderly.verify({
            name: "PriceFeedV1PoolOracleBOS",
            address: deployment.address,
            constructorArguments: [v1PoolOracle, wrbtc.address, doc.address, bosToken],
            network: (network.config.chainId || "").toString(),
        });
        log(col.bgBlue("Tenderly verification submitted"));
    } else {
        log(col.yellow("Tenderly plugin not configured; skipping verification"));
    }

    const timelockAdmin = await get("TimelockAdmin");
    const feed = await ethers.getContractAt("PriceFeedV1PoolOracleBOS", deployment.address);
    await feed.transferOwnership(timelockAdmin.address);

    // Step 3: Add collateral params on each loan token (anyone can do)
    const torqueMinInitial = parseEther(process.env.BOS_TORQUE_MIN_INITIAL_MARGIN ?? "0.50");
    const marginMinInitial = parseEther(process.env.BOS_MARGIN_MIN_INITIAL_MARGIN ?? "0.20");
    const maintenance = parseEther(process.env.BOS_MAINTENANCE_MARGIN ?? "0.15");
    const loanTokenListRaw =
        process.env.BOS_LOAN_TOKENS ??
        "LoanToken_iXUSD,LoanToken_iRBTC,LoanToken_iBPRO,LoanToken_iDOC,LoanToken_iDLLR,LoanToken_iUSDT";
    const loanTokenNames = loanTokenListRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

    for (const loanTokenName of loanTokenNames) {
        const loanTokenAddress = await resolveAddress(loanTokenName);
        // Use the settings ABI to ensure setupLoanParams exists even if the deployment ABI is minimal
        const loan = await ethers.getContractAt("LoanTokenSettingsLowerAdmin", loanTokenAddress);

        const buildParams = (minInitialMargin) => [
            [hashZero, false, addrZero, addrZero, bosToken, minInitialMargin, maintenance, 0],
        ];

        for (const isTorque of [true, false]) {
            const params = buildParams(isTorque ? torqueMinInitial : marginMinInitial);
            const mode = isTorque ? "Torque" : "Margin";
            log(col.bgYellow(`Setting collateral for ${loanTokenName} (${mode})...`));
            const tx = await loan.setupLoanParams(params, isTorque);
            await tx.wait();

            const key = solidityKeccak256(["address", "bool"], [bosToken, isTorque]);
            const lpId = await loan.loanParamsIds(key);
            if (lpId === hashZero) {
                throw new Error(`Failed to enable collateral for ${loanTokenName} (${mode})`);
            }
            log(col.bgBlue(`Collateral enabled for ${loanTokenName} (${mode}) -> ${lpId}`));
        }
    }
};

func.tags = ["BOSPriceFeed"];
module.exports = func;
