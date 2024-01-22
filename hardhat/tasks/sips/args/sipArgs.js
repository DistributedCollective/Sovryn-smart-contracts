const { HardhatRuntimeEnvironment } = require("hardhat/types");
const {
    getStakingModulesNames,
    getProtocolModules,
} = require("../../../../deployment/helpers/helpers");
const { validateAmmOnchainAddresses, getAmmOracleAddress } = require("../../../helpers");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const col = require("cli-color");

const sampleGovernorOwnerSIP = async (hre) => {
    /*
        target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0037: The Sovryn Mynt: https://github.com/DistributedCollective/SIPS/blob/8bd786c/SIP-0037.md, sha256: 35904333545f2df983173e5e95a31020fbc2e3922a70f23e5bae94ee94194a3e"
    */
    const {
        ethers,
        deployments: { get },
    } = hre;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (![31, 31337].includes(chainId)) {
        throw new Error(`sampleGovernorOwnerSIP cannot run on the network ID == ${chainId}`);
    }
    const SampleToken = await ethers.getContractFactory("ERC20");
    const args = {
        targets: [(await get("SOV")).address],
        values: [0],
        signatures: ["symbol()"],
        data: ["0x"],
        description:
            "SIP-SAMPLE-GOVERNOR-OWNER: Dummy proposal - will call SOV.symbol(). SHA256: 16a581f5f5e2b22dbf2ffcfb73fce6c850d2f039d1d7aa4adae983c17f4a6953",
    };

    return { args, governor: "GovernorOwner" };
};

const sampleGovernorAdminSIP = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (![31, 31337].includes(chainId)) {
        throw new Error(`sampleGovernorOwnerSIP cannot run on the network ID == ${chainId}`);
    }
    const SampleToken = await ethers.getContractFactory("ERC20");
    const args = {
        targets: [(await hre.deployments.get("SOV")).address],
        values: [0],
        signatures: ["name()"],
        data: ["0x"],
        description:
            "SIP-SAMPLE-GOVERNOR-ADMIN: Dummy proposal - will call SOV.name(). SHA256: 4912fe9c24aa4c050c5743dadca689769726fd61f2f996a307f2977b80e32b19 ",
    };

    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0049 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();
    const stakingModulesProxyDeployment = await get("StakingModulesProxy");
    const stakingModulesProxyInterface = new ethers.utils.Interface(
        stakingModulesProxyDeployment.abi
    );
    const stakingProxy = await ethers.getContract("StakingProxy");
    const isNewModulesProxy =
        (await stakingProxy.getImplementation()) != stakingModulesProxyDeployment.implementation;

    const moduleNamesObject = getStakingModulesNames();

    const addModules = [];
    const replaceModulesFrom = [];
    const replaceModulesTo = [];
    const invalidModules = [];
    const targets = [];
    const values = [];
    const signatures = [];
    const datas = [];

    for (let newModuleName in moduleNamesObject) {
        const newModuleDeployment = await get(newModuleName);
        const newModuleAddress = newModuleDeployment.address;
        addModules.push(newModuleAddress);
        /* we are skipping these validations because otherwise we would need to have Staking modules proxy implementation set (and voted) 
            // first and then execute modules replacement 
            // but leaving here commented to be used further as a boilerplate
            if (await stakingModules.canAddModule(newModuleAddress)) {
                addModules.push(newModuleAddress);
            } else {
                const clashing = await stakingModules.checkClashingFuncSelectors(
                    newModuleAddress
                );
                const clashingUnique = clashing.clashingModules.filter(arrayToUnique);

                if (clashingUnique.length == 1) {
                    replaceModulesFrom.push(clashingUnique[0]);
                    replaceModulesTo.push(newModuleAddress);
                } else if (clashing.clashingModules.length > 1) {
                    const invalidModulesLog = clashing.clashingModules.reduce((o, c, i) => {
                        o[c] = o[c]
                            ? o[c] + ", " + clashing.clashingModulesFuncSelectors[i]
                            : clashing.clashingModulesFuncSelectors[i];
                        return o;
                    });
                    invalidModules.push({
                        name: newModuleName,
                        address: newModuleAddress,
                        clashing: invalidModulesLog,
                    });
                }
        } 
        */
    }

    // if (invalidModules.length != 0)
    //    throw Exception("Function clashing with multiple modules log:" + invalidModules);

    //targets = [contracts['Staking'], contracts['Staking']]
    if (isNewModulesProxy) {
        targets.push(stakingProxy.address);
        values.push(0);
        signatures.push("setImplementation(address)");
        datas.push(abiCoder.encode(["address"], [stakingModulesProxyDeployment.implementation]));
    }
    if (addModules.length > 0) {
        targets.push(stakingProxy.address);
        values.push(0);
        signatures.push("addModules(address[])");
        datas.push(abiCoder.encode(["address[]"], [addModules]));
    }
    if (replaceModulesFrom.length > 0) {
        targets.push(stakingProxy.address);
        values.push(0);
        signatures.push("replaceModules(address[],address[])");
        datas.push(
            abiCoder.encode(["address[]", "address[]"], [replaceModulesFrom, replaceModulesTo])
        );
        throw new Error(
            "SIP-0049 is initial Staking modules deployment and should not have modules to replace"
        );
    }
    description =
        "SIP-0049: Staking contract refactoring and other improvements, Details: https://github.com/DistributedCollective/SIPS/blob/48a3f26/SIP-0049.md, sha256: 666a1d06a574d17acb44c34d443edcce724bbd34709b005d0f49b848e4adf9ce";

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: description,
    };

    return { args, governor: "GovernorOwner" };
};

const getArgsSip0058 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;

    const modulesFrom = [
        "0x4Ca823cEd18212876bB13092e4460cC65d2c7874", // StakingVestingModule
        "0x7Fe861e0948df601f28e0d84664Fa2Ddf4b39155", // StakingWithdrawModule
    ];
    const modulesTo = [
        (await get("StakingVestingModule")).address, //"0x53C5C57302e7A6529C1A298B036426b944dC23Af",
        (await get("StakingWithdrawModule")).address, //"0xf97c4751E4c75d28B600b0207519f2C71aA8902c",
    ];

    console.log(modulesTo);

    const args = {
        targets: [(await get("StakingProxy")).address],
        values: [0],
        signatures: ["replaceModules(address[],address[])"],
        data: [
            ethers.utils.defaultAbiCoder.encode(
                ["address[]", "address[]"],
                [modulesFrom, modulesTo]
            ),
        ],
        description:
            "SIP-0058: Staking contract update, Details: https://github.com/DistributedCollective/SIPS/blob/7c96f89/SIP-0058.md, sha256: da1a79797bad8b1d830cd188046dc62946f90af7a6b016c540eaee419e720c10",
    };

    return { args, governor: "GovernorOwner" };
};

const getArgsSip0063 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;

    const modulesFrom = [
        "0xdf41bD1F610d0DBe9D990e3eb04fd983777f1966", // StakingStakeModule
    ];
    const modulesTo = [(await get("StakingStakeModule")).address];

    console.log([modulesFrom], "->", [modulesTo]);

    const args = {
        targets: [(await get("StakingProxy")).address],
        values: [0],
        signatures: ["replaceModules(address[],address[])"],
        data: [
            ethers.utils.defaultAbiCoder.encode(
                ["address[]", "address[]"],
                [modulesFrom, modulesTo]
            ),
        ],
        description:
            "SIP-0063: Fix Staking Bug to Prevent Reverting Delegated Voting Power, Details: https://github.com/DistributedCollective/SIPS/blob/12f2600/SIP-0063.md, sha256: c56786f8bd6907c844720a127136b6ee0189360790f3e87f1490b23e2ddd614a",
    };

    return { args, governor: "GovernorOwner" };
};

const getArgsSip0065 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;

    const contracts = require("../../../../scripts/contractInteraction/mainnet_contracts.json");
    const AdoptionFundAddress = contracts["AdoptionFund"];
    const DevelopmentFundAddress = contracts["DevelopmentFund"];
    const SovAddress = contracts["SOV"];
    const multiSigAddress = contracts["multisig"];
    const amountFromAdoption = ethers.utils.parseEther("1000000");
    const amountFromDevelopment = ethers.utils.parseEther("2000000");
    const amountToTransfer = ethers.utils.parseEther("3000000");

    const args = {
        targets: [AdoptionFundAddress, DevelopmentFundAddress, SovAddress],
        values: [0, 0, 0],
        signatures: [
            "withdrawTokensByUnlockedTokenOwner(uint256)",
            "withdrawTokensByUnlockedTokenOwner(uint256)",
            "transfer(address,uint256)",
        ],
        data: [
            ethers.utils.defaultAbiCoder.encode(["uint256"], [amountFromAdoption]),
            ethers.utils.defaultAbiCoder.encode(["uint256"], [amountFromDevelopment]),
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256"],
                [multiSigAddress, amountToTransfer]
            ),
        ],
        description:
            "SIP-0065: Transfer of SOV from Adoption and Development Funds to Exchequer, Details: https://github.com/DistributedCollective/SIPS/blob/cd3d249cddb6a5d0af59209c337c6864ad922007/SIP-0065.md, sha256: d6a703af4d3866ff6a7f927b680da23f450338d5346dca5d3d1e6b5751c45550",
    };

    return { args, governor: "GovernorOwner" };
};

const getArgsSip0046Part1 = async (hre) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const ownershipABI = [
        "function owner() view returns(address)",
        "function newOwner() view returns(address)",
    ];
    const ownershipInterface = new ethers.utils.Interface(ownershipABI);
    const multisigDeployment = await get("MultiSigWallet");
    const timeLockAdminDeployment = await get("TimelockAdmin");

    const deploymentTargets = [
        {
            deployment: await get("AmmSovrynSwapNetwork"),
            contractName: "SovrynSwapNetwork",
            sourceContractTypeToValidate: "ContractRegistry",
            sourceContractNameToValidate: "AmmContractRegistry",
        },
        {
            deployment: await get("AmmSwapSettings"),
            contractName: "SwapSettings",
            sourceContractTypeToValidate: "ContractRegistry",
            sourceContractNameToValidate: "AmmContractRegistry",
        },
        {
            deployment: "oracle",
            contractName: "MocOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterMoc",
        },
        {
            deployment: "oracle",
            contractName: "SovOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterSov",
        },
        {
            deployment: "oracle",
            contractName: "EthOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterEth",
        },
        {
            deployment: "oracle",
            contractName: "BnbOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterBnb",
        },
        {
            deployment: "oracle",
            contractName: "XusdOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterXusd",
        },
        {
            deployment: "oracle",
            contractName: "FishOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterFish",
        },
        {
            deployment: "oracle",
            contractName: "RifOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterRif",
        },
    ];

    const targets = [];
    const values = [];
    const signatures = [];
    const datas = [];
    for (let i = 0; i < deploymentTargets.length; i++) {
        deploymentTarget = deploymentTargets[i];
        if (deploymentTarget.deployment === "oracle") {
            const oracleAddress = await getAmmOracleAddress(
                deploymentTarget.sourceContractNameToValidate,
                deploymentTarget.sourceContractTypeToValidate
            );
            if (oracleAddress === ethers.constants.AddressZero) {
                logger.error(`Zero address for oracle converter ${deploymentTarget.contractName}`);
                return process.exit;
            }
            const oracleArtifact = await deployments.getArtifact("Oracle");
            deploymentTarget.deployment = await ethers.getContractAt(
                oracleArtifact.abi,
                oracleAddress
            );
        } else {
            const isValid = await validateAmmOnchainAddresses(deploymentTarget);
            if (!isValid) {
                logger.error(
                    `validation amm onchain address is failed for ${deploymentTarget.contractName}`
                );
                return process.exit;
            }
        }

        const ammContract = await ethers.getContractAt(
            ownershipInterface,
            deploymentTarget.deployment.address
        );
        const currentOwner = await ammContract.owner();
        const newTargetOwner = await ammContract.newOwner();

        if (currentOwner.toLowerCase() !== multisigDeployment.address.toLowerCase()) {
            logger.error(
                `${deploymentTarget.contractName} - Current owner (${currentOwner}) is not the multisig (${multisigDeployment.address})`
            );
            return process.exit;
        }

        if (newTargetOwner.toLowerCase() !== timeLockAdminDeployment.address.toLowerCase()) {
            logger.warn(
                `${deploymentTarget.contractName} - New target owner (${newTargetOwner}) is not the timelock admin (${timeLockAdminDeployment.address})`
            );
            // return process.exit; - no need to revert because the first step ownership transfer setting `newOwner` should be done only after the SIP passed
        }

        targets.push(deploymentTarget.deployment.address);
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description:
            "SIP-0046: Transferring ownership of Sovryn contracts (Part 1), Details: https://github.com/DistributedCollective/SIPS/blob/5029109/SIP-0046_part-1.md, sha256: 4771e1014fa6e213a0d352797466fa88368c28e438bb455b923795d16ab7e0b5",
    };

    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0046Part2 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

    const ownershipABI = [
        "function owner() view returns(address)",
        "function newOwner() view returns(address)",
    ];
    const ownershipInterface = new ethers.utils.Interface(ownershipABI);
    const multisigDeployment = await get("MultiSigWallet");
    const timeLockAdminDeployment = await get("TimelockAdmin");

    const deploymentTargets = [
        {
            deployment: "oracle",
            contractName: "MyntOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterMynt",
        },
        {
            deployment: "oracle",
            contractName: "DllrOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterDllr",
        },
        {
            deployment: await get("AmmConversionPathFinder"),
            contractName: "ConversionPathFinder",
            sourceContractTypeToValidate: "ContractRegistry",
            sourceContractNameToValidate: "AmmContractRegistry",
        },
        {
            deployment: await get("AmmConverterUpgrader"),
            contractName: "ConverterUpgrader",
        },
        {
            deployment: await get("AmmConverterRegistryData"),
            contractName: "ConverterRegistryData",
        },
        {
            deployment: await get("AmmOracleWhitelist"),
            contractName: "OracleWhitelist",
        },
        {
            deployment: await get("AmmRbtcWrapperProxy"),
            contractName: "RbtcWrapperProxy",
        },
    ];

    const targets = [];
    const values = [];
    const signatures = [];
    const datas = [];
    for (let i = 0; i < deploymentTargets.length; i++) {
        deploymentTarget = deploymentTargets[i];
        if (deploymentTarget.deployment === "oracle") {
            const oracleAddress = await getAmmOracleAddress(
                deploymentTarget.sourceContractNameToValidate,
                deploymentTarget.sourceContractTypeToValidate
            );
            if (oracleAddress === ethers.constants.AddressZero) return process.exit;
            const oracleArtifact = await deployments.getArtifact("Oracle");
            deploymentTarget.deployment = await ethers.getContractAt(
                oracleArtifact.abi,
                oracleAddress
            );
        } else {
            const isValid = await validateAmmOnchainAddresses(deploymentTarget);
            if (!isValid) return process.exit;
        }

        const ammContract = await ethers.getContractAt(
            ownershipInterface,
            deploymentTarget.deployment.address
        );
        const currentOwner = await ammContract.owner();
        const newTargetOwner = await ammContract.newOwner();

        if (currentOwner.toLowerCase() !== multisigDeployment.address.toLowerCase()) {
            logger.error(
                `${deploymentTarget.contractName} - Current owner (${currentOwner}) is not the multisig (${multisigDeployment.address})`
            );
            return process.exit;
        }

        if (newTargetOwner.toLowerCase() !== timeLockAdminDeployment.address.toLowerCase()) {
            logger.warn(
                `${deploymentTarget.contractName} - New target owner (${newTargetOwner}) is not the timelock admin (${timeLockAdminDeployment.address})`
            );
            // return process.exit; - no need to revert because the first step ownership transfer setting `newOwner` should be done only after the SIP passed
        }

        targets.push(deploymentTarget.deployment.address);
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description:
            "SIP-0046: Transferring ownership of Sovryn contracts (Part 2), Details: https://github.com/DistributedCollective/SIPS/blob/0a7782d/SIP-0046_part-2.md, sha256: c1880b8b3b223c2dc53bb72d5f1c78f5c1ef6e44167b58fb00c6bec143bf896e",
    };

    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0046Part3 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

    const ownershipABI = [
        "function owner() view returns(address)",
        "function newOwner() view returns(address)",
    ];
    const ownershipInterface = new ethers.utils.Interface(ownershipABI);
    const multisigDeployment = await get("MultiSigWallet");
    const timeLockOwnerDeployment = await get("TimelockOwner");

    const deploymentTargets = [
        {
            deployment: await get("AmmConverterDoc"),
            contractName: "ConverterDoc",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterUsdt"),
            contractName: "ConverterUsdt",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterBpro"),
            contractName: "ConverterBpro",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterBnb"),
            contractName: "ConverterBnb",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterMoc"),
            contractName: "ConverterMoc",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterXusd"),
            contractName: "ConverterXusd",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterSov"),
            contractName: "ConverterSov",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterEth"),
            contractName: "ConverterEth",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterFish"),
            contractName: "ConverterFish",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterMynt"),
            contractName: "ConverterMynt",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
    ];

    const targets = [];
    const values = [];
    const signatures = [];
    const datas = [];
    for (let i = 0; i < deploymentTargets.length; i++) {
        const deploymentTarget = deploymentTargets[i];
        const isValid = await validateAmmOnchainAddresses(deploymentTarget);
        if (!isValid) {
            logger.error(
                `validation amm onchain address is failed for ${deploymentTarget.contractName}`
            );
            return process.exit;
        }

        const ammContract = await ethers.getContractAt(
            ownershipInterface,
            deploymentTarget.deployment.address
        );
        const currentOwner = await ammContract.owner();
        const newTargetOwner = await ammContract.newOwner();

        if (currentOwner.toLowerCase() !== multisigDeployment.address.toLowerCase()) {
            logger.error(
                `${deploymentTarget.contractName} - Current owner (${currentOwner}) is not the multisig (${multisigDeployment.address})`
            );
            return process.exit;
        }

        if (newTargetOwner.toLowerCase() !== timeLockOwnerDeployment.address.toLowerCase()) {
            logger.warn(
                `${deploymentTarget.contractName} - New target owner (${newTargetOwner}) is not the timelock owner (${timeLockOwnerDeployment.address})`
            );
            // return process.exit; - no need to revert because the first step ownership transfer setting `newOwner` should be done only after the SIP passed
        }

        targets.push(deploymentTarget.deployment.address);
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description:
            "SIP-0046: Transferring ownership of Sovryn contracts (Part 3), Details: https://github.com/DistributedCollective/SIPS/blob/873e1da/SIP-0046_part-3.md, sha256: 0204ccd3b9556105915f9dc243b42a610cbe2f5f082b7d3fa7ab361c66a929e9",
    };

    return { args, governor: "GovernorOwner" };
};

const getArgsSip0046Part4 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

    const ownershipABI = [
        "function owner() view returns(address)",
        "function newOwner() view returns(address)",
    ];
    const ownershipInterface = new ethers.utils.Interface(ownershipABI);
    const multisigDeployment = await get("MultiSigWallet");
    const timeLockOwnerDeployment = await get("TimelockOwner");

    const deploymentTargets = [
        {
            deployment: await get("AmmConverterRif"),
            contractName: "ConverterRif",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmConverterDllr"),
            contractName: "ConverterDllr",
            sourceContractTypeToValidate: "ConverterRegistry",
            sourceContractNameToValidate: "AmmConverterRegistry",
        },
        {
            deployment: await get("AmmContractRegistry"),
            contractName: "ContractRegistry",
        },
        {
            deployment: await get("AmmConverterFactory"),
            contractName: "ConverterFactory",
            sourceContractTypeToValidate: "ContractRegistry",
            sourceContractNameToValidate: "AmmContractRegistry",
        },
    ];

    const targets = [];
    const values = [];
    const signatures = [];
    const datas = [];
    for (let i = 0; i < deploymentTargets.length; i++) {
        const deploymentTarget = deploymentTargets[i];
        const isValid = await validateAmmOnchainAddresses(deploymentTarget);
        if (!isValid) {
            logger.error(
                `validation amm onchain address is failed for ${deploymentTarget.contractName}`
            );
            return process.exit;
        }

        const ammContract = await ethers.getContractAt(
            ownershipInterface,
            deploymentTarget.deployment.address
        );
        const currentOwner = await ammContract.owner();
        const newTargetOwner = await ammContract.newOwner();

        if (currentOwner.toLowerCase() !== multisigDeployment.address.toLowerCase()) {
            logger.error(
                `${deploymentTarget.contractName} - Current owner (${currentOwner}) is not the multisig (${multisigDeployment.address})`
            );
            return process.exit;
        }

        if (newTargetOwner.toLowerCase() !== timeLockOwnerDeployment.address.toLowerCase()) {
            logger.warn(
                `${deploymentTarget.contractName} - New target owner (${newTargetOwner}) is not the timelock owner (${timeLockOwnerDeployment.address})`
            );
            // return process.exit; - no need to revert because the first step ownership transfer setting `newOwner` should be done only after the SIP passed
        }

        targets.push(deploymentTarget.deployment.address);
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description:
            "SIP-0046: Transferring ownership of Sovryn contracts (Part 4), Details: https://github.com/DistributedCollective/SIPS/blob/f350a00/SIP-0046_part-4.md, sha256: 51f041f0a2df9bb6cae180b2cb30fb92ba9b46a016d6e228401e0ee4bcbeef7d",
    };
    return { args, governor: "GovernorOwner" };
};

const getArgsSip0047 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();
    const multisigDeployment = await get("MultiSigWallet");
    const staking = await get("Staking");
    const multisigAddress = multisigDeployment.address;
    const stakingAddress = staking.address;
    let guardianAddress;
    if (network.tags.mainnet) {
        guardianAddress = "0xDd8e07A57560AdA0A2D84a96c457a5e6DDD488b7".toLowerCase();
    } else {
        logger.error("Unknown network");
        process.exit(1);
    }
    const args = {
        targets: [stakingAddress, stakingAddress],
        values: [0, 0],
        signatures: ["addPauser(address)", "removePauser(address)"],
        data: [
            abiCoder.encode(["address"], [guardianAddress]),
            abiCoder.encode(["address"], [multisigAddress]),
        ],
        description:
            "SIP-0047: Changing of the Guardians, Details: https://github.com/DistributedCollective/SIPS/blob/018582f/SIP-0047.md, sha256: be610df85582328b0205412dd6da87e2805d1a8656d591e0c09bc9783888b831",
    };
    return { args, governor: "GovernorOwner" };
};

const getArgsSip0073 = async (hre) => {
    const {
        ethers,
        deployments: { get, log },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();
    const swapsImplSovrynSwapModuleDeployment = await get("SwapsImplSovrynSwapModule");
    const modulesList = getProtocolModules();
    const sovrynProtocolDeployment = await get("SovrynProtocol");
    const sovrynProtocol = await ethers.getContract("SovrynProtocol");

    const targets = [];
    const values = [];
    const signatures = [];
    const datas = [];

    let isValidDeployment = false;

    for (const moduleProp in modulesList) {
        const module = modulesList[moduleProp];
        const moduleDeployment = await get(module.moduleName);
        const currentModuleAddress = await sovrynProtocol.getTarget(module.sampleFunction);

        if (currentModuleAddress != moduleDeployment.address) {
            isValidDeployment = true;
        }
    }

    if (!isValidDeployment) {
        throw new Error(col.bgYellow(`No modules are available to be upgraded`));
    }

    for (const moduleProp in modulesList) {
        const module = modulesList[moduleProp];
        const moduleDeployment = await get(module.moduleName);
        const currentModuleAddress = await sovrynProtocol.getTarget(module.sampleFunction);

        if (currentModuleAddress == moduleDeployment.address) {
            log(col.bgYellow(`Skipping Protocol Modules ${module.moduleName}`));
            continue;
        } else {
            log(
                col.bgBlue(
                    `Adding module ${module.moduleName} for registration/replacement on the protocol`
                )
            );
        }

        targets.push(sovrynProtocolDeployment.address);
        values.push(0);
        signatures.push("replaceContract(address)");
        datas.push(abiCoder.encode(["address"], [moduleDeployment.address]));
    }

    const description =
        "SIP-0073: Refactor Sovryn Protocol Interface with AMM, Details: https://github.com/DistributedCollective/SIPS/blob/c988248/SIP-0073.md, sha256: 243f9045b7a122f84cd6589efc524eda2c8a17668424840adf7cdebdfcb19b62";
    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: description,
    };
    return { args, governor: "GovernorOwner" };
};

const getArgsSov3686 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();
    const vestingRegistryDeployment = await get("VestingRegistry");
    const liquidityMiningDeployment = await get("LiquidityMining");

    const newVestingRegistryImplDeployment = await get("VestingRegistry_Implementation");
    const newLiquidityMiningImplDeployment = await get("LiquidityMining_Implementation");
    const multisigDeployment = await get("MultiSigWallet");

    const vestingRegistry = await ethers.getContract("VestingRegistry");
    const liquidityMining = await ethers.getContract("LiquidityMining");

    if (
        (await vestingRegistry.getImplementation()) ==
        newVestingRegistryImplDeployment.implementation
    ) {
        throw new Error(`New VestingRegistry impl is the same with the current one`);
    }

    if (
        (await liquidityMining.getImplementation()) ==
        newLiquidityMiningImplDeployment.implementation
    ) {
        throw new Error(`New LiquidityMining impl is the same with the current one`);
    }

    const args = {
        targets: [
            vestingRegistryDeployment.address,
            liquidityMiningDeployment.address,
            vestingRegistryDeployment.address,
            liquidityMiningDeployment.address,
        ],
        values: [0, 0, 0, 0],
        signatures: [
            "setImplementation(address)",
            "setImplementation(address)",
            "setAdminManager(address)",
            "setAdminManager(address)",
        ],
        data: [
            abiCoder.encode(["address"], [newVestingRegistryImplDeployment.address]),
            abiCoder.encode(["address"], [newLiquidityMiningImplDeployment.address]),
            abiCoder.encode(["address"], [multisigDeployment.address]),
            abiCoder.encode(["address"], [multisigDeployment.address]),
        ],
        /** @todo change SIP description */
        description: "SIP-Sov3686: xxx",
    };

    return { args, governor: "GovernorOwner" };
};

module.exports = {
    sampleGovernorAdminSIP,
    sampleGovernorOwnerSIP,
    getArgsSip0047,
    getArgsSip0058,
    getArgsSip0049,
    getArgsSip0063,
    getArgsSip0065,
    getArgsSip0046Part1,
    getArgsSip0046Part2,
    getArgsSip0046Part3,
    getArgsSip0046Part4,
    getArgsSip0073,
    getArgsSov3686,
};
