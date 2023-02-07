const hre = require("hardhat");
const {
    deployments: { deploy, get, log },
    getNamedAccounts,
    ethers,
} = hre;
const {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    sendWithMultisig,
    createProposal,
    multisigCheckTx,
} = require("../helpers/helpers");
const { arrayToUnique, encodeParameters } = require("../helpers/utils");

// @note this script can be usead as a boilerplate for othe SIPs creation
// FLOW:
// - deploy new modularized Staking contracts, including vulnerabilities fixes and team vesting cancelling refactored
// - deploy StakingModulesProxy - run `hardhat deploy --tags StakingModulesProxy`
// - deploy Staking modules - run `hardhat deploy --tags StakingModules`
// - upgrade VestingRegistryLogic (use .py scripts)
// - run this script to create a proposal
const createSIP0049 = async () => {
    const stakingModulesProxyDeployment = await get("StakingModulesProxy"); //await ethers.getContract("StakingModulesProxy");
    const abi = stakingModulesProxyDeployment.abi;
    const stakingModulesProxyInterface = new ethers.utils.Interface(abi);
    const stakingProxy = await ethers.getContract("StakingProxy");
    const stakingModules = await ethers.getContractAt("ModulesProxy", stakingProxy.address);
    const stakingModulesProxy = await ethers.getContract("StakingModulesProxy");
    const stakingProxyAddress = stakingProxy.address;
    const isNewModulesProxy =
        (await stakingProxy.getImplementation()) != stakingModulesProxy.address;

    const moduleNamesObject = getStakingModulesNames();
    const moduleNames = Object.values(moduleNamesObject);
    let modulesAddressList = [];
    let modulesDeployment = [];
    let totalGas = ethers.BigNumber.from(0);

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
        /* 
        // we are skipping these validations because otherwise we would need to have Staking modules proxy implementation set (and voted) 
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
        } */
    }

    // if (invalidModules.length != 0)
    //    throw Exception("Function clashing with multiple modules log:" + invalidModules);

    //targets = [contracts['Staking'], contracts['Staking']]
    if (isNewModulesProxy) {
        targets.push(stakingProxyAddress);
        values.push(0);
        signatures.push("setImplementation(address)");
        //datas.push([encodeParameters(["address"], [stakingModulesProxy.address])]);
        datas.push(encodeParameters(["address"], [stakingModulesProxy.address]));
    }
    if (addModules.length > 0) {
        targets.push(stakingProxyAddress);
        values.push(0);
        signatures.push("addModules(address[])");
        datas.push(encodeParameters(["address[]"], [addModules]));
    }
    if (replaceModulesFrom.length > 0) {
        targets.push(stakingProxyAddress);
        values.push(0);
        signatures.push("replaceModules(address[],address[])");
        datas.push(
            encodeParameters(["address[]", "address[]"], [replaceModulesFrom, replaceModulesTo])
        );
        throw new Error(
            "SIP-0039 is initial Staking modules deployment and should not have modules to replace"
        );
    }
    description =
        "SIP-0049: Staking contract refactoring to resolve EIP-170 size limit, Details: <TODO: commit link>, sha256: <TODO: SIP file sha256>";

    const governorAddress = (await get("GovernorOwner")).address;
    console.log("governor:", governorAddress);
    console.log("targets:", targets);
    console.log("values:", values);
    console.log("signatures:", signatures);
    console.log("datas:", datas);
    console.log("description:", description);

    await createProposal(governorAddress, targets, values, signatures, datas, description);
};

async function main() {
    await createSIP0049();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

/*
def createProposalSIP0049():

    stakingProxy = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)
    stakingModulesProxy = Contract.from_abi("StakingModulesProxy", address=contracts['Staking'], abi=ModulesProxy.abi, owner=acct)

    #TODO: set modules addresses in the addresses .json
    moduleAddresses = { 
        'StakingAdminModule': contracts['StakingAdminModule'],
        'StakingGovernanceModule': contracts['StakingGovernanceModule'],
        'StakingStakeModule': contracts['StakingStakeModule'],
        'StakingStorageModule': contracts['StakingStorageModule'],
        'StakingVestingModule': contracts['StakingVestingModule'],
        'StakingWithdrawModule': contracts['StakingWithdrawModule'],
        'WeightedStakingModule': contracts['WeightedStakingModule']
    }
    invalidModules = {}
    for module in moduleAddresses:
        if not stakingModulesProxy.canAddModule(moduleAddresses[module]):
            invalidModules.append({module: moduleAddresses[module]})
    
    if invalidModules != {}:
         raise Exception('Invalid modules:: ' + invalidModules)

    # Action
    targets = [contracts['Staking'], contracts['Staking']]
    values = [0, 0]
    signatures = ["setImplementation(address)", "addModules(address[])"]
    data1 = stakingProxy.setImplementation.encode_input(contracts['StakingModulesProxy'])
    data2 = stakingModulesProxy.addModules.encode_input(moduleAddresses)
    datas = ["0x" + data1[10:], "0x" + data2[10:]]

    description = "SIP-0049: Staking contract refactoring to resolve EIP-170 size limit, Details: <TODO: commit link>, sha256: <TODO: SIP file sha256>"

    # Create Proposal
    print(signatures)
    print(datas)
    print(description)
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)

*/
