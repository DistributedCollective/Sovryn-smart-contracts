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
        /*Affiliates: {
            moduleName: "Affiliates",
            sampleFunction: "setAffiliatesReferrer(address,address)",
            requireSwapsImplSovrynSwapLib: false,
        },
        LoanClosingsLiquidation: {
            moduleName: "LoanClosingsLiquidation",
            sampleFunction: "liquidate(bytes32,address,uint256)",
            requireSwapsImplSovrynSwapLib: false,
        },
        LoanClosingsRollover: {
            moduleName: "LoanClosingsRollover",
            sampleFunction: "rollover(bytes32,bytes)",
            requireSwapsImplSovrynSwapLib: true,
        },
        LoanClosingsWith: {
            moduleName: "LoanClosingsWith",
            sampleFunction: "closeWithDeposit(bytes32,address,uint256)",
            requireSwapsImplSovrynSwapLib: true,
        },*/
        LoanOpenings: {
            moduleName: "LoanOpenings",
            sampleFunction: "setDelegatedManager(bytes32,address,bool)",
            requireSwapsImplSovrynSwapLib: true,
        },
        /*LoanMaintenance: {
            moduleName: "LoanMaintenance",
            sampleFunction: "getActiveLoans(uint256,uint256,bool)",
            requireSwapsImplSovrynSwapLib: true,
        },
        LoanSettings: {
            moduleName: "LoanSettings",
            sampleFunction: "minInitialMargin(bytes32)",
            requireSwapsImplSovrynSwapLib: false,
        },
        ProtocolSettings: {
            moduleName: "ProtocolSettings",
            sampleFunction: "getPauser()",
            requireSwapsImplSovrynSwapLib: false,
        },
        SwapsExternal: {
            moduleName: "SwapsExternal",
            sampleFunction: "getSwapExpectedReturn(address,address,uint256)",
            requireSwapsImplSovrynSwapLib: true,
        },
        SwapsImplSovrynSwapModule: {
            moduleName: "SwapsImplSovrynSwapModule",
            sampleFunction: "getSovrynSwapNetworkContract(address)",
            requireSwapsImplSovrynSwapLib: true,
        },*/
    };
    log(col.bgYellow("Deploying ProtocolModules..."));
    const modulesList = getProtocolModules();
    const protocolModulesName = Object.keys(modulesList).filter((k) =>
        deployModules.hasOwnProperty(k)
    );

    const swapsImplSovrynSwapLibDeployment = await get("SwapsImplSovrynSwapLib");

    for (let i = 0; i < protocolModulesName.length; i++) {
        let libraries = {};

        const module = deployModules[protocolModulesName[i]];

        if (module.requireSwapsImplSovrynSwapLib) {
            libraries = {
                SwapsImplSovrynSwapLib: swapsImplSovrynSwapLibDeployment.address,
            };
        }
        const tx = await deploy(module.moduleName, {
            from: deployer,
            args: [],
            log: true,
            libraries: libraries,
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
func.dependencies = ["SwapsImplSovrynSwapLib"];
module.exports = func;
