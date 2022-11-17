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

const createSIP0049 = async () => {
    const stakingModulesProxyDeployment = await get("StakingModulesProxy"); //await ethers.getContract("StakingModulesProxy");
    const abi = stakingModulesProxyDeployment.abi;
    const iface = new ethers.utils.Interface(abi);
    const stakingModulesProxy = await ethers.getContract("StakingModulesProxy");
    const stakingProxy = await ethers.getContract("StakingProxy");
    const stakingProxyAddress = stakingProxy.address;
    const isNewModulesProxy =
        (await stakingProxy.getImplementation()) != stakingModulesProxy.address;

    const moduleNamesObject = getStakingModulesNames();
    const moduleNames = Object.values(moduleNamesObject);
    let modulesAddressList = [];
    let modulesDeployment = [];
    let totalGas = ethers.BigNumber.from(0);

    let addModules = [];
    const replaceModulesFrom = [];
    const replaceModulesTo = [];
    let invalidModules = [];

    for (let newModuleName in moduleNamesObject) {
        const newModuleDeployment = await get(newModuleName);
        const newModuleAddress = newModuleDeployment.address;
        const addModulesObj = {};

        if (await stakingModulesProxy.canAddModule(newModuleAddress)) {
            addModules.push(newModuleAddress);
        } else {
            const clashing = await stakingModulesProxy.checkClashingFuncSelectors(
                newModuleAddress
            );
            const clashingUnique = clashing.clashingModules.filter(arrayToUnique);

            if (clashingUnique.length == 1) {
                replaceModulesFrom.push(clashingUnique[0]);
                replaceModulesTo.push(newModuleAddress);
            } else {
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
    }

    if (invalidModules.length != 0)
        throw Exception("Function clashing with multiple modules log:" + invalidModules);

    //targets = [contracts['Staking'], contracts['Staking']]
    if (isNewModulesProxy) {
        targets.push(stakingProxyAddress);
        values.push(0);
        signatures.push("setImplementation(address)");
        //callDatas = [encodeParameters(["address"], [voterOne])];
        datas.push([encodeParameters(["address"], [stakingModulesProxy.address])]);
    }
    if (addModules.length > 0) {
        targets.push(stakingProxyAddress);
        values.push(0);
        signatures.push("addModules(address[])");
        datas.push([encodeParameters(["address[]"], [addModules])]);
    }
    if (replaceModulesFrom.length > 0) {
        targets.push(stakingProxyAddress);
        values.push(0);
        signatures.push("replaceModules(address[],address[])");
        datas.push([
            encodeParameters(["address[]", "address[]"], [replaceModulesFrom, replaceModulesTo]),
        ]);
    }
    description =
        "SIP-0049: Staking contract refactoring to resolve EIP-170 size limit, Details: <TODO: commit link>, sha256: <TODO: SIP file sha256>";

    console.log(targets);
    console.log(values);
    console.log(signatures);
    console.log(datas);
    console.log(description);
    //createProposal((await get("GovernorOwner")).address, targets, values, signatures, datas, description);
};

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
