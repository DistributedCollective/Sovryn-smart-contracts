/* eslint-disable no-console */
const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig, getMultisigWallet } = require("../../deployment/helpers/helpers");

// Redeem ZUSD from MultiSigWallet
// Usage: npx hardhat multisig:redeem-zero-collateral --multisig <MULTISIG_ADDRESS> --amount <AMOUNT> --network <NETWORK>
task("multisig:redeem-zero-collateral", "Redeem ZUSD from MultiSigWallet")
    .addParam("amount", "Amount of ZUSD to redeem (human units, e.g. '100000')")
    .addOptionalParam(
        "maxIterations",
        "Max iterations for redemption (default 0 = unlimited)",
        "0"
    )
    .addOptionalParam("multisig", "Multisig wallet address", "MultiSigWallet")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addFlag(
        "submitTx",
        "Submit the multisig transaction if signer is owner. If not set, only print tx data."
    )
    .setAction(async ({ multisig, amount, signer, maxIterations }, hre) => {
        const {
            deployments: { get },
            ethers,
        } = hre;
        const ZUSD_AMOUNT = ethers.utils.parseEther(amount);
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        // 1. Get contract instances
        const troveManager = await ethers.getContract("TroveManager");
        const hintHelpers = await ethers.getContract("HintHelpers");
        const sortedTroves = await ethers.getContract("SortedTroves");
        const priceFeed = await ethers.getContract("ZeroPriceFeed");
        const zusdToken = await ethers.getContract("ZUSDToken");
        const multisigWallet = await getMultisigWallet(hre, multisig);
        multisig = multisigWallet.address;

        const owners = await multisigWallet.getOwners();
        const isOwner = owners.map((a) => a.toLowerCase()).includes(signerAcc.toLowerCase());

        // 2. Get redeemer balance (ZUSD)
        const redeemerBalance = await zusdToken.balanceOf(multisig);
        if (redeemerBalance.lt(ZUSD_AMOUNT)) {
            // Check DLLR balance
            let dllrBalance;
            try {
                const dllrToken = await ethers.getContract("DLLR");
                dllrBalance = await dllrToken.balanceOf(multisig);
            } catch (e) {
                dllrBalance = null;
            }
            const missingZUSD = ZUSD_AMOUNT.sub(redeemerBalance);
            if (dllrBalance && dllrBalance.gte(missingZUSD)) {
                logger.warn(
                    `Multisig does not have enough ZUSD to redeem. Requested: ${ethers.utils.formatEther(ZUSD_AMOUNT)}, Available: ${ethers.utils.formatEther(redeemerBalance)}. However, it has enough DLLR (${ethers.utils.formatEther(dllrBalance)}). Creating multisig tx to redeem ZUSD from DLLR for the missing amount (${ethers.utils.formatEther(missingZUSD)}).`
                );
                // Prepare DLLR->ZUSD redemption tx using MassetManager.redeem(ZUSD, amount)
                const massetManager = await ethers.getContract("MassetManager");
                const zusdAddress = zusdToken.address;
                const calldata = massetManager.interface.encodeFunctionData("redeem", [
                    zusdAddress,
                    missingZUSD,
                ]);
                if (isOwner && submitTx) {
                    const txId = await sendWithMultisig(
                        multisig,
                        massetManager.address,
                        calldata,
                        signerAcc,
                        0
                    );
                    logger.info(`Multisig transaction submitted. Tx ID: ${txId}`);
                } else {
                    logger.info("Transaction data for multisig submission or offline signing:");
                    logger.info({
                        to: massetManager.address,
                        value: "0",
                        data: calldata,
                    });
                    // Print serialized tx for offline signing
                    const serializeTx = await multisigWallet.populateTransaction.submitTransaction(
                        massetManager.address,
                        0,
                        calldata
                    );
                    delete serializeTx.from;
                    const serializedTx = ethers.utils.serializeTransaction(serializeTx);
                    logger.info("Serialized transaction for offline signing:");
                    logger.info(serializedTx);
                }
            } else {
                throw new Error(
                    `Multisig does not have enough ZUSD to redeem. Requested: ${ethers.utils.formatEther(ZUSD_AMOUNT)}, Available: ${ethers.utils.formatEther(redeemerBalance)}. DLLR balance: ${dllrBalance ? ethers.utils.formatEther(dllrBalance) : "unknown"}`
                );
            }
        }

        // 3. Get redemption price
        const redemptionPrice = await priceFeed.callStatic.fetchPrice();

        // 4. Get redemption hints
        const redemptionHints = await hintHelpers.getRedemptionHints(
            ZUSD_AMOUNT,
            redemptionPrice,
            BigInt(maxIterations)
        );
        const [firstRedemptionHint, partialRedemptionHintNICR, truncatedZUSDamount] =
            redemptionHints;

        if (truncatedZUSDamount.eq(0)) {
            throw new Error("Redemption not possible: truncated amount is 0");
        }

        // 5. Get approx and exact hints for partial redemption
        const numTroves = await sortedTroves.getSize();
        const numTrials = numTroves.gt(0) ? numTroves.mul(15) : ethers.BigNumber.from(15);
        const partialApproxHint = await hintHelpers.getApproxHint(
            partialRedemptionHintNICR,
            numTrials,
            42
        );
        const [approxHintAddress] = partialApproxHint;
        const [upperPartialHint, lowerPartialHint] = await sortedTroves.findInsertPosition(
            partialRedemptionHintNICR,
            approxHintAddress,
            approxHintAddress
        );

        // 6. Prepare redeemCollateral calldata
        const maxRedemptionFee = ethers.utils.parseEther("1"); // 100% max fee
        const iface = troveManager.interface;
        const calldata = iface.encodeFunctionData("redeemCollateral", [
            truncatedZUSDamount,
            firstRedemptionHint,
            upperPartialHint,
            lowerPartialHint,
            partialRedemptionHintNICR,
            BigInt(maxIterations), // maxIterations
            maxRedemptionFee,
        ]);

        // 7. Create multisig transaction
        // If the signer is an owner, submit the transaction, else print tx data
        // Check if signer is owner
        logger.info("Creating multisig transaction to redeem zero-collateral troves:");
        if (isOwner && submitTx) {
            const txId = await sendWithMultisig(
                multisig,
                troveManager.address,
                calldata,
                signerAcc,
                0
            );
            logger.info(`Multisig transaction submitted. Tx ID: ${txId}`);
        } else {
            logger.info("Transaction data for multisig submission or offline signing:");
            logger.info({
                to: troveManager.address,
                value: "0",
                data: calldata,
            });
            // Print serialized tx for offline signing
            const serializeTx = await multisigWallet.populateTransaction.submitTransaction(
                troveManager.address,
                0,
                calldata
            );
            delete serializeTx.from;
            const serializedTx = ethers.utils.serializeTransaction(serializeTx);
            logger.info("Serialized transaction for offline signing:");
            logger.info(serializedTx);
        }

        logger.info("Task completed: redeemCollateral multisig transaction ready.");
    });
