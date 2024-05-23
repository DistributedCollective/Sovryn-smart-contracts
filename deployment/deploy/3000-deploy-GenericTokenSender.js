const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { ethers } = require("hardhat");
const col = require("cli-color");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, log, get },
        getNamedAccounts,
    } = hre;

    const { deployer, signer2 } = await getNamedAccounts();
    const balanceBefore = await ethers.provider.getBalance(deployer);
    const multisigDeployment = await get("TreasuryMultisig");
    log(col.bgYellow("Deploying GenericTokenSender..."));
    const tx = await deploy("GenericTokenSender", {
        from: deployer,
        args: [],
        log: true,
        // skipIfAlreadyDeployed: true,
    });
    const genericTokenSender = await ethers.getContract(
        "GenericTokenSender",
        await ethers.getSigner(deployer)
    );
    if (tx.newlyDeployed || (await genericTokenSender.owner()) !== multisigDeployment.address) {
        await genericTokenSender.addAdmin(deployer);
        await genericTokenSender.addAdmin(signer2);
        await genericTokenSender.transferOwnership(multisigDeployment.address);
    }

    log(col.bgYellow("GenericTokenSender post-deployment validation..."));
    log("deployer ", deployer, "isAdmin ?", await genericTokenSender.admins(deployer));
    log("signer2 ", signer2, "isAdmin ?", await genericTokenSender.admins(deployer));
    log("owner =", await genericTokenSender.owner());

    const balanceAfter = await ethers.provider.getBalance(deployer);
    log(col.bgYellow("deployment cost:"));
    log(balanceBefore.sub(balanceAfter) / 1e18);
};
func.tags = ["GenericTokenSender"];
module.exports = func;
