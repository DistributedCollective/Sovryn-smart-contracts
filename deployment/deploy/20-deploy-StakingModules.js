const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");

const { getStakingModulesNames } = require("../helpers/helpers");
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners(); //
    let totalGas = ethers.BigNumber.from(0);

    // @dev use to narrow down module contracts to redeploy
    // e.g. you have three contracts modified but want to deploy only one
    // then add the modules not ready for deployment to `dontDeployModules`
    const dontDeployModules = {
        /*
        StakingAdminModule: "StakingAdminModule",
        StakingGovernanceModule: "StakingGovernanceModule",
        StakingStakeModule: "StakingStakeModule",
        StakingStorageModule: "StakingStorageModule",
        StakingVestingModule: "StakingVestingModule",
        StakingWithdrawModule: "StakingWithdrawModule",
        WeightedStakingModule: "WeightedStakingModule",
        */
    };
    const modulesList = getStakingModulesNames();
    const stakingModuleNames = Object.keys(modulesList).filter(
        (k) => !dontDeployModules.hasOwnProperty(k)
    );

    for (let i = 0; i < stakingModuleNames.length; i++) {
        const tx = await deploy(stakingModuleNames[i], {
            from: deployer,
            args: [],
            log: true,
        });
        if (tx.newlyDeployed) {
            totalGas = totalGas.add(tx.receipt.cumulativeGasUsed);
            log("cumulative gas:", tx.receipt.cumulativeGasUsed.toString());
        }
    }
    if (totalGas != 0) {
        log("=====================================================================");
        log("Total gas used for Staking Modules deployment:", totalGas.toString());
        log("=====================================================================");
    }
};
func.tags = ["StakingModules"];
module.exports = func;
