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
        },*/
        // NOT deployed in this release. LoanClosingsLiquidation has no source
        // change and calls no changed shared function, so its runtime bytecode
        // (metadata trailer stripped) is byte-identical to the module already
        // registered on the protocol. Deploying it would place a duplicate of
        // live code at a fresh address that the activation never registers —
        // and would inflate the "code at every new address" deploy check with
        // an address that is never used.
        /*LoanClosingsLiquidation: {
            moduleName: "LoanClosingsLiquidation",
            sampleFunction: "liquidate(bytes32,address,uint256)",
            requireSwapsImplSovrynSwapLib: false,
        },*/
        LoanClosingsRollover: {
            moduleName: "LoanClosingsRollover",
            sampleFunction: "rollover(bytes32,bytes)",
            requireSwapsImplSovrynSwapLib: true,
        },
        LoanClosingsWith: {
            moduleName: "LoanClosingsWith",
            sampleFunction: "closeWithDeposit(bytes32,address,uint256)",
            requireSwapsImplSovrynSwapLib: true,
        },
        LoanClosingsWithSwap: {
            moduleName: "LoanClosingsWithSwap",
            sampleFunction: "closeWithSwap(bytes32,address,uint256,bool,bytes)",
            requireSwapsImplSovrynSwapLib: true,
        },
        // Perimeter admin module: the protocol-singleton controller pointer
        // (exitFeeController / setExitFeeController). UIs quote fees via
        // eth_call of the live exits — no on-chain previews.
        ExitFeeModule: {
            moduleName: "ExitFeeModule",
            sampleFunction: "setExitFeeController(address)",
            requireSwapsImplSovrynSwapLib: false,
        },
        // Redeployed in this release: withdrawCollateral now charges the
        // borrower-exit fee through the Perimeter hook. initialize() registers no
        // Perimeter selectors — the pointer admin lives in ExitFeeModule and
        // there are no on-chain preview selectors anywhere in the release.
        LoanMaintenance: {
            moduleName: "LoanMaintenance",
            sampleFunction: "withdrawCollateral(bytes32,address,uint256)",
            requireSwapsImplSovrynSwapLib: true,
        },
        LoanMaintenanceViews: {
            moduleName: "LoanMaintenanceViews",
            sampleFunction: "getActiveLoans(uint256,uint256,bool)",
            // read-only: no swap path, so no library to link.
            requireSwapsImplSovrynSwapLib: false,
        },
        /*LoanOpenings: {
            moduleName: "LoanOpenings",
            sampleFunction: "setDelegatedManager(bytes32,address,bool)",
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
            libraries.SwapsImplSovrynSwapLib = swapsImplSovrynSwapLibDeployment.address;
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
