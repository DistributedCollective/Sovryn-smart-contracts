const { sendWithMultisig } = require("../helpers/helpers");
const col = require("cli-color");

const replaceProtocolModule = async function (
    hre,
    moduleAddress,
    protocolDeployment,
    multisigDeployment
) {
    const {
        deployments: { get, log },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();
    if (hre.network.tags["testnet"] || hre.network.tags["mainnet"]) {
        //@todo remove || hre.network.tags["mainnet"] if SIP-0047 passed
        // @todo wrap into a helper multisig tx creation
        const protocolABI = protocolDeployment.abi;
        const protocolInterface = new ethers.utils.Interface(protocolABI);
        let data = protocolInterface.encodeFunctionData("replaceContract", [moduleAddress]);
        log(col.bgYellow("Generating multisig transaction to replace protocol modules..."));
        await sendWithMultisig(
            multisigDeployment.address,
            protocolDeployment.address,
            data,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );
    } /*else if (hre.network.tags["mainnet"]) { //@todo uncomment if SIP-0047 passed
        //owned by governance - need a SIP to register
        // TODO: implementation ; meanwhile use brownie sip_interaction scripts to create proposal
        // TODO: figure out if possible to pass SIP via environment and run the script
        //const stakingProxyDeployment = await get("StakingProxy");
        log(col.bgBlue("Staking modules and StakingModuleProxy are deployed"));
        log(
            "Prepare and run SIP function in sips.js to create the proposal\n or alternatively use the brownie python proposal creation script."
        );
    }*/ else {
        // hh ganache
        log(col.bgYellow("Adding modules..."));
        log(modulesToAdd);
        await stakingModulesProxy.addModules(modulesToAdd);
    }
};

const func = async function (hre) {
    const {
        deployments: { get, log, deploy },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();

    const modulesList = { LoanOpenings: "LoanOpenings" };
    const multisigDeployment = await get("MultiSigWallet");
    const protocolDeployment = await get("SovrynProtocol");

    let totalGas = ethers.BigNumber.from(0);
    //console.log(`modulesList.keys.length: ${modulesList.keys.length}`);
    for (let i = 0; i < Object.keys(modulesList).length; i++) {
        const tx = await deploy(Object.values(modulesList)[i], {
            from: deployer,
            args: [],
            log: true,
        });
        if (tx.newlyDeployed) {
            totalGas = totalGas.add(tx.receipt.cumulativeGasUsed);
            log("Cumulative gas:", tx.receipt.cumulativeGasUsed.toString());
        }

        await replaceProtocolModule(hre, tx.address, protocolDeployment, multisigDeployment);
    }
    if (totalGas != 0) {
        log("=====================================================================");
        log("Total gas used for Protocol Modules deployment:", totalGas.toString());
        log("=====================================================================");
    }
};
func.tags = ["ReplaceProtocolModules"];
module.exports = func;
