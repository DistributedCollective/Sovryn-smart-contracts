const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { sendWithMultisig } = require("../helpers/helpers");

//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();

    const tx = await deploy("StakingModulesProxy", {
        //the deployment instance name
        contract: "ModulesProxy", //the contract to deploy
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    if (tx.newlyDeployed) {
        const stakingProxyDeployment = await get("StakingProxy");
        if (hre.network.tags["testnet"]) {
            //multisig is the owner
            const multisigDeployment = await get("MultiSigWallet");
            let stakingProxyInterface = new ethers.utils.Interface(stakingProxyDeployment.abi);
            let data = stakingProxyInterface.encodeFunctionData("setImplementation", [tx.address]);
            const { deployer } = await getNamedAccounts("deployer");
            await sendWithMultisig(multisigDeployment.address, tx.address, data, deployer);
        } else if (hre.network.tags["mainnet"]) {
            //governance is the owner - need a SIP to register
            // TODO: implementation ; meanwhile use brownie sip_interaction scripts to create proposal
        } else {
            const stakingProxy = await ethers.getContractAt(
                "StakingProxy",
                stakingProxyDeployment.address
            );
            await stakingProxy.setImplementation(tx.address);
        }
    }
};
func.tags = ["StakingModulesProxy"];
func.dependencies = ["StakingProxy"];
module.exports = func;
