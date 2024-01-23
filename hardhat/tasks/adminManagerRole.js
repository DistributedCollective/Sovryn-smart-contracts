const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

task("setAdminManager", "SetAdminManager to the contract that implement adminManagerRole")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addParam("adminManagerTarget", "Admin manager target: 'MultiSigWallet'")
    .addParam(
        "contractTarget",
        "Contract name target: e.g: 'VestingRegistry' or 'LiquidityMining' "
    )
    .setAction(async ({ signer, adminManagerTarget, contractTarget }, hre) => {
        const {
            deployments: { get },
            ethers,
        } = hre;

        const signerAcc = (await hre.getNamedAccounts())[signer];

        const multisigDeployment = await get("MultiSigWallet");
        const contractTargetDeployment = await get(contractTarget);
        const adminManagerTargetDeployment = await get(adminManagerTarget);

        const targetInterface = new ethers.utils.Interface(contractTargetDeployment.abi);
        const data = targetInterface.encodeFunctionData("setAdminManager", [
            adminManagerTargetDeployment.address,
        ]);

        await sendWithMultisig(
            multisigDeployment.address,
            contractTargetDeployment.address,
            data,
            signerAcc
        );
    });
