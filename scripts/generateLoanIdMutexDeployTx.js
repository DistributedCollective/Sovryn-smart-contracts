/**
 * Script to generate the deterministic deployment transaction for LoanIdMutex
 *
 * This creates a transaction that will deploy LoanIdMutex to the same address
 * on all chains, similar to how ERC1820Registry and Mutex are deployed.
 *
 * Usage:
 *   npx hardhat run scripts/generateLoanIdMutexDeployTx.js
 *
 * After running, copy the output and update:
 *   1. LOAN_ID_MUTEX_DEPLOY_DATA in deployment/helpers/reentrancy/utils.js
 *   2. The hardcoded address in contracts/reentrancy/LoanIdGuard.sol
 */

const { createLoanIdMutexDeployTransaction } = require("../deployment/helpers/reentrancy/utils");

async function main() {
    console.log("\n");
    console.log("╔" + "═".repeat(78) + "╗");
    console.log(
        "║" + " ".repeat(20) + "LoanIdMutex Deployment Transaction" + " ".repeat(24) + "║"
    );
    console.log("╚" + "═".repeat(78) + "╝");
    console.log("\n");

    const deployData = await createLoanIdMutexDeployTransaction();

    console.log("\n");
    console.log("╔" + "═".repeat(78) + "╗");
    console.log("║" + " ".repeat(28) + "NEXT STEPS" + " ".repeat(40) + "║");
    console.log("╚" + "═".repeat(78) + "╝");
    console.log("\n");

    console.log("1️⃣  Update deployment/helpers/reentrancy/utils.js");
    console.log("    Replace LOAN_ID_MUTEX_DEPLOY_DATA with:\n");
    console.log("    const LOAN_ID_MUTEX_DEPLOY_DATA = {");
    console.log(`        serializedDeployTx: "${deployData.serializedDeployTx}",`);
    console.log(`        deployerAddress: "${deployData.deployerAddress}",`);
    console.log(`        contractAddress: "${deployData.contractAddress}",`);
    console.log(
        `        transactionCostWei: BigNumber.from("${deployData.transactionCostWei.toString()}"),`
    );
    console.log("    };\n");

    console.log("2️⃣  Update contracts/reentrancy/LoanIdGuard.sol");
    console.log(`    Replace the hardcoded address with: ${deployData.contractAddress}\n`);
    console.log(
        `    LoanIdMutex private constant LOAN_ID_MUTEX = LoanIdMutex(${deployData.contractAddress});\n`
    );

    console.log("3️⃣  Deploy LoanIdMutex");
    console.log("    Run the deployment script:");
    console.log("    npx hardhat deploy --tags LoanIdMutex --network <network-name>\n");

    console.log("4️⃣  Verify the deployment");
    console.log("    The contract should be deployed at: " + deployData.contractAddress);
    console.log("    This address will be the SAME on all networks!\n");

    console.log("═".repeat(80));
    console.log("\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
