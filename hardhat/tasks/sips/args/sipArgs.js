const { HardhatRuntimeEnvironment } = require("hardhat/types");
const { getStakingModulesNames } = require("../../../../deployment/helpers/helpers");
const { validateAmmOnchainAddresses } = require("../../../helpers");

const sampleSIP01 = async (hre) => {
    const { ethers } = hre;
    const SampleToken = await ethers.getContractFactory("ERC20");
    const args = {
        targets: ["0x95a1CA72Df913f14Dc554a5D14E826B64Bd049FD"],
        values: [0],
        signatures: ["transfer(address,uint256)"],
        data: [
            SampleToken.interface._abiCoder.encode(
                ["address", "uint256"],
                ["0x95222290dd7278aa3ddd389cc1e1d165cc4bafe5", ethers.utils.parseEther("1")]
            ),
        ],
        description: "SIP-0001: Transfer token. SHA256: ",
    };

    return args;
};

const sampleSIPSetMassetManagerProxy = async (hre) => {
    const { ethers } = hre;
    const newMassetManagerProxy = "";
    const dllr = await ethers.getContract("DLLR");
    const args = {
        targets: [dllr.address],
        values: [0],
        signatures: ["setMassetManagerProxy(address)"],
        data: [dllr.interface._abiCoder.encode(["address"], [newMassetManagerProxy])],
        description: "SIP-0002: Set Masset Manager Proxy. SHA256: ",
    };

    return args;
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

const getArgsSip0067 = async (hre) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

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
            // @todo need to check the discrepancy address between onchain with the excel one
            deployment: await get("AmmBproOracle"),
            contractName: "BproOracle",
        },
        {
            deployment: await get("AmmMocOracle"),
            contractName: "MocOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterMoc",
        },
        {
            deployment: await get("AmmSovOracle"),
            contractName: "SovOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterSov",
        },
        {
            deployment: await get("AmmEthOracle"),
            contractName: "EthOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterEth",
        },
        {
            deployment: await get("AmmBnbOracle"),
            contractName: "BnbOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterBnb",
        },
        {
            deployment: await get("AmmXusdOracle"),
            contractName: "XusdOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterXusd",
        },
        {
            deployment: await get("AmmFishOracle"),
            contractName: "FishOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterFish",
        },
        {
            deployment: await get("AmmRifOracle"),
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
        const isValid = await validateAmmOnchainAddresses(deploymentTarget);
        if (!isValid) return process.exit;

        targets.push(deploymentTarget.address);
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: "SIP-0067 : Accepting ownership of AMM contracts Part 1",
    };

    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0068 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

    const deploymentTargets = [
        {
            deployment: await get("AmmMyntOracle"),
            contractName: "MyntOracle",
            sourceContractTypeToValidate: "ConverterV1",
            sourceContractNameToValidate: "AmmConverterMynt",
        },
        {
            deployment: await get("AmmDllrOracle"),
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
        const isValid = await validateAmmOnchainAddresses(deploymentTarget);
        if (!isValid) return process.exit;

        targets.push(deploymentTarget.address);
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: "SIP-0068 : Accepting ownership of AMM contracts Part 2",
    };

    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0069 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

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
        deploymentTarget = deploymentTargets[i];
        const isValid = await validateAmmOnchainAddresses(deploymentTarget);
        if (!isValid) return process.exit;

        targets.push(deploymentTarget.address);
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: "SIP-0069 : Accepting ownership of AMM contracts Part 3",
    };

    return { args, governor: "GovernorOwner" };
};

const getArgsSip0070 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

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
        deploymentTarget = deploymentTargets[i];
        const isValid = await validateAmmOnchainAddresses(deploymentTarget);
        if (!isValid) return process.exit;

        targets.push(deploymentTarget.address);
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: "SIP-0070 : Accepting ownership of AMM contracts Part 4",
    };

    return { args, governor: "GovernorOwner" };
};

module.exports = {
    getArgsSip0058,
    getArgsSip0049,
    getArgsSip0063,
    getArgsSip0065,
    getArgsSip0067,
    getArgsSip0068,
    getArgsSip0069,
    getArgsSip0070,
};
