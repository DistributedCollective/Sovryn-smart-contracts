const { HardhatRuntimeEnvironment } = require("hardhat/types");
const { getStakingModulesNames } = require("../../../../deployment/helpers/helpers");

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

const getArgsSip0064 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

    const targets = [
        (await get("AmmSovrynSwapNetwork")).address,
        (await get("AmmSwapSettings")).address,
        (await get("BproOracle")).address,
        (await get("MocOracle")).address,
        (await get("SovOracle")).address,
        (await get("EthOracle")).address,
        (await get("BnbOracle")).address,
        (await get("XusdOracle")).address,
        (await get("FishOracle")).address,
        (await get("RifOracle")).address,
    ];

    const values = [];
    const signatures = [];
    const datas = [];
    for (let i = 0; i < targets.length; i++) {
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }

    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: "SIP-0064 : Accepting ownership of AMM contracts Part 1",
    };

    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0065 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

    const targets = [
        (await get("MyntOracle")).address,
        (await get("DllrOracle")).address,
        (await get("AmmConversionPathFinder")).address,
        (await get("AmmConverterUpgrader")).address,
        (await get("AmmConverterRegistryData")).address,
        (await get("AmmOracleWhitelist")).address,
        (await get("RbtcWrapperProxy")).address,
    ];

    const values = [];
    const signatures = [];
    const datas = [];
    for (let i = 0; i < targets.length; i++) {
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }
    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: "SIP-0065 : Accepting ownership of AMM contracts Part 2",
    };

    return { args, governor: "GovernorAdmin" };
};

const getArgsSip0066 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

    const targets = [
        (await get("ConverterDoc")).address,
        (await get("ConverterUsdt")).address,
        (await get("ConverterBpro")).address,
        (await get("ConverterBnb")).address,
        (await get("ConverterMoc")).address,
        (await get("ConverterXusd")).address,
        (await get("ConverterSov")).address,
        (await get("ConverterEth")).address,
        (await get("ConverterFish")).address,
        (await get("ConverterMynt")).address,
    ];

    const values = [];
    const signatures = [];
    const datas = [];
    for (let i = 0; i < targets.length; i++) {
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }
    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: "SIP-0066 : Accepting ownership of AMM contracts Part 1",
    };

    return { args, governor: "GovernorOwner" };
};

const getArgsSip0067 = async (hre) => {
    const {
        deployments: { get },
    } = hre;

    const targets = [
        (await get("ConverterRif")).address,
        (await get("ConverterDllr")).address,
        (await get("AmmContractRegistry")).address,
        (await get("AmmConverterFactory")).address,
    ];

    const values = [];
    const signatures = [];
    const datas = [];
    for (let i = 0; i < targets.length; i++) {
        values.push(0);
        signatures.push("acceptOwnership()");
        datas.push("0x");
    }
    const args = {
        targets: targets,
        values: values,
        signatures: signatures,
        data: datas,
        description: "SIP-0067 : Accepting ownership of AMM contracts Part 2",
    };

    return { args, governor: "GovernorOwner" };
};

module.exports = {
    getArgsSip0058,
    getArgsSip0049,
    getArgsSip0063,
    getArgsSip0064,
    getArgsSip0065,
    getArgsSip0066,
    getArgsSip0067,
};
