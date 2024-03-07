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
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();

    const multisigDeployment = await get("MultiSigWallet");
    let ownerDelay = 0;
    let adminDelay = 0;
    let guardian;
    const ownerQuorumVotes = 20;
    const ownerMajorityPercentageVotes = 70;

    const adminQuorumVotes = 5;
    const adminMajorityPercentageVotes = 50;

    if (hre.network.tags["testnet"]) {
        ownerDelay = 3 * 60 * 60;
        adminDelay = 3 * 60 * 60;
        guardian = multisigDeployment.address;
    } else if (hre.network.tags["mainnet"]) {
        ownerDelay = 2 * 24 * 60 * 60;
        adminDelay = 3 * 60 * 60;
        guardian = multisigDeployment.address;
    }

    log(col.bgYellow("Deploying TimelockOwner..."));
    await deploy("TimelockOwner", {
        contract: "Timelock",
        from: deployer,
        // @todo change the name & symbol
        args: [deployer, ownerDelay],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const timelockOwnerDeployment = await get("TimelockOwner");
    const stakingDeployment = await get("StakingProxy");
    log(col.bgYellow("Deploying GovernorOwner..."));
    await deploy("GovernorOwner", {
        contract: "GovernorAlpha",
        from: deployer,
        // @todo change the name & symbol
        args: [
            timelockOwnerDeployment.address,
            stakingDeployment.address,
            guardian,
            ownerQuorumVotes,
            ownerMajorityPercentageVotes,
        ],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    log(col.bgYellow("Deploying TimelockAdmin..."));
    await deploy("TimelockAdmin", {
        contract: "Timelock",
        from: deployer,
        // @todo change the name & symbol
        args: [deployer, adminDelay],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const timelockAdminDeployment = await get("TimelockAdmin");
    log(col.bgYellow("Deploying GovernorAdmin..."));
    await deploy("GovernorAdmin", {
        contract: "GovernorAlpha",
        from: deployer,
        // @todo change the name & symbol
        args: [
            timelockAdminDeployment.address,
            stakingDeployment.address,
            guardian,
            adminQuorumVotes,
            adminMajorityPercentageVotes,
        ],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
func.tags = ["Bitocracy"];
module.exports = func;
