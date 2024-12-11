const fs = require("fs");
const csv = require("csv-parser");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { task } = require("hardhat/config");
const { getSignerFromAccount } = require("../../deployment/helpers/helpers");

/*const {
    signWithMultisig,
    multisigCheckTx,
    multisigRevokeConfirmation,
    multisigExecuteTx,
    multisigAddOwner,
    multisigRemoveOwner,
} = require("../../deployment/helpers/helpers");*/

const assetNamesByNetwork = {
    1: "ETH",
    30: "RBTC",
    56: "BNB",
    60808: "ETH",
};

// functions to parse .csv files on asset distribution
async function parseFileForSendDirect(fileName, decimals) {
    const { BigNumber } = require("ethers");
    console.log(fileName);
    let totalAmount = BigNumber.from("0");
    let receivers = [];
    let amounts = [];
    let errorMsg = "";
    const DECIMALS = decimals;

    return new Promise((resolve, reject) => {
        fs.createReadStream(fileName)
            .pipe(csv())
            .on("data", (row) => {
                const tokenOwner = row.tokenOwner.trim();
                const rawAmount = row.amount.trim();

                const parts = rawAmount.split(".");
                if (parts.length !== 2) {
                    errorMsg += `\n${tokenOwner} amount: ${rawAmount} (invalid decimal format)`;
                    return;
                }

                let [integerPart, decimalPart] = parts;

                // If integerPart is empty (like ".00123"), treat it as "0"
                if (!integerPart) {
                    integerPart = "0";
                }

                // Ensure the decimal part has exactly DECIMALS digits
                if (decimalPart.length < DECIMALS) {
                    decimalPart = decimalPart.padEnd(DECIMALS, "0");
                } else if (decimalPart.length > DECIMALS) {
                    errorMsg += `\n${tokenOwner} amount: ${rawAmount} (more than ${DECIMALS} decimal places)`;
                    return;
                }

                const fullIntegerStr = integerPart + decimalPart;
                if (!/^\d+$/.test(fullIntegerStr)) {
                    errorMsg += `\n${tokenOwner} amount: ${rawAmount} (invalid characters)`;
                    return;
                }

                // Convert to BigNumber and back to string to remove leading zeros
                const amountBN = BigNumber.from(fullIntegerStr);
                const normalizedAmountStr = amountBN.toString();

                totalAmount = totalAmount.add(amountBN);

                receivers.push(tokenOwner.toLowerCase());
                amounts.push(normalizedAmountStr);

                console.log("=======================================");
                console.log(`'${tokenOwner}',`);
                console.log(normalizedAmountStr);
            })
            .on("end", () => {
                console.log(receivers);
                console.log(amounts);

                if (errorMsg !== "") {
                    reject(new Error(`Formatting error: ${errorMsg}`));
                } else {
                    resolve({
                        totalAmount: totalAmount.toString(),
                        receivers,
                        amounts,
                    });
                }
            })
            .on("error", (err) => {
                reject(err);
            });
    });
}

task(
    "utils:compare-bytecode",
    "Compare the deployed onchain contract bytecode with the artifact to see if they match"
)
    .addParam(
        "contract",
        "Deployed contract artifact name or hh deployment name to compare deployedBytecode with onchain deployment",
        undefined,
        types.string
    )
    .addOptionalParam(
        "address",
        "Deployment address - use if it is different from the deployment data in the repository",
        undefined,
        types.string
    )
    .addOptionalParam(
        "useArtifact",
        "Take deployBytecode for comparison from artifact. Falls back to it if there is no deployedBytecode data in the deployment data or use explicitly.",
        false,
        types.boolean
    )
    .setAction(async ({ contract, address, useArtifact }, hre) => {
        const {
            ethers: { provider },
            deployments: { get, getOrNull, getArtifact },
            ethers,
        } = hre;

        let deploymentObject;
        let expectedBytecode;

        if (useArtifact) {
            deploymentObject = await getArtifact(contract);
            expectedBytecode = deploymentObject.deployedBytecode;
            logger.info("Trying to compare on-chain bytecode with artifact's deployedBytecode");
        } else {
            deploymentObject = await getOrNull(contract);
            expectedBytecode = deploymentObject ? deploymentObject.deployedBytecode : false;
            const bytecodeExists = expectedBytecode ?? false;
            if (!bytecodeExists) {
                logger.error("No deployedBytecode found in deployment object");
                deploymentObject = await getArtifact(contract);
                expectedBytecode = deploymentObject.deployedBytecode;
                logger.info(
                    "Trying to compare on-chain bytecode with ARTIFACT's deployedBytecode"
                );
            } else {
                logger.info(
                    "Trying to compare on-chain bytecode with DEPLOYEMNT object's deployedBytecode"
                );
            }
        }
        const deployment = ethers.utils.isAddress(address) ? "" : await get(contract);
        const contractAddress = ethers.utils.isAddress(address)
            ? address
            : deployment.implementation ?? deployment.address;
        const onchainBytecode = await provider.getCode(contractAddress);
        // console.log("onchain bytecode: ", await provider.getCode(contractAddress));
        // console.log();
        // console.log("expected deployedBytecode: ", deploymentObject.deployedBytecode);
        const sameLength = onchainBytecode.length === expectedBytecode.length;
        if (!sameLength) {
            logger.error(
                `Bytecode lengths DO NOT MATCH for the contract ${
                    ethers.utils.isAddress(contract) ? "" : contract
                } deployed at ${contractAddress}, chainId: ${
                    (await ethers.provider.getNetwork()).chainId
                }`
            );
            process.exit(0);
        }
        const isPair = expectedBytecode.length % 2 === 0;
        if (!isPair) {
            logger.error(
                `Bytecode lengths is not pair for the contract ${
                    ethers.utils.isAddress(contract) ? "" : contract
                } deployed at ${contractAddress}, chainId: ${
                    (await ethers.provider.getNetwork()).chainId
                }`
            );
            process.exit(0);
        }
        let N;
        if (sameLength && isPair) {
            for (let i = 2; i <= expectedBytecode.length; i += 2) {
                if (
                    onchainBytecode.slice(-i).slice(0, 2) !==
                    expectedBytecode.slice(-i).slice(0, 2)
                ) {
                    N = i - 2;
                    break;
                }
            }
            const U = N + 64;
            if (onchainBytecode.slice(0, -U) === expectedBytecode.slice(0, -U)) {
                logger.success(
                    `Bytecodes MATCH for the contract ${
                        ethers.utils.isAddress(contract) ? "" : contract
                    } deployed at ${contractAddress}, chainId: ${
                        (await ethers.provider.getNetwork()).chainId
                    }`
                );
            } else {
                logger.error(
                    `Bytecodes DO NOT MATCH for the contract ${
                        ethers.utils.isAddress(contract) ? "" : contract
                    } deployed at ${contractAddress}, chainId: ${
                        (await ethers.provider.getNetwork()).chainId
                    } at the track comparison ${U}`
                );
                logger.error(`at the track comparison ${U} and coincidence index ${N}`);
            }
        }
    });

task("utils:replace-tx", "Replace tx in mempool")
    .addParam("hash", "Replaced transaction hash", undefined, types.string)
    .addOptionalParam("newFrom", "New 'from' address")
    .addOptionalParam("newTo", "New 'to' address")
    .addOptionalParam("newGasPrice", "New gas prce")
    .addOptionalParam("newGasLimit", "New gas limit")
    .addOptionalParam("newMaxPriorityFee", "New maxPriorityFeePerGas")
    .addOptionalParam("newMaxFee", "New maxFeePerGas")
    .addOptionalParam("newData", "New data") // use 0x0 when canceling tx
    .addOptionalParam("newValue", "New value") // use 0x0 when canceling tx
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(
        async (
            {
                hash,
                newFrom,
                newTo,
                newGasPrice,
                newGasLimit,
                newMaxPriorityFee,
                newMaxFee,
                newData,
                newValue,
                signer,
            },
            hre
        ) => {
            const {
                ethers: { provider },
                ethers,
            } = hre;
            const pendingTx = await provider.getTransaction(hash);
            const signerAcc = (await hre.getNamedAccounts())[signer];
            const from = (newFrom ?? pendingTx.from).toLowerCase();
            if (signerAcc.toLowerCase() !== from) {
                logger.error(`'signer': ${signerAcc.toLowerCase()} !== 'from': ${from}`);
                return;
            }
            const deployerSigner = await ethers.getSigner(signerAcc);
            if (!pendingTx.blockNumber) {
                const replacementTx = {
                    nonce: pendingTx.nonce,
                    from,
                    to: (newTo ?? pendingTx.to).toLowerCase(),
                    data: newData ?? pendingTx.data,
                    value: newValue ?? pendingTx.value,
                    gasLimit: newGasLimit ?? pendingTx.gasLimit,
                    gasPrice: newGasPrice ?? pendingTx.gasPrice,
                    maxFeePerGas: newMaxFee ?? pendingTx.maxFeePerGas,
                    maxPriorityFeePerGas: newMaxPriorityFee ?? pendingTx.maxPriorityFeePerGas,
                };
                (await deployerSigner.sendTransaction(replacementTx)).wait();
            } else {
                logger.error(`Transaction ${hash} is already mined, co cannot be replaced`);
            }
        }
    );
// canceltx actually is a replacer of a transaction that we don't want to be confirmed
// when something goes wrong and we want to prevent the confirmation and we need to proceed fast.
// the prupose of this task is actually to replace with a dummy tx with higher gas price offering
// it is a special case of the utils:replace-tx task
task("canceltx", "Cancel tx in mempool")
    .addParam("signer", "Signer name: 'signer' or 'deployer", "deployer")
    .addOptionalParam("hash", "Transaction hash to cancel")
    // WARN: have at hand this number by making: const N = await provider.getTransactionCount(signer);
    // "N" will match the next nonce to be used
    .addOptionalParam("n", "Nonce of the transaction to cancel")
    .setAction(async ({ signer, hash, n }, hre) => {
        const {
            ethers: { provider },
            ethers,
        } = hre;
        const { AddressZero } = hre.ethers.constants;

        const signerAcc = (await hre.getNamedAccounts())[signer].toLowerCase();
        const deployerSigner = await ethers.getSigner(signerAcc);

        let nonce;
        if (!n) {
            logger.error("THERE IS A GREAT CHANCE YOUR TRANSACTION IS ALREADY MINED");
            logger.error("A DUMMY TX WITH THE EXPECTED NEXT NONCE WILL BE SENT");
            nonce = await provider.getTransactionCount(signerAcc);
        } else {
            nonce = n;
        }

        let newGasPrice;
        let newMaxFee;
        if (hash) {
            // Fetch the transaction details
            const tx = await provider.getTransaction(hash);
            if (tx) {
                if (tx.blockNumber) {
                    logger.error(`Transaction with hash ${hash} has already been mined.`);
                    return;
                }
                // Calculate new gas price (or max fee per gas for EIP-1559)
                const newGasPrice = tx.gasPrice ? tx.gasPrice.mul(3).div(2) : null;
                const newMaxFee = tx.maxFeePerGas ? tx.maxFeePerGas.mul(3).div(2) : null;
            }
        }

        if (!newGasPrice) {
            newGasPrice = (await provider.getFeeData()).gasPrice.mul(3).div(2);
        }

        if (!newMaxFee) {
            currentMaxFee = (await provider.getFeeData()).maxFeePerGas;
            newMaxFee = currentMaxFee ? currentMaxFee.mul(3).div(2) : null;
        }

        const replacementTx = {
            nonce: nonce,
            from: signerAcc,
            to: AddressZero,
            data: "0x",
            value: 0,
            gasLimit: 100000,
            gasPrice: newGasPrice,
        };
        if (newMaxFee) {
            replacementTx.maxFeePerGas = newMaxFee;
        }
        const dummyTx = await deployerSigner.sendTransaction(replacementTx);
        logger.info(`Dummy transaction hash successfully broadcated at: `);
        logger.info(dummyTx.hash);
        const dummyReceipt = await dummyTx.wait();

        logger.success(`Target transaction has been successfully cancelled.`);
    });
// droptx actually is a replacer of a transaction that we don't want to be confirmed
// when something goes wrong and we want to prevent the confirmation and we need to proceed fast.
// the prupose of this task is actually to replace with a dummy tx with higher gas price offering
// it is a special case of the utils:replace-tx task
// fastest, safest way of use:               $ hh droptx --n <Current-Tx-Count> --network <network>
task("droptx", "Cancel tx in mempool")
    .addParam("signer", "Signer name: 'signer' or 'deployer", "deployer")
    .addOptionalParam("hash", "Transaction hash to cancel")
    // WARN: have at hand this number by making: const N = await provider.getTransactionCount(signer);
    // "N" will match the next nonce to be used
    .addOptionalParam("n", "Nonce of the transaction to cancel")
    .setAction(async ({ signer, hash, n }, hre) => {
        const {
            ethers: { provider },
            ethers,
        } = hre;
        const { AddressZero } = hre.ethers.constants;

        const signerAcc = (await hre.getNamedAccounts())[signer].toLowerCase();
        const deployerSigner = await ethers.getSigner(signerAcc);

        let nonce;
        if (!n) {
            logger.error("THERE IS A GREAT CHANCE YOUR TRANSACTION IS ALREADY MINED");
            logger.error("A DUMMY TX WITH THE EXPECTED NEXT NONCE WILL BE SENT");
            nonce = await provider.getTransactionCount(signerAcc);
        } else {
            nonce = n;
        }

        let newGasPrice;
        let newMaxFee;
        if (hash) {
            // Fetch the transaction details
            const tx = await provider.getTransaction(hash);
            if (tx) {
                if (tx.blockNumber) {
                    logger.error(`Transaction with hash ${hash} has already been mined.`);
                    return;
                }
                // Calculate new gas price (or max fee per gas for EIP-1559)
                const newGasPrice = tx.gasPrice ? tx.gasPrice.mul(3).div(2) : null;
                const newMaxFee = tx.maxFeePerGas ? tx.maxFeePerGas.mul(3).div(2) : null;
            }
        }

        if (!newGasPrice) {
            newGasPrice = (await provider.getFeeData()).gasPrice.mul(3).div(2);
        }

        if (!newMaxFee) {
            currentMaxFee = (await provider.getFeeData()).maxFeePerGas;
            newMaxFee = currentMaxFee ? currentMaxFee.mul(3).div(2) : null;
        }

        const replacementTx = {
            nonce: nonce,
            from: signerAcc,
            to: AddressZero,
            data: "0x",
            value: 0,
            gasLimit: 100000,
            gasPrice: newGasPrice,
        };
        if (newMaxFee) {
            replacementTx.maxFeePerGas = newMaxFee;
        }
        const dummyTx = await deployerSigner.sendTransaction(replacementTx);
        logger.info(`Dummy transaction hash successfully broadcated at: `);
        logger.info(dummyTx.hash);
        const dummyReceipt = await dummyTx.wait();

        logger.success(`Target transaction has been successfully cancelled.`);
    });
// a task to use the GenericTokenSender.transferTokensUsingList function to distribute tokens
// way of use: $ hh utils:send-direct --currency USDC --path "./scripts/externalData/dist.csv" --network bobMainnet
// example of dryRun: while running in another terminal: $ npm run fork:rsk-mainnet-chained
// we do: $ export NETWORK_ID=30 && hh utils:send-direct --currency BPro --path ./scripts/externalData/example_native.csv --dry-run --network rskForkedMainnet --account 0x924f5ad34698fd20c90fe5d5a8a0abd3b42dc711
task("utils:send-direct", "Direct token sender script")
    .addOptionalParam("currency", "The currency type (e.g., WBTC, XUSD, POWA, SAT...)")
    .addParam("path", "The file path for addresses")
    .addParam("account", "The address of the account to use for signing the transaction")
    .addFlag("dryRun", "When present, the flag instructs the script to simulate the transaction")
    .addFlag(
        "native",
        "When present, the flag instructs the script to use the native currency and ignore the currency parameter"
    )
    .setAction(async ({ currency, path, account, dryRun, native }, hre) => {
        const { BigNumber } = require("ethers");
        // if native flag is not present, the currency parameter is required
        if (!native && !currency) {
            logger.error(
                "If the native asset is not distirbuted, the currency parameter is required"
            );
            return;
        }
        const { ethers } = hre;
        const { constants } = require("ethers");

        const testBlock = await ethers.provider.getBlock("latest");

        if (dryRun && (!hre.network.tags.forked || testBlock.number === 0)) {
            logger.error("Dry run is only available on live forked networks");
            logger.info("Please run in a separate terminal: $ npm run fork:xxx-mainnet-chained");
            logger.info("Where 'xxx' is the network name: bob, eth, bnb or rsk");
            return;
        }

        let signer = await getSignerFromAccount(hre, account);
        let signerAddress = signer._address;
        console.log("Signer address: ", signerAddress);

        // this action is only valid in RSK or BOB networks.
        // We will update on future deployments on Eth and Bnb networks.
        const netId = await ethers.provider.getNetwork().then((n) => n.chainId);
        console.log("Network ID: ", netId);
        if (netId === 1 || netId === 56) {
            logger.error("This action is only valid in RSK or BOB networks");
            return;
        }

        // GenericTokenSender contract address in BoB: 0x08429a6E565d7D3C15C40da30f1401b8985d71e3
        // GenericTokenSender contract address in RSK: 0x10DE444DE46E106eEF67f3793EE08cFf5297B0AA
        const GenericTokenSender = await ethers.getContract("GenericTokenSender", signer);
        const token = native ? constants.AddressZero : await ethers.getContract(currency, signer);
        const decimals = native ? 18 : await token.decimals();
        if (native) {
            currency = assetNamesByNetwork[netId.toString()];
        }
        console.log(`Decimals of ${currency} is: `, decimals);

        const balanceBefore = await signer.getBalance();
        let totalAmount = 0;

        // Data parsing
        const data = native
            ? await parseFileForSendDirect(path, 18)
            : await parseFileForSendDirect(path, decimals);
        totalAmount += data.totalAmount;
        console.log("Data successfully parsed");

        if (!native) {
            // check if signer hold enough assets and if so, send it to GenericTokenSender
            const balance = await token.balanceOf(signerAddress);
            const contractBalance = await token.balanceOf(GenericTokenSender.address);
            console.log("Sender's balance of token: ", balance.toString());
            console.log("GenericTokenSender's balance of token: ", contractBalance.toString());
            if (balance.add(contractBalance).lt(totalAmount)) {
                logger.error("Insufficient funds to distribute");
                return;
            }
            const amountToTransfer = BigNumber.from(totalAmount).sub(contractBalance);
            const transfer_tx = await token.transfer(GenericTokenSender.address, amountToTransfer);
            const transfer_receipt = await transfer_tx.wait();
            console.log("Token transferred");
            fs.writeFileSync(
                `./scripts/externalData/${currency}_distribution_initial_transfer.json`,
                JSON.stringify(transfer_receipt, null, 2),
                { flags: "w" }
            );

            // const approved = await token.allowance(signerAddress, GenericTokenSender.address);
            // console.log("Amount of token approved: ", approved.toString());
            // let tx_approval_receipt;
            // if (approved.lt(totalAmount)) {
            //     const tx_approval = await token.approve(GenericTokenSender.address, totalAmount);
            //     tx_approval_receipt = await tx_approval.wait();
            // }
            // console.log("Token approved");
            // fs.writeFileSync(
            //     `./scripts/externalData/${currency}_distribution_approval.json`,
            //     JSON.stringify(tx_approval_receipt, null, 2),
            //     { flags: "w" }
            // );
        } else {
            // check if signer hold enough assets and if so, send it to GenericTokenSender
            const balance = await signer.getBalance();
            const contractBalance = await ethers.provider.getBalance(GenericTokenSender.address);
            console.log("sender's balance of token: ", balance.toString());
            console.log("GenericTokenSender's balance of token: ", contractBalance.toString());
            if (balance.add(contractBalance).lt(totalAmount)) {
                logger.error("Insufficient funds to distribute");
                return;
            }
            const amountToTransfer = BigNumber.from(totalAmount).sub(contractBalance);
            const transfer_tx = await signer.sendTransaction({
                to: GenericTokenSender.address,
                value: amountToTransfer,
            });
            const transfer_receipt = await transfer_tx.wait();
            console.log("Native Asset transferred");
            fs.writeFileSync(
                `./scripts/externalData/${currency}_distribution_initial_transfer.json`,
                JSON.stringify(transfer_receipt, null, 2),
                { flags: "w" }
            );
        }

        const usersBalancesBefore = [];

        // Get the balances of the users before the distribution
        for (let i = 0; i < data.receivers.length; i++) {
            const balance = native
                ? await ethers.provider.getBalance(data.receivers[i])
                : await token.balanceOf(data.receivers[i]);
            usersBalancesBefore.push(balance);
        }

        const tx = await GenericTokenSender.transferTokensUsingList(
            !native ? token.address.toLowerCase() : token,
            data.receivers,
            data.amounts
        );
        const receiptTx = await tx.wait();
        console.log("Transaction hash:");
        console.log(tx.hash);
        console.log("Transaction gas used:");
        console.log(tx.gasUsed);
        fs.writeFileSync(
            `./scripts/externalData/${currency}_distribution_tx_receipt.json`,
            JSON.stringify(receiptTx, null, 2),
            { flags: "w" }
        );

        const usersBalancesAfter = [];

        // Get the balances of the users after the distribution
        for (let i = 0; i < data.receivers.length; i++) {
            const balance = native
                ? await ethers.provider.getBalance(data.receivers[i])
                : await token.balanceOf(data.receivers[i]);
            usersBalancesAfter.push(balance);
        }

        console.log("=======================================");
        console.log(`${currency} amount:`);
        // console.log(totalAmount / 10 ** decimals);
        console.log(ethers.utils.formatUnits(totalAmount, decimals).toString() * 1);

        const balanceAfter = await signer.getBalance();
        console.log("Execution cost:");
        // console.log((balanceBefore.sub(balanceAfter)) / 10 ** 18);
        console.log(
            ethers.utils.formatUnits(balanceBefore.sub(balanceAfter), "ether").toString() * 1
        );

        for (let i = 0; i < data.receivers.length; i++) {
            const diff = usersBalancesAfter[i] - usersBalancesBefore[i];
            const expectedDiff = data.amounts[i].toString();
            const matchDiff = diff == expectedDiff.toString();
            console.log("=======================================");
            console.log(`amount received by '${data.receivers[i]}',`);
            console.log(diff / 10 ** decimals);
            console.log("while the expected amount was:");
            console.log(data.amounts[i].toString() / 10 ** decimals);
            if (matchDiff) {
                console.log(`The expected amount matches for ${data.receivers[i]}`);
            } else {
                console.error(`The amounts DO NOT match for ${data.receivers[i]}`);
            }
        }
    });
// way of use: $ hh simulate-tx --tx-to <address> --tx-value <value> --tx-data <data> --tx-from <address> --tx-gas-limit <gas-limit> --tx-gas-price <gas-price> --tx-nonce <nonce> --url <url>
task("utils:simulate-tx", "Simulates a transaction on forked network")
    .addParam("txTo", "The address to send the transaction to")
    .addParam("txValue", "The value to send in the transaction")
    .addParam("txFrom", "The account to use to sign the transaction")
    .addParam("url", "The URL of the network to fork")
    .addParam("txData", "The data to include in the transaction")
    .addOptionalParam("txGasLimit", "The gas limit to set for the transaction")
    .addOptionalParam("txGasPrice", "The gas price to set for the transaction")
    .addOptionalParam("txNonce", "The nonce to set for the transaction")
    .setAction(async (taskArgs, hre) => {
        const { ethers } = hre;
        const tx = {
            to: taskArgs.txTo,
            value: ethers.utils.parseEther(taskArgs.txValue),
            data: taskArgs.txData,
            gasLimit: taskArgs.txGasLimit ? taskArgs.txGasLimit : undefined,
            gasPrice: taskArgs.txGasPrice ? taskArgs.txGasPrice : undefined,
            nonce: taskArgs.txNonce ? taskArgs.txNonce : undefined,
        };
        const origin_provider = new ethers.providers.JsonRpcProvider(taskArgs.url);
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: taskArgs.url,
                        blockNumber: (await origin_provider.getBlockNumber()) - 30,
                    },
                },
            ],
        });
        const {
            loadFixture,
            impersonateAccount,
            stopImpersonatingAccount,
            mine,
            time,
            setBalance,
            setCode,
            takeSnapshot,
        } = require("@nomicfoundation/hardhat-network-helpers");
        const getImpersonatedSigner = async (addressToImpersonate) => {
            await impersonateAccount(addressToImpersonate);
            return await ethers.getSigner(addressToImpersonate);
        };
        signer = await getImpersonatedSigner(taskArgs.txFrom);
        const balance = await ethers.provider.getBalance(signer.address);
        if (balance.eq(0)) {
            console.log(`Setting balance for address ${signer.address}...`);
            await setBalance(signer.address, ethers.utils.parseEther("1.0"));
        }
        // const signedTx = await signer.signTransaction(tx);
        const txResponse = await signer.sendTransaction(tx);
        const txReceipt = await txResponse.wait();
        console.log("Simulated Transaction hash: ", txResponse.hash);
        fs.writeFileSync("./txResponse.json", JSON.stringify(txResponse, null, 2), { flag: "w+" });
        fs.writeFileSync("./txReceipt.json", JSON.stringify(txReceipt, null, 2), { flag: "w+" });
    });
// way of use: $ hh utils:send-tx --network <network-according-hh-config> --tx-to <address> --tx-value <value> --tx-data <data> --tx-from <address> --tx-gas-limit <gas-limit> --tx-gas-price <gas-price> --tx-nonce <nonce> --simulate
task("utils:send-tx", "Creates and sends a raw transaction")
    .addParam("txTo", "address: The address to send the transaction to")
    .addParam("txValue", "number: The value to send in the transaction")
    .addParam("txData", "byte-string: The data to include in the transaction")
    .addFlag("simulate", "bolean: Simulate the transaction on forked network")
    .addOptionalParam("txFrom", "address: The account to use to sign the transaction")
    .addOptionalParam("txGasLimit", "number: The gas limit to set for the transaction")
    .addOptionalParam("txGasPrice", "number: The gas price to set for the transaction")
    .addOptionalParam("txNonce", "number: The nonce to set for the transaction")
    .setAction(async (taskArgs, hre) => {
        const { ethers } = hre;
        if (!taskArgs.txGasPrice) {
            taskArgs.txGasPrice = await ethers.provider.getGasPrice();
            console.log(
                `Current gas price: ${ethers.utils.formatUnits(taskArgs.txGasPrice, "gwei")} gwei`
            );
        }
        const tx = {
            to: taskArgs.txTo.toLowerCase(),
            value: ethers.utils.parseEther(taskArgs.txValue),
            data: taskArgs.txData.toLowerCase(),
            gasLimit: taskArgs.txGasLimit ? taskArgs.txGasLimit : undefined,
            gasPrice: taskArgs.txGasPrice ? taskArgs.txGasPrice : undefined,
            nonce: taskArgs.txNonce ? taskArgs.txNonce : undefined,
        };
        let signer;
        if (taskArgs.txFrom) {
            const accounts = await ethers.getSigners();
            signer = accounts.find(
                (account) => account.address.toLowerCase() === taskArgs.txFrom.toLowerCase()
            );
            if (!signer || taskArgs.simulate) {
                console.log(`simulating on forked network...`);
                const command =
                    "hh simulate-tx " +
                    `--tx-to ${tx.to} ` +
                    `--tx-value ${tx.value} ` +
                    `--tx-from ${taskArgs.txFrom} ` +
                    `--url ${network.config.url} ` +
                    `--tx-data ${tx.data} ` +
                    `${taskArgs.txGasLimit ? `--tx-gas-limit ${tx.gasLimit}` : ""} ` +
                    `${taskArgs.txGasPrice ? `--tx-gas-price ${tx.gasPrice}` : ""} ` +
                    `${taskArgs.txNonce ? `--tx-nonce ${tx.nonce}` : ""}`;
                console.log(`Running command: ${command}`);
                try {
                    // Run the child task synchronously
                    const output = execSync(command, { stdio: "inherit" });
                    console.log(`Child task completed successfully.`);
                } catch (error) {
                    console.error(`Error executing child task: ${error.message}`);
                }
                return;
            } else if (signer && !taskArgs.simulate) {
                console.log(
                    `WARINIG: REAL TRANSACTION;\n Address ${taskArgs.txFrom} found in wallet, sending transaction...`
                );
                // const signedTx = await ethers.provider.getSigner().signTransaction(tx);
                const txResponse = await signer.sendTransaction(tx);
                console.log("Transaction hash: ", txResponse.hash);
                const txReceipt = await txResponse.wait();
                fs.writeFileSync("./txResponse.json", JSON.stringify(txResponse, null, 2), {
                    flag: "w+",
                });
                fs.writeFileSync("./txReceipt.json", JSON.stringify(txReceipt, null, 2), {
                    flag: "w+",
                });
                return;
            }
        } else {
            signer = await ethers.provider.getSigner();
            if (taskArgs.simulate) {
                console.log("simulating on forked network...");
                const command =
                    "hh simulate-tx " +
                    `--tx-to ${tx.to} ` +
                    `--tx-value ${tx.value} ` +
                    `--tx-from ${taskArgs.txFrom} ` +
                    `--url ${network.config.url} ` +
                    `--tx-data ${tx.data} ` +
                    `${taskArgs.txGasLimit ? `--tx-gas-limit ${tx.gasLimit}` : ""} ` +
                    `${taskArgs.txGasPrice ? `--tx-gas-price ${tx.gasPrice}` : ""} ` +
                    `${taskArgs.txNonce ? `--tx-nonce ${tx.nonce}` : ""}`;
                try {
                    // Run the child task synchronously
                    const output = execSync(command, { stdio: "inherit" });
                    console.log(`Child task completed successfully.`);
                } catch (error) {
                    console.error(`Error executing child task: ${error.message}`);
                }
                return;
            } else {
                console.log(
                    "WARINIG: REAL TRANSACTION;\n No address provided, sending transaction from account[0]..."
                );
                const signedTx = await signer.signTransaction(tx);
                const txResponse = await ethers.provider.sendTransaction(signedTx);
                const txReceipt = await txResponse.wait();
                console.log("Transaction hash: ", txResponse.hash);
                fs.writeFileSync("./txResponse.json", JSON.stringify(txResponse, null, 2), {
                    flag: "w+",
                });
                fs.writeFileSync("./txReceipt.json", JSON.stringify(txReceipt, null, 2), {
                    flag: "w+",
                });
                return;
            }
        }
    });
// way of use: $ hh data-parser --abi <abi> --params <params>
task("utils:data-parser", "Encode data into abi format")
    .addParam("abi", "must follow the following syntax: 'function functionName(type1,type2,...)'")
    .addParam("params", "A single string wit comma separated values")
    .setAction(async (taskArgs, hre) => {
        const { ethers } = hre;
        const iface = new ethers.utils.Interface([taskArgs.abi]);
        const regex = /function\s+(\w+)\s*\(.*\)/;
        const match = taskArgs.abi.match(regex);
        let fName = "";
        // convert params to array
        const params = taskArgs.params.split(",");
        // JSON parse each parameter from params
        params.forEach((param, index) => {
            try {
                const x = JSON.parse(param);
                // if JSON parse is successful, convert param into ethers BigNumber
                params[index] = ethers.BigNumber.from(x);
                // console.log(`Parsed parameter for index ${index}: `, params[index]);
            } catch (e) {
                params[index] = param.toLowerCase();
                // console.log(`Parsed parameter for index ${index}: `, params[index]);
            }
        });
        if (match && match[1]) {
            fName = match[1];
            const data = iface.encodeFunctionData(fName, params);
            console.log("\n\nEncoded data: \n\n", data, "\n\n");
        } else {
            console.log("Invalid ABI syntax");
        }
    });
// way of use: $ hh unit-parser --unit <unit> --decimals <decimals>
task("utils:unit-parser", "Parse unit from string")
    .addParam("unit", "The unit to parse")
    .addParam("decimals", "The number of decimals")
    .setAction(async (taskArgs, hre) => {
        const { ethers } = hre;
        const unit = taskArgs.unit;
        const decimals = taskArgs.decimals;
        const unitParsed = ethers.utils.parseUnits(unit, decimals);
        console.log("Unit parsed: ", unitParsed.toString());
    });
// way of use: $ hh zero-padder --arg <arg> --bytes <number-of-bytes>
task("utils:zero-padder", "Pad an argument with zeros")
    .addParam("arg", "The argument to pad")
    .addParam("bytes", "The length of the argument after padding")
    .setAction(async (taskArgs, hre) => {
        const { ethers } = hre;
        const arg = taskArgs.arg.toLowerCase();
        const bytesLength = taskArgs.bytes;
        const paddedArg = ethers.utils.hexZeroPad(arg, bytesLength);
        console.log("Padded argument: ", paddedArg);
    });
