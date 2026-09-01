const { HardhatRuntimeEnvironment } = require("hardhat/types");
const {
    getStakingModulesNames,
    getProtocolModules,
} = require("../../../../deployment/helpers/helpers");
const { validateAmmOnchainAddresses, getAmmOracleAddress } = require("../../../helpers");
const {
    CURRENT_AT_DRAFT: IDOC_CURVE_CURRENT_AT_DRAFT,
    PROPOSED: IDOC_CURVE_PROPOSED,
    CURVE_KEYS: IDOC_CURVE_KEYS,
    SET_DEMAND_CURVE_SIGNATURE,
} = require("./idocCurveParams");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const col = require("cli-color");

const BPRO_MAINNET_ADDRESS = "0x440cd83c160de5c96ddb20246815ea44c7abbca8";

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

const getArgsSip0078 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (![30, 31, 31337].includes(chainId)) {
        throw new Error(`sampleGovernorOwnerSIP cannot run on the network ID == ${chainId}`);
    }
    const args = {
        targets: [(await hre.deployments.get("SOV")).address],
        values: [0],
        signatures: ["name()"],
        data: ["0x"],
        description:
            "SIP-0078: Proposal for Sovryn to Launch on BOB Chain, Details: https://github.com/DistributedCollective/SIPS/blob/6de9960/SIP-0078.md, sha256: c49f1e4092e072e3b0f3da174dc3e5c839187a00389785421b57b039b4081a10",
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

const getArgsSipSov625 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();
    const staking = await get("Staking");
    const stakingAddress = staking.address;
    const vestingLogicDeployment = await get("VestingLogic");
    const vestingRegistryDeployment = await get("VestingRegistry");
    const vestingFactoryDeployment = await get("VestingFactory");

    const args = {
        targets: [vestingRegistryDeployment.address, stakingAddress],
        values: [0, 0],
        signatures: ["setVestingFactory(address)", "addContractCodeHash(address)"],
        data: [
            abiCoder.encode(["address"], [vestingFactoryDeployment.address]),
            abiCoder.encode(["address"], [vestingLogicDeployment.address]),
        ],
        /** @todo change SIP description */
        description:
            "SIP-Sov625: Set vestingFactory in vestingRegistry & Add vestingLogic contract code hash to staking contract",
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
const getArgsSip_SOV_3161 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();
    const protocol = await ethers.getContract("ISovryn");
    const loanOpeningsModule = await get("LoanOpenings");

    //validate
    if (!network.tags.mainnet) {
        logger.error("Unknown network");
        process.exit(1);
    }

    if (
        (await protocol.getTarget("setDelegatedManager(bytes32,address,bool)")) ==
        loanOpeningsModule.address
    ) {
        logger.error("LoanOpenings module deployment already registered in the protocol");
        process.exit(1);
    }

    const args = {
        targets: [protocol.address],
        values: [0],
        signatures: ["replaceContract(address)"],
        data: [abiCoder.encode(["address"], [loanOpeningsModule.address])],
        description:
            "SIP-XXXX: _______________, Details: https://github.com/DistributedCollective/SIPS/blob/_______/________.md, sha256: ____________",
    };
    return { args, governor: "GovernorOwner" };
};

const getArgsSip0074 = async (hre) => {
    // Electron release
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();

    /** SOV3161 */
    const protocol = await ethers.getContract("ISovryn");
    const loanOpeningsModule = await get("LoanOpenings");

    /** SOV625 */
    const staking = await get("Staking");
    const stakingAddress = staking.address;
    const vestingLogicDeployment = await get("VestingLogic");
    const vestingRegistryDeployment = await get("VestingRegistry");
    const vestingFactoryDeployment = await get("VestingFactory");

    /** SOV3564 Zero */
    const newStabilityPoolImplementation = await get("StabilityPool_Implementation");
    const newBorrowerOperationsImplementation = await get("BorrowerOperations_Implementation");
    const newTroveManagerImplementation = await get("TroveManager_Implementation");
    const newTroveManagerRedeemOps = await get("TroveManagerRedeemOps");

    const stabilityPoolProxy = await get("StabilityPool_Proxy");
    const borrowerOperationsProxy = await get("BorrowerOperations_Proxy");
    const troveManagerProxy = await get("TroveManager_Proxy");

    /** SOV3564 Mynt */
    const myntAdminProxy = await get("MyntAdminProxy");

    const mocIntegrationProxy = await get("MocIntegration"); // MocIntegration
    const newMocIntegrationImpl = await get("MocIntegration_Implementation");

    //validate
    if (!network.tags.mainnet) {
        logger.error("Unknown network");
        process.exit(1);
    }

    if (
        (await protocol.getTarget("setDelegatedManager(bytes32,address,bool)")) ==
        loanOpeningsModule.address
    ) {
        logger.error("LoanOpenings module deployment already registered in the protocol");
        process.exit(1);
    }

    const args = {
        targets: [
            protocol.address,
            vestingRegistryDeployment.address,
            stakingAddress,
            stabilityPoolProxy.address,
            borrowerOperationsProxy.address,
            troveManagerProxy.address,
            troveManagerProxy.address,
            myntAdminProxy.address,
        ],
        values: [0, 0, 0, 0, 0, 0, 0, 0],
        signatures: [
            "replaceContract(address)",
            "setVestingFactory(address)",
            "addContractCodeHash(address)",
            "setImplementation(address)",
            "setImplementation(address)",
            "setImplementation(address)",
            "setTroveManagerRedeemOps(address)",
            "upgrade(address,address)",
        ],
        data: [
            abiCoder.encode(["address"], [loanOpeningsModule.address]),
            abiCoder.encode(["address"], [vestingFactoryDeployment.address]),
            abiCoder.encode(["address"], [vestingLogicDeployment.address]),
            abiCoder.encode(["address"], [newStabilityPoolImplementation.address]),
            abiCoder.encode(["address"], [newBorrowerOperationsImplementation.address]),
            abiCoder.encode(["address"], [newTroveManagerImplementation.address]),
            abiCoder.encode(["address"], [newTroveManagerRedeemOps.address]),
            abiCoder.encode(
                ["address", "address"],
                [mocIntegrationProxy.address, newMocIntegrationImpl.address]
            ),
        ],
        // @todo updatee sip description
        description:
            "SIP-0074: Smart Contracts Upgrade Electron, Details: https://github.com/DistributedCollective/SIPS/blob/a86ac0e/SIP-0074.md, sha256: c595e86f84b392ca38c027b911631eba0cbe212871b66425005647a22381313a",
    };
    return { args, governor: "GovernorOwner" };
};

const getArgsSip0076 = async (hre) => {
    // Electron release
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();

    const adoptionFundDeployment = await get("AdoptionFund");
    const devFundDeployment = await get("DevelopmentFund");
    const sovTokenDeployment = await get("SOV");
    const multisigDeployment = await get("MultiSigWallet");

    //validate
    if (!network.tags.mainnet) {
        logger.error("Unknown network");
        process.exit(1);
    }

    const args = {
        targets: [
            adoptionFundDeployment.address,
            devFundDeployment.address,
            sovTokenDeployment.address,
        ],
        values: [0, 0, 0],
        signatures: [
            "withdrawTokensByUnlockedTokenOwner(uint256)",
            "withdrawTokensByUnlockedTokenOwner(uint256)",
            "transfer(address,uint256)",
        ],
        data: [
            abiCoder.encode(["uint256"], [ethers.utils.parseEther("7475000")]),
            abiCoder.encode(["uint256"], [ethers.utils.parseEther("1650500")]),
            abiCoder.encode(
                ["address", "uint256"],
                [multisigDeployment.address, ethers.utils.parseEther("9125500")]
            ),
        ],
        description:
            "SIP-0076: Transfer of SOV from Adoption and Development Funds to Exchequer, Details: https://github.com/DistributedCollective/SIPS/blob/201f0591ee2a75bacc48b5e0e71662a1a5c06192/SIP-0076.md, sha256: aab2ec1108f4719207c2c69e47bf6d4a67ac66ff28afe6ae97d9831616edb18d",
    };
    return { args, governor: "GovernorOwner" };
};

const getArgsSip0079 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();

    const adoptionFundDeployment = await get("AdoptionFund");
    const sovTokenDeployment = await get("SOV");
    const multisigDeployment = await get("MultiSigWallet");

    //validate
    if (!network.tags.mainnet) {
        logger.error("Unknown network");
        process.exit(1);
    }

    const adoptionFund = await ethers.getContract("AdoptionFund");
    const sovToken = await ethers.getContract("SOV");
    const adoptionFundOwner = await adoptionFund.lockedTokenOwner();
    const sovTokenOwner = await sovToken.owner();

    const args = {
        targets: [adoptionFundDeployment.address, sovTokenDeployment.address],
        targetOwnerValidationAddresses: [adoptionFundOwner, sovTokenOwner],
        values: [0, 0],
        signatures: ["withdrawTokensByUnlockedTokenOwner(uint256)", "transfer(address,uint256)"],
        data: [
            abiCoder.encode(["uint256"], [ethers.utils.parseEther("13800000")]),
            abiCoder.encode(
                ["address", "uint256"],
                [multisigDeployment.address, ethers.utils.parseEther("13800000")]
            ),
        ],
        description:
            "SIP-0079: Transfer of SOV from Adoption Fund to Build on Bitcoin Mainnet, Details: https://github.com/DistributedCollective/SIPS/blob/dbb02e3/SIP-0079.md, sha256: a6b8125b25258ca75564df3ce3d470951e8aa8929edee0991bc2f43b3cba9764",
    };
    return { args, governor: "GovernorOwner" };
};

const getArgsSIP0077 = async (hre) => {
    const {
        ethers,
        deployments: { get, log },
    } = hre;

    const args = {
        targets: [(await get("SOV")).address],
        values: [0],
        signatures: ["symbol()"],
        data: ["0x"],
        description:
            "SIP-0077: Enhancement of Staking Rewards and Governance Mechanisms in Anticipation of BitcoinOS, Details: https://github.com/DistributedCollective/SIPS/blob/8cb4f72/SIP-0077.md, sha256: f7d785c2b5c6bd6135eeef07ea00a1111bc08b356f20c501ca470f2896f03ee1",
    };
    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0084Part1 = async (hre) => {
    const {
        ethers,
        deployments: { get, log },
    } = hre;

    const abiCoder = new ethers.utils.AbiCoder();
    const priceFeeds = await ethers.getContract("PriceFeeds");
    const priceFeedsOwner = await priceFeeds.owner();

    const wrbtcAddress = (await get("WRBTC")).address;
    const priceFeedMocAddress = (await get("PriceFeedsMoC")).address;

    const currentWrbtcPriceFeed = await priceFeeds.pricesFeeds(wrbtcAddress);
    if (currentWrbtcPriceFeed.toLowerCase() === priceFeedMocAddress.toLowerCase()) {
        throw new Error(
            `new wrbtc priceFeed ${priceFeedMocAddress} could not be the same with the current one ${currentWrbtcPriceFeed}`
        );
    }

    const args = {
        targets: [priceFeeds.address],
        targetOwnerValidationAddresses: [priceFeedsOwner],
        values: [0],
        signatures: ["setPriceFeed(address[],address[])"],
        data: [
            abiCoder.encode(["address[]", "address[]"], [[wrbtcAddress], [priceFeedMocAddress]]),
        ],
        description:
            // @todo update description
            "SIP-0084: Deactivate Fallback Price Oracle Contract (Part 1), Details: https://github.com/DistributedCollective/SIPS/blob/9cab4ef/SIP-0084_part-1.md, sha256: 1904484df674f8c09090768f051f9aeb722ddd3ab68759e1022cf34b9eca97f1",
    };
    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0084Part2 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();

    const zeroPriceFeed = await ethers.getContract("ZeroPriceFeed");
    const zeroPriceFeedImplementation = await ethers.getContract("ZeroPriceFeed_Implementation"); // @todo update the address in the deployment file

    const currentZeroPriceFeedImplementation = await zeroPriceFeed.getImplementation();
    if (
        currentZeroPriceFeedImplementation.toLowerCase() ===
        zeroPriceFeedImplementation.address.toLowerCase()
    ) {
        throw new Error(
            `new zero priceFeed implementation ${zeroPriceFeedImplementation.address} could not be the same with the current one ${currentZeroPriceFeedImplementation}`
        );
    }

    const fallbackOracle = await get("FallbackOracle");

    const args = {
        targets: [zeroPriceFeed.address, zeroPriceFeed.address],
        targetOwnerValidationAddresses: [
            await zeroPriceFeed.getOwner(),
            await zeroPriceFeed.getOwner(),
        ],
        values: [0, 0],
        signatures: ["setImplementation(address)", "setAddress(uint8,address)"],
        data: [
            abiCoder.encode(["address"], [zeroPriceFeedImplementation.address]),
            abiCoder.encode(["uint8", "address"], [1, fallbackOracle.address]),
        ],
        description:
            "SIP-0084: Deactivate Fallback Price Oracle Contract (Part 2), Details: https://github.com/DistributedCollective/SIPS/blob/03a8a3e/SIP-0084_part-2.md, sha256: dc23cdcd178e4d2ff49c00ab0b39a5bcf11af8e9ca5800539a5d9f0fcd3bf902",
    };

    return { args, governor: "GovernorOwner" };
};

const getArgsSip0087 = async (hre) => {
    // SOV-5158 Fix Liquidation Blocking Vulnerability
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();

    const protocol = await ethers.getContract("ISovryn");
    const modulesList = getProtocolModules();
    const loanClosingsLiquidationModule = await get(
        modulesList.LoanClosingsLiquidation.moduleName
    );
    const loanClosingsRolloverModule = await get(modulesList.LoanClosingsRollover.moduleName);
    const loanClosingsWithModule = await get(modulesList.LoanClosingsWith.moduleName);
    const protocolOwner = await protocol.owner();

    //validate
    if (!network.tags.mainnet) {
        logger.error("Unknown network");
        process.exit(1);
    }

    if (
        (await protocol.getTarget(modulesList.LoanClosingsLiquidation.sampleFunction)) ==
        loanClosingsLiquidationModule.address
    ) {
        logger.error(
            "LoanClosingsLiquidation module deployment already registered in the protocol"
        );
        process.exit(1);
    }

    if (
        (await protocol.getTarget(modulesList.LoanClosingsRollover.sampleFunction)) ==
        loanClosingsRolloverModule.address
    ) {
        logger.error("LoanClosingsRollover module deployment already registered in the protocol");
        process.exit(1);
    }

    if (
        (await protocol.getTarget(modulesList.LoanClosingsWith.sampleFunction)) ==
        loanClosingsWithModule.address
    ) {
        logger.error("LoanClosingsWith module deployment already registered in the protocol");
        process.exit(1);
    }

    const args = {
        targets: [protocol.address, protocol.address, protocol.address],
        targetOwnerValidationAddresses: [protocolOwner, protocolOwner, protocolOwner],
        values: [0, 0, 0],
        signatures: [
            "replaceContract(address)",
            "replaceContract(address)",
            "replaceContract(address)",
        ],
        data: [
            abiCoder.encode(["address"], [loanClosingsLiquidationModule.address]),
            abiCoder.encode(["address"], [loanClosingsRolloverModule.address]),
            abiCoder.encode(["address"], [loanClosingsWithModule.address]),
        ],
        description:
            "SIP-0087 : Lending pools contract hardening against liquidation circumvention via refund reverts, Details: https://github.com/DistributedCollective/SIPS/blob/04ad90b/SIP-0087.md, sha256: a32b2fc1c3855bd3caa4f045b2e2c512c5fdc04fa184a052ef933315df80b28e",
    };
    return { args, governor: "GovernorOwner" };
};

const getArgsSip0089 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (![30, 31, 31337].includes(chainId)) {
        throw new Error(`sampleGovernorOwnerSIP cannot run on the network ID == ${chainId}`);
    }
    const args = {
        targets: [(await hre.deployments.get("SOV")).address],
        values: [0],
        signatures: ["name()"],
        data: ["0x"],
        description:
            "SIP-0089: Ratification of Temporary Revenue Redirection to Exchequer, Details: https://github.com/DistributedCollective/SIPS/blob/e595d37/SIP-0089.md, sha256: 486a09c19296dd82b120993c8eca952b5b499808715133c889d96af7d612997b",
    };

    return { args, governor: "GovernorAdmin" };
};

/**
 * iDOC demand-curve adjustment.
 *
 * Calls setDemandCurve on the iDOC LoanToken proxy with the proposed values:
 *   baseRate              6e18  -> 2e18    ( 6% ->  2% APR floor)
 *   rateMultiplier       15e18  -> 10e18   (15% -> 10% slope below kink)
 *   lowUtilBaseRate       6e18  -> 2e18    (mirror)
 *   lowUtilRateMultiplier 15e18 -> 10e18   (mirror)
 *   targetLevel               0 ->     0   (unchanged; low-util branch disabled)
 *   kinkLevel            75e18  -> 90e18   (75% -> 90% utilisation)
 *   maxScaleRate        150e18  -> 30e18   (150% -> 30% APR cap @ 100% util)
 *
 * Goal: bring mid-range borrow APR closer to Tropykus's cDOC pool while
 * retaining a real high-utilisation deterrent and reducing margin-position
 * upfront interest reservation from ~11.5% to ~2.3% of principal.
 *
 * Governor: GovernorAdmin — setDemandCurve is gated by onlyAdmin
 * (isOwner() || msg.sender == admin); iDOC.admin() == TimelockAdmin which is
 * the timelock backing GovernorAdmin. GovernorOwner would also be viable via
 * the isOwner() branch but the admin route matches the operational nature of
 * a parameter tweak.
 */
const getArgsSipIDocDemandCurve = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (![30, 31, 31337].includes(chainId)) {
        throw new Error(`getArgsSipIDocDemandCurve cannot run on network ID ${chainId}`);
    }

    const iDOCDeployment = await get("LoanToken_iDOC");
    const iDOCAddress = iDOCDeployment.address;

    const iDOC = await ethers.getContractAt(
        [
            "function admin() view returns (address)",
            "function baseRate() view returns (uint256)",
            "function rateMultiplier() view returns (uint256)",
            "function lowUtilBaseRate() view returns (uint256)",
            "function lowUtilRateMultiplier() view returns (uint256)",
            "function targetLevel() view returns (uint256)",
            "function kinkLevel() view returns (uint256)",
            "function maxScaleRate() view returns (uint256)",
        ],
        iDOCAddress
    );
    const iDOCAdmin = await iDOC.admin();

    const fmt = (x) => `${ethers.utils.formatEther(x)} (raw ${x.toString()})`;
    logger.info(`iDOC address:               ${iDOCAddress}`);
    logger.info(`iDOC admin (= timelock):    ${iDOCAdmin}`);

    const observed = {
        baseRate: await iDOC.baseRate(),
        rateMultiplier: await iDOC.rateMultiplier(),
        lowUtilBaseRate: await iDOC.lowUtilBaseRate(),
        lowUtilRateMultiplier: await iDOC.lowUtilRateMultiplier(),
        targetLevel: await iDOC.targetLevel(),
        kinkLevel: await iDOC.kinkLevel(),
        maxScaleRate: await iDOC.maxScaleRate(),
    };
    for (const [k, v] of Object.entries(observed)) {
        logger.info(`current ${k.padEnd(22)}${fmt(v)}`);
    }

    // Baseline guard: the proposal description claims a specific before/after
    // delta (baseRate 6 -> 2, kinkLevel 75 -> 90, etc.). setDemandCurve
    // overwrites all 7 params, so if mainnet has drifted from the documented
    // baseline (e.g. an interim SIP has already moved the curve), submitting
    // this proposal would silently clobber unexpected values while the
    // description remains misleading. Hard-fail on mainnet to force a
    // re-review of the description and ./idocCurveParams.js before resubmission.
    // On testnet/fork (chainId 31 or 31337) the curve can legitimately
    // diverge — just log and continue.
    if (chainId === 30) {
        for (const k of IDOC_CURVE_KEYS) {
            if (!observed[k].eq(IDOC_CURVE_CURRENT_AT_DRAFT[k])) {
                throw new Error(
                    `iDOC ${k} baseline drift: observed ${observed[k].toString()}, ` +
                        `expected ${IDOC_CURVE_CURRENT_AT_DRAFT[k].toString()}. Aborting to ` +
                        `prevent silently overwriting unexpected mainnet state. If an interim ` +
                        `SIP has moved the curve, update ./idocCurveParams.js AND the before/` +
                        `after tables in SIP-0092.md before resubmitting.`
                );
            }
        }
        logger.info(`baseline check OK — all 7 params match CURRENT_AT_DRAFT`);
    } else {
        for (const k of IDOC_CURVE_KEYS) {
            if (!observed[k].eq(IDOC_CURVE_CURRENT_AT_DRAFT[k])) {
                logger.warn(
                    `[non-mainnet] iDOC ${k} differs from mainnet draft baseline ` +
                        `(observed ${observed[k].toString()}, baseline ${IDOC_CURVE_CURRENT_AT_DRAFT[
                            k
                        ].toString()})`
                );
            }
        }
    }

    // Proposed values come from the shared single-source module so they cannot
    // drift from the on-chain test's expectations. Storage convention: 100% ==
    // 10^20, so e.g. 2e18 == 2%.
    const abiCoder = new ethers.utils.AbiCoder();

    const args = {
        targets: [iDOCAddress],
        targetOwnerValidationAddresses: [iDOCAdmin],
        values: [0],
        signatures: [SET_DEMAND_CURVE_SIGNATURE],
        data: [
            abiCoder.encode(
                IDOC_CURVE_KEYS.map(() => "uint256"),
                IDOC_CURVE_KEYS.map((k) => IDOC_CURVE_PROPOSED[k])
            ),
        ],
        description:
            "SIP-0092: iDOC Demand-Curve Adjustment. " +
            "baseRate 6%->2%, rateMultiplier 15%->10%, lowUtil mirrors, " +
            "kinkLevel 75%->90%, maxScaleRate 150%->30%. " +
            "Goal: reduce mid-range borrow APR to be competitive with Tropykus " +
            "while retaining a meaningful high-utilisation deterrent. " +
            "Details: https://github.com/DistributedCollective/SIPS/blob/10166c2/SIP-0092.md, " +
            "sha256: add9aa009b53eedb05deb61c886ca220c0daa48f8b6be26e743f5aa7e9969540",
    };

    return { args, governor: "GovernorAdmin" };
};

/**
 * Disable SOV and BPro as collateral for active Torque and margin loan params.
 *
 * The loan-token settings wrapper reverts if it receives an absent local
 * loanParamsIds entry. Build every action from live state so already-disabled
 * pools/modes, such as iUSDT or iBPRO/BPro, are skipped instead of making the
 * proposal unexecutable.
 */
const getArgsSip0093 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (![30, 31337].includes(chainId)) {
        throw new Error(`getArgsSip0093 cannot run on network ID ${chainId}`);
    }

    const abiCoder = new ethers.utils.AbiCoder();
    const sovAddress = (await get("SOV")).address;
    const bproAddress = ethers.utils.getAddress(BPRO_MAINNET_ADDRESS);
    const collaterals = [
        { symbol: "SOV", address: sovAddress },
        { symbol: "BPro", address: bproAddress },
    ];
    const loanTokenDeploymentNames = [
        "LoanToken_iXUSD",
        "LoanToken_iRBTC",
        "LoanToken_iBPRO",
        "LoanToken_iDOC",
        "LoanToken_iDLLR",
        "LoanToken_iUSDT",
    ];

    const targets = [];
    const targetOwnerValidationAddresses = [];
    const values = [];
    const signatures = [];
    const data = [];

    for (const deploymentName of loanTokenDeploymentNames) {
        const loanTokenAddress = (await get(deploymentName)).address;
        const loanToken = await ethers.getContractAt(
            [
                "function admin() view returns (address)",
                "function loanParamsIds(uint256) view returns (bytes32)",
                "function sovrynContractAddress() view returns (address)",
            ],
            loanTokenAddress
        );
        const sovryn = await ethers.getContractAt(
            [
                "function getLoanParams(bytes32[]) view returns (tuple(bytes32 id,bool active,address owner,address loanToken,address collateralToken,uint256 minInitialMargin,uint256 maintenanceMargin,uint256 maxLoanTerm)[])",
            ],
            await loanToken.sovrynContractAddress()
        );

        const collateralTokensToDisable = [];
        const torqueFlagsToDisable = [];
        const activePairs = [];

        for (const collateral of collaterals) {
            for (const isTorqueLoan of [true, false]) {
                const key = ethers.utils.solidityKeccak256(
                    ["address", "bool"],
                    [collateral.address, isTorqueLoan]
                );
                const loanParamsId = await loanToken.loanParamsIds(key);
                if (loanParamsId === ethers.constants.HashZero) {
                    logger.info(
                        `${deploymentName}: ${collateral.symbol} ${
                            isTorqueLoan ? "Torque" : "Margin"
                        } already disabled`
                    );
                    continue;
                }

                const [loanParams] = await sovryn.getLoanParams([loanParamsId]);
                if (
                    !loanParams ||
                    loanParams.id === ethers.constants.HashZero ||
                    !loanParams.active
                ) {
                    logger.info(
                        `${deploymentName}: ${collateral.symbol} ${
                            isTorqueLoan ? "Torque" : "Margin"
                        } inactive on protocol`
                    );
                    continue;
                }

                collateralTokensToDisable.push(collateral.address);
                torqueFlagsToDisable.push(isTorqueLoan);
                activePairs.push(`${collateral.symbol}:${isTorqueLoan ? "Torque" : "Margin"}`);
            }
        }

        if (collateralTokensToDisable.length === 0) {
            continue;
        }

        const loanTokenAdmin = await loanToken.admin();
        targets.push(loanTokenAddress);
        targetOwnerValidationAddresses.push(loanTokenAdmin);
        values.push(0);
        signatures.push("disableLoanParams(address[],bool[])");
        data.push(
            abiCoder.encode(
                ["address[]", "bool[]"],
                [collateralTokensToDisable, torqueFlagsToDisable]
            )
        );

        logger.info(`${deploymentName}: disabling ${activePairs.join(", ")}`);
    }

    if (targets.length === 0) {
        throw new Error("getArgsSip0093 found no active SOV/BPro collateral loan params");
    }

    const args = {
        targets,
        targetOwnerValidationAddresses,
        values,
        signatures,
        data,
        description:
            "SIP-0093: Disable SOV and BPro as Lending-Pool Collateral. " +
            "Disables active SOV and BPro loan params for borrowing and " +
            "margin trading while leaving existing positions, repayment, " +
            "liquidation, collateral maintenance, price feeds, and swap support intact. " +
            "Details: https://github.com/DistributedCollective/SIPS/blob/0d82c3a/SIP-0093.md, " +
            "sha256: 359b8978cb3b1a8a16041aac989e7f38518327a121ea7bc7f8f6ea8c022241fb",
    };

    return { args, governor: "GovernorAdmin" };
};

/**
 * Perimeter Fee — optional runtime-bytecode identity pin (review finding F-9). When the
 * operator exports `<envVar>_CODEHASH`, assert keccak256(code at address) equals
 * it, so a wrong/stale address that merely HAS code (isAddress + getCode both
 * pass) is still rejected before it enters the proposal. When unset this is a
 * no-op and the CP-C calldata decode + human diff remains the authentication
 * gate. Fork rehearsals deploy fresh fixtures with unknown hashes and never set
 * the env, so they are unaffected.
 */
const assertPerimeterCodehash = async (hre, address, envVar, label) => {
    const expected = process.env[`${envVar}_CODEHASH`];
    if (!expected) return;
    const actual = hre.ethers.utils.keccak256(await hre.ethers.provider.getCode(address));
    if (actual.toLowerCase() !== expected.toLowerCase()) {
        throw new Error(
            `Perimeter Fee: ${label} at ${address} has runtime codehash ${actual}, expected ` +
                `${expected} (${envVar}_CODEHASH) — the resolved contract is not the audited build.`
        );
    }
};

/**
 * Perimeter Fee — refuse to build a proposal whose description still carries placeholder
 * SIP metadata (review finding F-10). On real mainnet the SIP number, SIPS-repo
 * link and sha256 (prerequisite P5) must be filled before creation, else voters
 * cannot bind the calldata to an approved document. Fork rehearsals carry the
 * `forked` tag and keep the placeholders — they are exempt.
 */
const assertDescriptionFinalized = (description) => {
    if (network.tags.mainnet && !network.tags.forked && /SIP-XXXX|_{4,}/.test(description)) {
        throw new Error(
            "Perimeter Fee: SIP description still contains placeholder metadata (SIP-XXXX / SIPS " +
                "link / sha256). Fill prerequisite P5 before creating the proposal on mainnet."
        );
    }
};

/**
 * Perimeter Phase 1 — shared input resolution.
 *
 * The ExitFeeController (and ExitFeeVault behind it) are deployed from the
 * `perimeter` repo (Foundry, 0.8.20, Perimeter-Safe-owned) — their addresses are
 * INPUTS to these SIPs, not deployments of this repo. Resolution order:
 *   1. a hardhat-deploy record named "ExitFeeController" (the fork tests save
 *      one after deploying the stack in their setup);
 *   2. the PERIMETER_EXIT_FEE_CONTROLLER env var (mainnet SIP creation).
 * Anything else throws — a SIP must never be proposed with a zero/garbage
 * controller pointer.
 */
const resolveExitFeeControllerAddress = async (hre) => {
    const { ethers, deployments } = hre;
    const record = await deployments.getOrNull("ExitFeeController");
    const envAddress = process.env.PERIMETER_EXIT_FEE_CONTROLLER;
    // F-8c: a stale record must never silently shadow the address the operator
    // exported. If both exist and disagree, fail — do not pick one silently.
    if (record && envAddress && record.address.toLowerCase() !== envAddress.toLowerCase()) {
        throw new Error(
            `Perimeter Fee: ExitFeeController record (${record.address}) and ` +
                `PERIMETER_EXIT_FEE_CONTROLLER (${envAddress}) disagree. Remove one — a stale ` +
                "'ExitFeeController' record must not override the address you exported."
        );
    }
    const address = record ? record.address : envAddress;
    if (!address || !ethers.utils.isAddress(address)) {
        throw new Error(
            "Perimeter Fee: ExitFeeController address unresolved. Save an 'ExitFeeController' " +
                "deployment record or set PERIMETER_EXIT_FEE_CONTROLLER=<address>. The controller " +
                "is deployed from the perimeter repo (see its UPGRADEABILITY.md §A) — it is an " +
                "input to this SIP, not a deployment of this repo."
        );
    }
    if ((await ethers.provider.getCode(address)) === "0x") {
        throw new Error(`Perimeter Fee: no contract code at ExitFeeController address ${address}`);
    }
    await assertPerimeterCodehash(
        hre,
        address,
        "PERIMETER_EXIT_FEE_CONTROLLER",
        "ExitFeeController"
    );
    return address;
};

/**
 * SIP-0094 — Perimeter Fee activation (phase 1 of the Sovryn security perimeter) — aggregated BY OWNERSHIP, not by
 * product: every target of the activation (both LoanTokenLogicBeacons, the
 * sovrynProtocol proxy AND Zero's BorrowerOperations UpgradableProxy) is
 * live-owned by TimelockOwner, so the whole activation is ONE GovernorOwner
 * bucket. The activation alone holds 11 mainnet actions — over GovernorAlpha's
 * proposalMaxOperations() == 10 — so it ships as Part 1/Part 2 on the SAME
 * governor (precedent: SIP-0046 Part1–4, SIP-0084 Part1–2). SIP-0094's treasury
 * leg (2 more actions, see the Part 2 header) rides in Part 2's spare capacity,
 * making the TimelockOwner bundle 13 actions across the two owner-governor
 * parts. The cut
 * keeps the invariants:
 *   - the §8 HARD precondition stays atomic in Part 1: CollSurplusPool's
 *     first-ever setImplementation lands in the SAME tx as the BO swap,
 *     ordered first, strictly before any Safe surface activation;
 *   - the Zero swap+wire pair is atomic: BO's setImplementation and its
 *     setExitFeeController are actions 9 and 10 of the SAME Part-1 tx, so
 *     the hooked implementation is never live with an unset controller;
 *   - CF-1 holds across the parts: the borrower-exit charge hook is pinned in
 *     Part 1, and the protocol controller pointer — the last switch that lets
 *     any lending surface quote a fee — is the FINAL governance action
 *     (Part 2, last index). No ordering can produce a live controller with an
 *     unset hook. Part 2 also carries the SIP's treasury leg (the two fund
 *     sweeps), placed BEFORE the pin so the pin keeps that final position.
 *
 * Part 1 (GovernorOwner / TimelockOwner, 10 actions — at the cap — atomic):
 *   1.  LoanTokenLogicBeaconLM.registerLoanTokenModule(new LoanTokenLogicLM)
 *   2.  LoanTokenLogicBeaconWrbtc.registerLoanTokenModule(new LoanTokenLogicWrbtcLM)
 *   3.  sovrynProtocol.replaceContract(new LoanClosingsRollover)
 *   4.  sovrynProtocol.replaceContract(new LoanClosingsWith)
 *   5.  sovrynProtocol.replaceContract(new LoanMaintenance)
 *   6.  sovrynProtocol.replaceContract(ExitFeeModule) — must precede 7: its
 *       initialize() registers the exitFeeController/borrowerExitPerimeterOps
 *       selectors on the protocol proxy
 *   7.  sovrynProtocol.setBorrowerExitPerimeterOps(BorrowerExitPerimeterOps)
 *   8.  CollSurplusPool_Proxy.setImplementation(new CollSurplusPool) — the
 *       FIRST-EVER upgrade of that proxy (surplus-claim fee leg, runbook §8);
 *       deliberately BEFORE 9, and there is NO in-code fallback around the
 *       pool call — pool-side failures stay loud
 *   9.  BorrowerOperations_Proxy.setImplementation(new hooked BorrowerOperations)
 *   10. BorrowerOperations(proxy).setExitFeeController(<ExitFeeController>) —
 *       MUST follow 9: the setter exists only on the implementation 9 installs
 *
 * LoanClosingsLiquidation is NOT replaced. Its source is unchanged in this
 * release and it calls no changed shared function, so its runtime bytecode
 * (metadata trailer stripped) is byte-identical to the module already
 * registered on mainnet — replacing it would burn a scarce action slot to
 * install the same code at a new address. Only modules whose observable
 * behavior changes are re-registered; inherited-bytecode drift is not a
 * reason. LoanClosingsShared is an inherited base, not a registered module —
 * its changes ship inside the two closings modules that actually call the
 * changed code. Module deployments come from
 * deployment/deploy/2070 (protocol modules) and 2061 (BorrowerExitPerimeterOps);
 * beacon module deployments from 2000; the hooked BorrowerOperations and the
 * new CollSurplusPool are built in zero-contracts (branch
 * sovryn-perimeter-fee) and resolve from "BorrowerOperations_Implementation" /
 * "CollSurplusPool_Implementation" records or PERIMETER_ZERO_BORROWER_OPERATIONS /
 * PERIMETER_ZERO_COLL_SURPLUS_POOL. The existing
 * "BorrowerOperations_Implementation" record deliberately stays untouched —
 * it pins the pre-Perimeter implementation, i.e. the rollback target (the pool
 * proxy has NO prior implementation record at all — first-ever upgrade;
 * rollback corollary: deactivate the surplus surface before any pool
 * rollback).
 * Enablement (setExitFeeEnabled(true)) is NOT an action in either part: the
 * controller is Perimeter-Safe-owned, so governance cannot call it — the
 * ship-disabled build is enabled by a Safe transaction after both parts.
 */
const getArgsSip0094Part1 = async (hre) => {
    const {
        ethers,
        deployments: { get, getOrNull },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();

    if (!network.tags.mainnet) {
        throw new Error("getArgsSip0094Part1: run on mainnet or a mainnet fork only");
    }

    const protocol = await ethers.getContract("ISovryn");
    const protocolOwner = await protocol.owner();

    // The controller must resolve at Part-1 creation time: it is both an input
    // sanity check (fail fast on a missing/garbage input) and the argument of
    // action 10, the Zero BO controller pin.
    const exitFeeControllerAddress = await resolveExitFeeControllerAddress(hre);
    const opsDeployment = await get("BorrowerExitPerimeterOps");
    if ((await ethers.provider.getCode(opsDeployment.address)) === "0x") {
        throw new Error(
            `Perimeter Fee: no contract code at BorrowerExitPerimeterOps ${opsDeployment.address}`
        );
    }

    const targets = [];
    const values = [];
    const signatures = [];
    const datas = [];
    const targetOwnerValidationAddresses = [];

    /** 1+2. iToken beacon logic re-registration (burn hooks changed).
     *  Only the two LM modules carry the mint/burn selectors — the non-LM
     *  LoanTokenLogic / LoanTokenLogicWrbtc own no burn routes and are not
     *  re-registered. registerLoanTokenModule() reads the module's
     *  getListFunctionSignatures() and de-registers dropped selectors itself. */
    const beaconRegistrations = [
        { beaconName: "LoanTokenLogicBeaconLM", moduleName: "LoanTokenLogicLM" },
        { beaconName: "LoanTokenLogicBeaconWrbtc", moduleName: "LoanTokenLogicWrbtcLM" },
    ];
    for (const { beaconName, moduleName } of beaconRegistrations) {
        const beacon = await ethers.getContract(beaconName);
        const moduleDeployment = await get(moduleName);
        if ((await ethers.provider.getCode(moduleDeployment.address)) === "0x") {
            throw new Error(
                `Perimeter Fee: no contract code at ${moduleName} ${moduleDeployment.address}`
            );
        }
        const moduleNameBytes32 = ethers.utils.formatBytes32String(moduleName);
        const activeIndex = await beacon.activeModuleIndex(moduleNameBytes32);
        const activeModule = await beacon.moduleUpgradeLog(moduleNameBytes32, activeIndex);
        if (activeModule.implementation.toLowerCase() === moduleDeployment.address.toLowerCase()) {
            throw new Error(
                `Perimeter Fee: ${moduleName} deployment already registered in ${beaconName}`
            );
        }
        targets.push(beacon.address);
        values.push(0);
        signatures.push("registerLoanTokenModule(address)");
        datas.push(abiCoder.encode(["address"], [moduleDeployment.address]));
        targetOwnerValidationAddresses.push(await beacon.owner());
    }

    /** 3–6. Protocol module replacement (ExitFeeModule LAST — see header).
     *  LoanClosingsLiquidation is deliberately absent: unchanged source, no
     *  changed shared function on its call paths, and runtime bytecode
     *  (metadata stripped) identical to the registered module — so there is
     *  nothing to replace. */
    const modulesList = getProtocolModules();
    const replacedModules = [
        modulesList.LoanClosingsRollover,
        modulesList.LoanClosingsWith,
        modulesList.LoanMaintenance,
        modulesList.ExitFeeModule,
    ];
    for (const module of replacedModules) {
        const moduleDeployment = await get(module.moduleName);
        // F-5: replaceContract is a raw delegatecall; a delegatecall to a
        // codeless address SUCCEEDS silently, so a stale/mistyped module record
        // would no-op inside an otherwise "successful" SIP. Fail at creation.
        if ((await ethers.provider.getCode(moduleDeployment.address)) === "0x") {
            throw new Error(
                `Perimeter Fee: no contract code at ${module.moduleName} ${moduleDeployment.address}`
            );
        }
        if (
            (await protocol.getTarget(module.sampleFunction)).toLowerCase() ===
            moduleDeployment.address.toLowerCase()
        ) {
            throw new Error(
                `Perimeter Fee: ${module.moduleName} deployment already registered in the protocol`
            );
        }
        targets.push(protocol.address);
        values.push(0);
        signatures.push("replaceContract(address)");
        datas.push(abiCoder.encode(["address"], [moduleDeployment.address]));
        targetOwnerValidationAddresses.push(protocolOwner);
    }

    /** 7. Pin the borrower-exit charge hook (CF-1: pinned here, one whole SIP
     *  before the protocol controller pointer goes live in Part 2). */
    targets.push(protocol.address);
    values.push(0);
    signatures.push("setBorrowerExitPerimeterOps(address)");
    datas.push(abiCoder.encode(["address"], [opsDeployment.address]));
    targetOwnerValidationAddresses.push(protocolOwner);

    /** 8. Zero CollSurplusPool: FIRST-EVER implementation upgrade of that proxy
     *  (surplus-claim fee leg, runbook §8). Deliberately ordered BEFORE the
     *  BO swap in the same atomic tx — HARD precondition (decided 2026-07-21):
     *  there is NO in-code fallback around the pool call, so the fee-active
     *  claimCollateral path needs the pool's claimCollWithFee selector live
     *  strictly before any Safe activation of PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS;
     *  pool-side failures stay loud. */
    const poolImplRecord = await getOrNull("CollSurplusPool_Implementation");
    const poolImplEnv = process.env.PERIMETER_ZERO_COLL_SURPLUS_POOL;
    // F-8c: same record-vs-env divergence guard as the controller resolver.
    if (
        poolImplRecord &&
        poolImplEnv &&
        poolImplRecord.address.toLowerCase() !== poolImplEnv.toLowerCase()
    ) {
        throw new Error(
            `Perimeter Fee: CollSurplusPoolPerimeter record (${poolImplRecord.address}) and ` +
                `PERIMETER_ZERO_COLL_SURPLUS_POOL (${poolImplEnv}) disagree. Remove one — a stale ` +
                "record must not override the exported implementation address."
        );
    }
    const poolImplAddress = poolImplRecord ? poolImplRecord.address : poolImplEnv;
    if (!poolImplAddress || !ethers.utils.isAddress(poolImplAddress)) {
        throw new Error(
            "Perimeter Fee: new CollSurplusPool implementation unresolved. Save a " +
                "'CollSurplusPoolPerimeter' deployment record or set " +
                "PERIMETER_ZERO_COLL_SURPLUS_POOL=<address> (built from zero-contracts " +
                "branch sovryn-perimeter-fee)."
        );
    }
    if ((await ethers.provider.getCode(poolImplAddress)) === "0x") {
        throw new Error(
            `Perimeter Fee: no contract code at CollSurplusPool implementation ${poolImplAddress}`
        );
    }
    await assertPerimeterCodehash(
        hre,
        poolImplAddress,
        "PERIMETER_ZERO_COLL_SURPLUS_POOL",
        "CollSurplusPool implementation"
    );
    const collSurplusPoolProxy = await ethers.getContract("CollSurplusPool_Proxy");
    const poolProxyOwner = await collSurplusPoolProxy.getOwner();
    const poolCurrentImpl = await collSurplusPoolProxy.getImplementation();
    if (poolCurrentImpl.toLowerCase() === poolImplAddress.toLowerCase()) {
        throw new Error(
            `Perimeter Fee: CollSurplusPool proxy already points at ${poolImplAddress}`
        );
    }
    targets.push(collSurplusPoolProxy.address);
    values.push(0);
    signatures.push("setImplementation(address)");
    datas.push(abiCoder.encode(["address"], [poolImplAddress]));
    targetOwnerValidationAddresses.push(poolProxyOwner);

    /** 9. Zero BorrowerOperations implementation swap, immediately followed by
     *  its controller pin (action 10) in this same atomic tx — the setter
     *  exists only on this new implementation, so the two MUST stay in this
     *  order. Keeping them paired means the hooked BO is never live with an
     *  unset controller. */
    const newImplRecord = await getOrNull("BorrowerOperations_Implementation");
    const newImplEnv = process.env.PERIMETER_ZERO_BORROWER_OPERATIONS;
    // F-8c: same record-vs-env divergence guard as the controller resolver.
    if (
        newImplRecord &&
        newImplEnv &&
        newImplRecord.address.toLowerCase() !== newImplEnv.toLowerCase()
    ) {
        throw new Error(
            `Perimeter Fee: BorrowerOperationsPerimeter record (${newImplRecord.address}) and ` +
                `PERIMETER_ZERO_BORROWER_OPERATIONS (${newImplEnv}) disagree. Remove one — a stale ` +
                "record must not override the exported implementation address."
        );
    }
    const newImplAddress = newImplRecord ? newImplRecord.address : newImplEnv;
    if (!newImplAddress || !ethers.utils.isAddress(newImplAddress)) {
        throw new Error(
            "Perimeter Fee: hooked BorrowerOperations implementation unresolved. Save a " +
                "'BorrowerOperationsPerimeter' deployment record or set " +
                "PERIMETER_ZERO_BORROWER_OPERATIONS=<address> (built from zero-contracts " +
                "branch sovryn-perimeter-fee)."
        );
    }
    if ((await ethers.provider.getCode(newImplAddress)) === "0x") {
        throw new Error(
            `Perimeter Fee: no contract code at BorrowerOperations implementation ${newImplAddress}`
        );
    }
    await assertPerimeterCodehash(
        hre,
        newImplAddress,
        "PERIMETER_ZERO_BORROWER_OPERATIONS",
        "BorrowerOperations implementation"
    );
    const borrowerOperationsProxy = await ethers.getContract("BorrowerOperations_Proxy");
    const proxyOwner = await borrowerOperationsProxy.getOwner();
    const currentImpl = await borrowerOperationsProxy.getImplementation();
    if (currentImpl.toLowerCase() === newImplAddress.toLowerCase()) {
        throw new Error(
            `Perimeter Fee: BorrowerOperations proxy already points at ${newImplAddress}`
        );
    }
    targets.push(borrowerOperationsProxy.address);
    values.push(0);
    signatures.push("setImplementation(address)");
    datas.push(abiCoder.encode(["address"], [newImplAddress]));
    targetOwnerValidationAddresses.push(proxyOwner);

    /** 10. Zero BorrowerOperations controller pin — the other half of the swap.
     *  Ordering is load-bearing: setExitFeeController exists ONLY on the
     *  implementation action 9 installs, so this must be the action right
     *  after it. Asserted below rather than left to reading order. */
    targets.push(borrowerOperationsProxy.address);
    values.push(0);
    signatures.push("setExitFeeController(address)");
    datas.push(abiCoder.encode(["address"], [exitFeeControllerAddress]));
    targetOwnerValidationAddresses.push(proxyOwner);

    const boSwapIndex = signatures.lastIndexOf("setImplementation(address)");
    const boPinIndex = signatures.lastIndexOf("setExitFeeController(address)");
    if (
        targets[boSwapIndex].toLowerCase() !== borrowerOperationsProxy.address.toLowerCase() ||
        boPinIndex !== boSwapIndex + 1
    ) {
        throw new Error(
            "Perimeter Fee: BorrowerOperations setExitFeeController must be the action immediately " +
                "after its setImplementation — the setter only exists on the new implementation."
        );
    }
    if (targets.length !== 10) {
        throw new Error(
            `Perimeter Fee: Part 1 must hold exactly 10 actions, built ${targets.length}`
        );
    }

    const args = {
        targets: targets,
        targetOwnerValidationAddresses: targetOwnerValidationAddresses,
        values: values,
        signatures: signatures,
        data: datas,
        description:
            "SIP-0094: Perimeter Fee Activation and Adoption Fund Transfer (Part 1 of 3 — GovernorOwner)\nhttps://forum.sovryn.com/t/sip-0094-parts-1-3-perimeter-fee-activation-and-adoption-fund-transfer/3590\nInstalls the Perimeter Fee code across lending and Zero in ten atomic actions; fee charging stays globally disabled.\n---\nExecutes the 10 Perimeter Fee installation actions: registers the exit-fee-hooked LM and WrbtcLM iToken beacon modules (2), replaces the LoanClosingsRollover, LoanClosingsWith and LoanMaintenance protocol modules (3), registers the ExitFeeModule admin module (1), sets BorrowerExitPerimeterOps (1), upgrades the Zero CollSurplusPool implementation (1), then upgrades the Zero BorrowerOperations implementation and wires its exit-fee controller in the same atomic transaction (2). Fee charging stays globally disabled throughout. Details: https://github.com/DistributedCollective/SIPS/blob/340148c/SIP-0094.md, sha256: 496b69a6761f4e41d5e551f9c9f3962570beaba9e4aeb66613265c97fe09c756",
    };
    assertDescriptionFinalized(args.description);
    return { args, governor: "GovernorOwner" };
};

/**
 * SIP-0094 treasury leg — resolve ONE holding fund's fully-matured unlocked
 * balance and prove, at creation time, that the Timelock can actually withdraw
 * it in one call.
 *
 * The holding funds are `DevelopmentFund` instances. The only entry point
 * their unlocked-token owner has is `withdrawTokensByUnlockedTokenOwner(uint256)`,
 * which (a) takes an EXPLICIT amount — the contract exposes no "withdraw all"
 * variant — and (b) pays the tokens to `msg.sender`, i.e. to the Timelock, not
 * to a receiver of our choosing. That is why the sweep takes a withdrawal leg
 * plus a forwarding leg; see the Part 2 header.
 *
 * Because the amount has to be baked into the proposal calldata, it is read
 * LIVE here rather than typed as a constant, and every assumption behind it is
 * asserted instead of trusted:
 *   - the fund is Active (an Expired fund reverts on withdrawal);
 *   - it pays out the SOV token this repo deploys;
 *   - the Timelock really is its `unlockedTokenOwner` (also the address handed
 *     to the sips:create owner check);
 *   - EVERY remaining release tranche has already matured, so the whole
 *     schedule is withdrawable in a single call. Maturity is monotone in time
 *     and the Timelock delay only pushes execution later, so true-at-creation
 *     implies true-at-execution;
 *   - the schedule total equals the fund's live SOV balance, so "the remaining
 *     unlocked balance" and "the amount we withdraw" are the same number. A
 *     surplus deposit (only the locked-token owner can sweep it) or a shortfall
 *     both stop the proposal here rather than silently stranding value.
 */
const resolveMaturedFundWithdrawal = async (hre, fundName) => {
    const {
        ethers,
        deployments: { get },
    } = hre;

    const fundDeployment = await get(fundName);
    if ((await ethers.provider.getCode(fundDeployment.address)) === "0x") {
        throw new Error(`SIP-0094: no contract code at ${fundName} ${fundDeployment.address}`);
    }
    const fund = await ethers.getContract(fundName);
    const sovDeployment = await get("SOV");
    const sov = await ethers.getContract("SOV");

    const fundSov = await fund.SOV();
    if (fundSov.toLowerCase() !== sovDeployment.address.toLowerCase()) {
        throw new Error(
            `SIP-0094: ${fundName} pays out ${fundSov}, not the SOV deployment ` +
                `${sovDeployment.address} — the forwarding transfer would move the wrong token.`
        );
    }

    const STATUS_ACTIVE = 1;
    const status = await fund.status();
    if (status !== STATUS_ACTIVE) {
        throw new Error(
            `SIP-0094: ${fundName} status is ${status}, expected Active (${STATUS_ACTIVE}) — ` +
                "withdrawTokensByUnlockedTokenOwner reverts in any other state."
        );
    }

    const unlockedTokenOwner = await fund.unlockedTokenOwner();
    const releaseDuration = await fund.getReleaseDuration();
    const releaseTokenAmount = await fund.getReleaseTokenAmount();
    if (releaseDuration.length === 0 || releaseDuration.length !== releaseTokenAmount.length) {
        throw new Error(
            `SIP-0094: ${fundName} release schedule is empty or malformed ` +
                `(${releaseDuration.length} durations, ${releaseTokenAmount.length} amounts) — ` +
                "there is nothing this proposal can withdraw."
        );
    }

    const zero = ethers.BigNumber.from(0);
    const totalDuration = releaseDuration.reduce((acc, d) => acc.add(d), zero);
    const amount = releaseTokenAmount.reduce((acc, a) => acc.add(a), zero);
    const lastReleaseTime = await fund.lastReleaseTime();
    const now = ethers.BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
    if (!lastReleaseTime.add(totalDuration).lt(now)) {
        throw new Error(
            `SIP-0094: ${fundName} still has unmatured release tranches ` +
                `(last release ${lastReleaseTime}, remaining duration ${totalDuration}, now ` +
                `${now}) — a full-schedule withdrawal would revert with "No release schedule ` +
                'reached". Reduce the amount to the matured part or wait.'
        );
    }

    const balance = await sov.balanceOf(fundDeployment.address);
    if (!balance.eq(amount)) {
        throw new Error(
            `SIP-0094: ${fundName} holds ${balance.toString()} SOV but its release schedule ` +
                `totals ${amount.toString()} — refusing to build a proposal that would leave a ` +
                "residue (only the locked-token owner can move it) or overdraw the schedule."
        );
    }
    if (amount.lte(0)) {
        throw new Error(`SIP-0094: ${fundName} has no unlocked SOV left to transfer.`);
    }

    return { address: fundDeployment.address, amount, unlockedTokenOwner };
};

/**
 * SIP-0094 executable part 2 of 3 (GovernorOwner / TimelockOwner) — the
 * overflow of the single TimelockOwner bucket over GovernorAlpha's 10-action
 * cap (see the Part 1 header for the aggregation rationale), plus the SIP's
 * treasury leg.
 *
 * Actions (3):
 *   1. AdoptionFund.withdrawTokensByUnlockedTokenOwner(<remaining>)
 *   2. SOV.transfer(<Exchequer Multisig>, <exactly 1>)
 *   3. sovrynProtocol.setExitFeeController(<ExitFeeController>) — the protocol
 *      singleton (iTokens read through sovrynContractAddress; there are NO
 *      per-iToken setter calls). Deliberately the LAST governance action of
 *      the whole activation: the charge hook and every fee-aware module
 *      (Part 1) are always in place before any lending surface can resolve a
 *      controller (CF-1). Zero's own BO controller pin is NOT here — it stays
 *      paired with the BO implementation swap in Part 1's atomic tx.
 *
 * Why the Adoption Fund sweep costs TWO actions, and why the Development Fund
 * is NOT here. Both funds are `DevelopmentFund` instances, but the live
 * mainnet ownership is asymmetric:
 *   - AdoptionFund: locked AND unlocked owner are TimelockOwner;
 *   - DevelopmentFund: unlocked owner is TimelockOwner, locked owner is the
 *     Exchequer Multisig.
 * For the Adoption Fund the Timelock's only usable entry point is
 * `withdrawTokensByUnlockedTokenOwner(amount)`, which pays `msg.sender` — so
 * the sweep is withdraw-to-ITSELF then forward, the exact shape SIP-0065 and
 * SIP-0076 used. (`transferTokensByUnlockedTokenOwner()` is a trap: it pays the
 * fund's `safeVault`, which on BOTH funds is the GovernorVaultOwner and NOT the
 * Exchequer, and it expires the contract.) The amount is read live at creation
 * (see resolveMaturedFundWithdrawal) and the forwarding transfer moves exactly
 * it, so the Timelock is left holding nothing.
 *
 * The DEVELOPMENT Fund needs no governance action at all: the Exchequer
 * Multisig IS its locked-token owner, so it can call
 * `transferTokensByLockedTokenOwner(receiver)` directly — one multisig
 * transaction that pays an arbitrary receiver, needs no amount, and expires
 * (retires) the fund contract. That is the companion action disclosed in the
 * SIP-0094 post, deliberately kept off this ballot.
 *
 * The Perimeter Fee controller pin stays at the LAST index. "The final governance
 * action of the whole activation" is an invariant this file states and asserts
 * (CF-1), so the treasury leg is placed ahead of it rather than after; the two
 * legs share only atomicity, and nothing in the sweep can affect the pin.
 * Both properties are asserted below, not left to reading order.
 *
 * Execution ordering: action 3 routes through the setExitFeeController
 * selector that ExitFeeModule's initialize() registers in Part 1 — so
 * executing Part 2 before Part 1 simply reverts in the Timelock (fail-closed,
 * F-2) and can be retried after Part 1 lands (both proposals can still be
 * CREATED/voted in the same cycle; creation only warns). Because a
 * GovernorAlpha execution is one transaction, that revert is wholesale: the
 * treasury actions in front of it do NOT settle on their own.
 */
const getArgsSip0094Part2 = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const abiCoder = new ethers.utils.AbiCoder();

    if (!network.tags.mainnet) {
        throw new Error("getArgsSip0094Part2: run on mainnet or a mainnet fork only");
    }

    const protocol = await ethers.getContract("ISovryn");
    const protocolOwner = await protocol.owner();
    const exitFeeControllerAddress = await resolveExitFeeControllerAddress(hre);

    if (
        (await protocol.getTarget("setExitFeeController(address)")) ===
        ethers.constants.AddressZero
    ) {
        logger.warn(
            "Perimeter Fee: setExitFeeController selector not registered on the protocol yet — " +
                "Part 1 (ExitFeeModule registration) must EXECUTE before this proposal executes."
        );
    }

    const targets = [];
    const values = [];
    const signatures = [];
    const datas = [];
    const targetOwnerValidationAddresses = [];

    /** 1. Drain the Adoption Fund's remaining unlocked SOV to the Timelock.
     *  The amount is the live schedule total, re-read and cross-checked
     *  against the fund's balance at creation time.
     *
     *  The DEVELOPMENT Fund is deliberately NOT in this proposal (SIP-0094
     *  text, 2026-08-11): its lockedTokenOwner is the Exchequer Multisig,
     *  which can sweep-and-retire the fund directly via
     *  transferTokensByLockedTokenOwner(receiver) — a companion multisig
     *  transaction disclosed in the SIP, needing no governance action. */
    const adoptionFund = await resolveMaturedFundWithdrawal(hre, "AdoptionFund");
    targets.push(adoptionFund.address);
    values.push(0);
    signatures.push("withdrawTokensByUnlockedTokenOwner(uint256)");
    datas.push(abiCoder.encode(["uint256"], [adoptionFund.amount]));
    // The gate on this call is the UNLOCKED token owner (the Timelock), not
    // the locked one — validating the locked owner here would authenticate
    // the wrong role.
    targetOwnerValidationAddresses.push(adoptionFund.unlockedTokenOwner);

    /** 2. Forward the whole withdrawn amount to the Exchequer Multisig. The
     *  Timelock holds the tokens only for the duration of this one
     *  transaction; transferring exactly (1) leaves no dust behind. */
    const sov = await ethers.getContract("SOV");
    const sovOwner = await sov.owner();
    const exchequerDeployment = await get("MultiSigWallet");
    if ((await ethers.provider.getCode(exchequerDeployment.address)) === "0x") {
        throw new Error(
            `SIP-0094: no contract code at the Exchequer Multisig ${exchequerDeployment.address} — ` +
                "refusing to send the treasury sweep to a codeless address."
        );
    }
    const sweptTotal = adoptionFund.amount;
    targets.push(sov.address);
    values.push(0);
    signatures.push("transfer(address,uint256)");
    datas.push(abiCoder.encode(["address", "uint256"], [exchequerDeployment.address, sweptTotal]));
    // SOV.transfer needs no ownership — the Timelock only needs the balance the
    // two preceding actions give it. The token's owner IS the Timelock, so
    // passing it satisfies the sips:create authentication check without
    // asserting a permission this action does not use (precedent: SIP-0079).
    targetOwnerValidationAddresses.push(sovOwner);

    /** 3. Protocol controller pointer — the final governance action of the
     *  whole activation. */
    targets.push(protocol.address);
    values.push(0);
    signatures.push("setExitFeeController(address)");
    datas.push(abiCoder.encode(["address"], [exitFeeControllerAddress]));
    targetOwnerValidationAddresses.push(protocolOwner);

    if (targets.length !== 3) {
        throw new Error(`SIP-0094: Part 2 must hold exactly 3 actions, built ${targets.length}`);
    }
    if (
        signatures[targets.length - 1] !== "setExitFeeController(address)" ||
        targets[targets.length - 1].toLowerCase() !== protocol.address.toLowerCase()
    ) {
        throw new Error(
            "Perimeter Fee: the protocol setExitFeeController pin must be the LAST action of Part 2 — " +
                "it is the final governance switch of the whole activation (CF-1)."
        );
    }

    const args = {
        targets: targets,
        targetOwnerValidationAddresses: targetOwnerValidationAddresses,
        values: values,
        signatures: signatures,
        data: datas,
        description:
            "SIP-0094: Perimeter Fee Activation and Adoption Fund Transfer (Part 2 of 3 — GovernorOwner)\nhttps://forum.sovryn.com/t/sip-0094-parts-1-3-perimeter-fee-activation-and-adoption-fund-transfer/3590\nFinal controller wiring plus the Adoption Fund transfer to the Exchequer; the Development Fund moves by a companion multisig transaction.\n---\nExecutes 3 actions: withdraws the Adoption Fund's fully-vested SOV to the timelock (1), forwards exactly that amount onward to the Exchequer Multisig (1), and pins the ExitFeeController on the Sovryn protocol as the final Perimeter Fee activation pointer (1). The Development Fund residue moves by a companion Exchequer multisig transaction, not by this proposal. Details: https://github.com/DistributedCollective/SIPS/blob/340148c/SIP-0094.md, sha256: 496b69a6761f4e41d5e551f9c9f3962570beaba9e4aeb66613265c97fe09c756",
    };
    assertDescriptionFinalized(args.description);
    return { args, governor: "GovernorOwner" };
};

/**
 * SIP-0094 Part 3 (GovernorAdmin / TimelockAdmin) — switch off the Zero
 * Stability Pool's SOV subsidy by zeroing the issuance rate.
 *
 * One action:
 *   1. ZeroCommunityIssuance.setAPR(0)
 *
 * Governor choice is NOT the usual owner check. `ZeroCommunityIssuance` is an
 * UpgradableProxy whose `getOwner()` is TimelockOwner, but `setAPR` is gated by
 * `onlyRewardManager`, and the live `rewardManager()` is TimelockAdmin — so
 * this proposal has to run through GovernorAdmin, and the owner-validation
 * address handed to `sips:create` is the reward manager, not the proxy owner.
 * A GovernorOwner version of this proposal would revert on execution with
 * "Permission::rewardManager: access denied".
 *
 * Reversible by design: `setAPR` stays on the contract and only its parameter
 * is zeroed. Re-enabling the subsidy later needs nothing more than another
 * short GovernorAdmin proposal calling `setAPR(<bps>)` — no redeploy, no
 * upgrade, no owner action.
 *
 * Side effect worth knowing at execution time: `setAPR` first calls
 * `_issueSOV(...)` so the subsidy accrued since the last issuance is settled at
 * the OLD rate rather than retroactively repriced. That settlement prices ZUSD
 * in SOV through the CommunityIssuance's own Sovryn PriceFeeds pointer, so the
 * feed has to be healthy when the timelock executes.
 */
const getArgsSip0094Part3 = async (hre) => {
    const { ethers } = hre;
    const abiCoder = new ethers.utils.AbiCoder();

    if (!network.tags.mainnet) {
        throw new Error("getArgsSip0094Part3: run on mainnet or a mainnet fork only");
    }

    const communityIssuance = await ethers.getContract("ZeroCommunityIssuance");
    if ((await ethers.provider.getCode(communityIssuance.address)) === "0x") {
        throw new Error(
            `SIP-0094 Part 3: no contract code at ZeroCommunityIssuance ${communityIssuance.address}`
        );
    }

    const currentAPR = await communityIssuance.APR();
    if (currentAPR.eq(0)) {
        throw new Error(
            "SIP-0094 Part 3: the Zero Stability Pool subsidy APR is already 0 — this proposal would " +
                "be a no-op. Nothing to disable."
        );
    }
    const rewardManager = await communityIssuance.rewardManager();

    const args = {
        targets: [communityIssuance.address],
        targetOwnerValidationAddresses: [rewardManager],
        values: [0],
        signatures: ["setAPR(uint256)"],
        data: [abiCoder.encode(["uint256"], [0])],
        description:
            "SIP-0094: Perimeter Fee Activation and Adoption Fund Transfer (Part 3 of 3 — GovernorAdmin)\nhttps://forum.sovryn.com/t/sip-0094-parts-1-3-perimeter-fee-activation-and-adoption-fund-transfer/3590\nRetires the Zero Stability Pool SOV subsidy by setting the CommunityIssuance APR to zero.\n---\nRetires the Zero Stability Pool SOV subsidy by setting the CommunityIssuance APR from 500 (5%) to 0. Existing accrued gains are unaffected; re-enabling is a later one-action proposal. Details: https://github.com/DistributedCollective/SIPS/blob/340148c/SIP-0094.md, sha256: 496b69a6761f4e41d5e551f9c9f3962570beaba9e4aeb66613265c97fe09c756",
    };
    assertDescriptionFinalized(args.description);
    return { args, governor: "GovernorAdmin" };
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
    getArgsSipSov625,
    getArgsSip0073,
    getArgsSIP0077,
    getArgsSip_SOV_3161,
    getArgsSip0074,
    getArgsSip0076,
    getArgsSip0078,
    getArgsSip0079,
    getArgsSip0084Part1,
    getArgsSip0084Part2,
    getArgsSip0087,
    getArgsSip0089,
    getArgsSipIDocDemandCurve,
    getArgsSip0093,
    getArgsSip0094Part1,
    getArgsSip0094Part2,
    getArgsSip0094Part3,
};
