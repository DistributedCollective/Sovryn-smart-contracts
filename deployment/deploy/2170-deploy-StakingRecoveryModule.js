const col = require("cli-color");

/**
 * What the module must contain once deployed. A mismatch means the wrong source
 * was compiled, so the deployment aborts rather than leaving an address that
 * looks usable and would move the wrong tokens when the proposal executes.
 */
const EXPECTED = {
    ATTACKER: "0xac3ecE58a142e829Ef60f224F2FA8F4c98d6dEE8",
    ATTACKER_SECONDARY: "0x92972392e3AfBd8C0F417441325b8688e2b7e774",
    GUARDIANS_SAFE: "0xDd8e07A57560AdA0A2D84a96c457a5e6DDD488b7",
    EXCHEQUER: "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711",
    ATTACKER_LOCK_DATE: "1884076095",
};

/**
 * Deploys StakingRecoveryModule (SIP-0095) — DEPLOY ONLY, NEVER REGISTER.
 *
 * @dev This module is deliberately NOT added to getStakingModulesNames().
 * That list is consumed by 20-deploy-StakingModules, 30-deploy-AddStakingModules
 * and 40-deploy-ReplaceStakingModules. Scripts 30 and 40 REGISTER modules on the
 * staking proxy through the multisig. Registering this module that way would
 * install a stake-recovery capability outside of Bitocracy, which is precisely
 * what SIP-0095 exists to avoid: the module must be added, used and removed
 * inside the governance proposal's single atomic transaction.
 *
 * So this script only deploys the implementation and writes a hardhat-deploy
 * record (which is what `hardhat etherscan-verify` needs). Registration is an
 * action of the proposal, not of any deployment script.
 *
 * Guarded behind an explicit env flag so a bare `hardhat deploy` cannot pick it
 * up by accident.
 *
 * Source verification runs in the same command, after the constant checks pass.
 * A failed verification never aborts the run: by then the contract exists on
 * chain, so throwing would only obscure a successful deployment. It warns and
 * prints the manual command instead.
 *
 * Usage:
 *   DEPLOY_STAKING_RECOVERY_MODULE=true \
 *     npx hardhat deploy --tags StakingRecoveryModule --network rskSovrynMainnet
 *
 * Env:
 *   DEPLOY_STAKING_RECOVERY_MODULE=true   required, guards accidental runs
 *   SKIP_VERIFY=true                      deploy without verifying
 *   ETHERSCAN_API_KEY=<key>               optional; Blockscout accepts any value
 */
/**
 * Ask the block explorer whether it really holds verified sources, rather than
 * trusting that `etherscan-verify` did not throw. Returns false on any doubt.
 */
async function isVerifiedOnExplorer(hre, address) {
    const base = hre.network.config.verify?.etherscan?.apiUrl;
    if (!base) return false;
    try {
        const res = await fetch(`${base}/api/v2/smart-contracts/${address}`);
        if (!res.ok) return false;
        const body = await res.json();
        return body.is_verified === true;
    } catch (e) {
        return false;
    }
}

const func = async function (hre) {
    const {
        deployments: { deploy, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();

    log(col.bgYellow("Deploying StakingRecoveryModule (SIP-0095) — deploy only, no registration"));

    const tx = await deploy("StakingRecoveryModule", {
        from: deployer,
        args: [],
        log: true,
    });

    if (tx.newlyDeployed) {
        log("gas used:", tx.receipt.cumulativeGasUsed.toString());
    }

    const mod = await ethers.getContractAt("StakingRecoveryModule", tx.address);

    // Fail loudly here rather than at proposal-execution time.
    const attacker = await mod.ATTACKER();
    const attackerSecondary = await mod.ATTACKER_SECONDARY();
    const guardians = await mod.GUARDIANS_SAFE();
    const exchequer = await mod.EXCHEQUER();
    const lockDate = await mod.ATTACKER_LOCK_DATE();
    const selectors = await mod.getFunctionsList();

    log("");
    log(col.bgBlue("Post-deployment constants — check these against the runbook:"));
    log("  address            :", tx.address);
    log("  ATTACKER           :", attacker);
    log("  ATTACKER_SECONDARY :", attackerSecondary);
    log("  GUARDIANS_SAFE     :", guardians);
    log("  EXCHEQUER          :", exchequer);
    log("  ATTACKER_LOCK_DATE :", lockDate.toString());
    log("  selectors          :", selectors.join(", "));

    if (selectors.length !== 2) {
        throw new Error(
            `StakingRecoveryModule must expose exactly 2 selectors, got ${selectors.length}`
        );
    }

    // Printing these invites a human to eyeball them at 3am; checking them does
    // not. Every one is a compile-time constant, so any difference is a wrong
    // build rather than a change in the world.
    const found = {
        ATTACKER: attacker,
        ATTACKER_SECONDARY: attackerSecondary,
        GUARDIANS_SAFE: guardians,
        EXCHEQUER: exchequer,
        ATTACKER_LOCK_DATE: lockDate.toString(),
    };
    const mismatches = Object.keys(EXPECTED).filter(
        (k) => String(found[k]).toLowerCase() !== String(EXPECTED[k]).toLowerCase()
    );
    if (mismatches.length > 0) {
        throw new Error(
            "StakingRecoveryModule constants do not match the reviewed source:\n" +
                mismatches
                    .map((k) => `  ${k}: expected ${EXPECTED[k]}, got ${found[k]}`)
                    .join("\n")
        );
    }
    log(col.green("  constants match the reviewed source"));

    // Deploying must never leave the capability reachable. If the selectors
    // already resolve, something registered this module outside the proposal.
    const proxy = await ethers.getContractAt(
        ["function getFuncImplementation(bytes4) view returns (address)"],
        (await hre.deployments.get("StakingProxy")).address
    );
    for (const selector of selectors) {
        const impl = await proxy.getFuncImplementation(selector);
        if (impl !== ethers.constants.AddressZero) {
            throw new Error(
                `Selector ${selector} is already registered on the staking proxy at ${impl}. ` +
                    "This module must only ever be registered inside the SIP-0095 transaction."
            );
        }
    }
    log(col.green("  selectors are not registered on the staking proxy"));

    // --- source verification, in the same run -----------------------------
    // Blockscout needs the contract indexed before it will accept sources, and
    // indexing lags the deployment transaction by a few blocks. Retry rather
    // than fail on the first attempt.
    const isLive = !["hardhat", "localhost"].includes(hre.network.name);
    const skipVerify = process.env.SKIP_VERIFY === "true";

    if (isLive && !skipVerify) {
        const apiKey = process.env.ETHERSCAN_API_KEY || "blockscout";
        const attempts = 5;
        let verified = false;

        log("");
        log(col.bgYellow("Verifying source..."));

        for (let i = 1; i <= attempts && !verified; i++) {
            try {
                if (i > 1) {
                    const waitMs = 15000;
                    log(`  not indexed yet; waiting ${waitMs / 1000}s (attempt ${i}/${attempts})`);
                    await new Promise((r) => setTimeout(r, waitMs));
                }
                await hre.run("etherscan-verify", {
                    apiKey,
                    contractName: "StakingRecoveryModule",
                    solcInput: true,
                    // No source file in this repo carries an SPDX header, so
                    // etherscan-verify SKIPS the contract with a warning and
                    // does NOT throw. Supply the repo's licence explicitly.
                    license: "Apache-2.0",
                    forceLicense: true,
                });

                // Never infer success from the absence of an exception: the
                // task logs and continues on several skip paths. Ask the
                // explorer what it actually holds.
                verified = await isVerifiedOnExplorer(hre, tx.address);
            } catch (e) {
                if (i === attempts) {
                    log(col.red("  verification did not complete: " + e.message));
                    log(col.red("  the contract IS deployed at " + tx.address));
                    log(
                        col.red(
                            "  retry manually: npx hardhat etherscan-verify --api-key " +
                                apiKey +
                                " --contract-name StakingRecoveryModule --solc-input --network " +
                                hre.network.name
                        )
                    );
                }
            }
        }
        if (verified) {
            log(col.green("  source verified (confirmed with the explorer)"));
        } else {
            log(col.red("  NOT verified. The contract IS deployed at " + tx.address + "."));
            log(
                col.red(
                    "  retry: npx hardhat etherscan-verify --contract-name StakingRecoveryModule" +
                        " --license Apache-2.0 --force-license --solc-input --network " +
                        hre.network.name
                )
            );
        }
    } else {
        log(
            col.yellow(
                skipVerify
                    ? "Verification skipped (SKIP_VERIFY)."
                    : "Local network — no verification."
            )
        );
    }

    log("");
    log(col.bgYellow("NOT registered. Registration is action 1 of SIP-0095."));
    log(col.bgBlue("SIP-0095 `New contract` address: " + tx.address));
};

func.tags = ["StakingRecoveryModule"];
func.skip = async () => process.env.DEPLOY_STAKING_RECOVERY_MODULE !== "true";
module.exports = func;
