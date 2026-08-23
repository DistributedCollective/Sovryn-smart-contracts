const path = require("path");
const col = require("cli-color");
const { deployedCodeIsUnchanged } = require("../helpers/helpers");
const func = async function (hre) {
    const {
        deployments: { deploy, get, getOrNull, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners(); //

    /**
     * Redeploy only when the library's executable code actually changed.
     *
     * The default comparison is over full bytecode, which includes the solc
     * metadata trailer. That trailer is a hash of every source file in the
     * compilation unit, so it moves whenever an imported file changes even if
     * nothing this library compiles to is affected. Redeploying on that would
     * produce a functionally identical copy, and consumers link whatever
     * address this record holds.
     *
     * A fresh copy is also not verifiable on Blockscout: the call-protection
     * self-address is not masked by that verifier.
     *
     * Comparing runtime bodies distinguishes the two cases — metadata-only
     * means skip, a real code change means deploy.
     */
    const existing = await getOrNull("SwapsImplSovrynSwapLib");
    const artifact = await hre.artifacts.readArtifact("SwapsImplSovrynSwapLib");
    const unchanged = deployedCodeIsUnchanged(existing, artifact);

    if (existing && unchanged) {
        log(
            col.bgGreen(
                `SwapsImplSovrynSwapLib: executable code unchanged — keeping ${existing.address}`
            )
        );
        log(
            "  (metadata may differ; that does not change behaviour and a fresh copy " +
                "would be unverifiable on Blockscout)"
        );
        return;
    }

    if (existing && !unchanged) {
        log(
            col.bgRed(
                "SwapsImplSovrynSwapLib: executable code CHANGED — redeploying, and every " +
                    "module that links it must be redeployed and re-verified with it"
            )
        );
    }

    log(col.bgYellow("Deploying SwapsImplSovrynSwapLib..."));
    await deploy("SwapsImplSovrynSwapLib", {
        from: deployer,
        log: true,
    });
};
func.tags = ["SwapsImplSovrynSwapLib"];
module.exports = func;
