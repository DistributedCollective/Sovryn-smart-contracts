const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

task("setAdminManager", "SetAdminManager to the contract that implement adminManagerRole")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addParam("adminManager", "New admin manager: 'MultiSigWallet'")
    .addParam("contractTarget", "Contract name or address to set admin manager: e.g: 'VestingRegistry'")
    .setAction(async ({ signer, adminManagerTarget, contractTarget }, hre) => {
        const {
            deployments: { get },
            ethers,
        } = hre;

        const signerAcc = (await hre.getNamedAccounts())[signer];

        const multisigDeployment = await get("MultiSigWallet");

        let contractTargetAddress = ethers.constants.AddressZero;
        if (ethers.utils.isAddress(contractTarget) && await ethers.provider.getCode(contractTarget) !== "0x") {
            contractTargetAddress = contractTarget;
        }

        const contractTargetDeployment =
            contractTargetAddress === ethers.constants.AddressZero
                ? await get(contractTarget)
                : await ethers.getContractAt(contractTarget, contractTargetAddress);

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
