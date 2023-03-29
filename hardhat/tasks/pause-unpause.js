/* eslint-disable no-console */
const { task } = require("hardhat/config");
const { boolean } = require("hardhat/internal/core/params/argumentTypes");
const Logs = require("node-logs");
const {
    sendWithMultisig,
    multisigCheckTx,
    multisigRevokeConfirmation,
    multisigExecuteTx,
    multisigAddOwner,
    multisigRemoveOwner,
} = require("../../deployment/helpers/helpers");

const logger = new Logs().showInConsole(true);

/*
def pauseProtocolModules():
    print("Pause Protocol Modules")
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.togglePaused.encode_input(True)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)
                     
 */
const pauseUnpause = async (hre, signer, bool) => {
    const {
        deployments: { get },
        ethers,
    } = hre;
    const signerAcc = (await hre.getNamedAccounts())[signer];
    const multisigDeployment = await get("MultiSigWallet");
    const stakingDeployment = await get("Staking");

    const stakingInterface = new ethers.utils.Interface(stakingDeployment.abi);
    let data = stakingInterface.encodeFunctionData("pauseUnpause", [bool]);
    logger.warn("Generating multisig tx to pause Staking...");
    await sendWithMultisig(multisigDeployment.address, stakingDeployment.address, data, signerAcc);
};

task("pausing:pause-staking", "Pause Staking Modules Contracts")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await pauseUnpause(hre, signer, true);
    });

task("pausing:unpause-staking", "Pause Staking Modules Contracts")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await pauseUnpause(hre, signer, false);
    });
