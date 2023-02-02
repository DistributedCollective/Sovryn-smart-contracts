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
    const { deployer } = await getNamedAccounts();

    const tx = await deploy("StakingModulesProxy" /*deployment instance name*/, {
        contract: "ModulesProxy", //contract to deploy
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const stakingProxy = await ethers.getContract("StakingProxy");
    const stakingProxyImpl = await stakingProxy.getImplementation();
    log("Current stakinProxy.getImplementation():", stakingProxyImpl);

    if (tx.newlyDeployed || tx.address != stakingProxyImpl) {
        const stakingProxyDeployment = await get("StakingProxy");
        if (hre.network.tags["testnet"]) {
            //multisig is the owner
            const multisigDeployment = await get("MultiSigWallet");
            //@todo wrap getting ms tx data into a helper
            let stakingProxyInterface = new ethers.utils.Interface(stakingProxyDeployment.abi);
            let data = stakingProxyInterface.encodeFunctionData("setImplementation", [tx.address]);
            const { deployer } = await getNamedAccounts();
            ///@todo check if the deployer is one of ms owners
            log(
                `Creating multisig tx to set StakingModulesProxy(${tx.address}) as implementation for StakingProxy(${stakingProxyDeployment.address}...`
            );
            await sendWithMultisig(
                multisigDeployment.address,
                stakingProxy.address,
                data,
                deployer
            );
            log(`>>> DONE. Requires Multisig (${multisigDeployment.address}) signing <<<`);
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
