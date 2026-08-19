const col = require("cli-color");
const func = async function (hre) {
    const {
        deployments: { deploy, log },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();

    // Protocol-side Perimeter borrower-exit charge hook, reached by delegatecall
    // (via the BorrowerExitPerimeter stub) only from the voluntary borrower-exit
    // entry points: closeWithDeposit (LoanClosingsWith._closeWithDeposit),
    // closeWithSwap (LoanClosingsShared._finalizeSwapClose and
    // _handleLoanTokenReturn) and withdrawCollateral
    // (LoanMaintenance.withdrawCollateral). Rollover and liquidation are gated
    // out by _exitFeeChargeable and never reach the stub.
    //
    // A deployed CONTRACT (not a linked library): its address is pinned on the
    // sovrynProtocol proxy via setBorrowerExitPerimeterOps, so the hook is
    // patchable with one setter call instead of redeploying + re-registering
    // those EIP-170-tight modules.
    log(col.bgYellow("Deploying BorrowerExitPerimeterOps..."));
    await deploy("BorrowerExitPerimeterOps", {
        from: deployer,
        log: true,
    });
};
func.tags = ["BorrowerExitPerimeterOps"];
module.exports = func;
