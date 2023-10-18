const { HardhatRuntimeEnvironment } = require("hardhat/types");
const { getStakingModulesNames } = require("../../../../deployment/helpers/helpers");

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
            // WARNING: the sha256sum value shown is for the current state of the document which will have to be changed with the guardian signer addresses
            "SIP-0047: Changing of the Guardians, Details: https://github.com/DistributedCollective/SIPS/blob/2fc9b00/SIP-0047.md, sha256: 3c6567d238f0d0df83aa939fdf7080807adc42914f22280121781ea4a332a977",
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
};
