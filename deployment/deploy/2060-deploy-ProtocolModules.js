const path = require("path");
const col = require("cli-color");
const { getProtocolModules } = require("../helpers/helpers");
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
    const deployModules = {
        Affiliates: {
            moduleName: "Affiliates",
            sampleFunction: "setAffiliatesReferrer(address,address)",
        },
        LoanClosingsLiquidation: {
            moduleName: "LoanClosingsLiquidation",
            sampleFunction: "liquidate(bytes32,address,uint256)",
        },
        LoanClosingsRollover: {
            moduleName: "LoanClosingsRollover",
            sampleFunction: "rollover(bytes32,bytes)",
        },
        LoanClosingsWith: {
            moduleName: "LoanClosingsWith",
            sampleFunction: "closeWithDeposit(bytes32,address,uint256)",
        },
        LoanOpenings: {
            moduleName: "LoanOpenings",
            sampleFunction: "setDelegatedManager(bytes32,address,bool)",
        },
        LoanMaintenance: {
            moduleName: "LoanMaintenance",
            sampleFunction: "getActiveLoans(uint256,uint256,bool)",
        },
        LoanSettings: {
            moduleName: "LoanSettings",
            sampleFunction: "minInitialMargin(bytes32)",
        },
        ProtocolSettings: {
            moduleName: "ProtocolSettings",
            sampleFunction: "getPauser()",
        },
        SwapsExternal: {
            moduleName: "SwapsExternal",
            sampleFunction: "getSwapExpectedReturn(address,address,uint256)",
        },
        SwapsImplSovrynSwapModule: {
            moduleName: "SwapsImplSovrynSwapModule",
            sampleFunction: "getSovrynSwapNetworkContract(address)",
        },
    };
    log(col.bgYellow("Deploying ProtocolModules..."));
    const modulesList = getProtocolModules();
    const protocolModulesName = Object.keys(modulesList).filter((k) =>
        deployModules.hasOwnProperty(k)
    );
    for (let i = 0; i < protocolModulesName.length; i++) {
        const tx = await deploy(protocolModulesName[i], {
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
        log("Total gas used for Protocol Modules deployment:", totalGas.toString());
        log("=====================================================================");
    }
};
func.tags = ["ProtocolModules"];
module.exports = func;
