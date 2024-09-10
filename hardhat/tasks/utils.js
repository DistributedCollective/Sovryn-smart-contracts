const fs = require("fs");
const csv = require("csv-parser");
const { task } = require("hardhat/config");
const Logs = require("node-logs");
/*const {
    signWithMultisig,
    multisigCheckTx,
    multisigRevokeConfirmation,
    multisigExecuteTx,
    multisigAddOwner,
    multisigRemoveOwner,
} = require("../../deployment/helpers/helpers");*/

const currencies = {
    eth: "0x0000000000000000000000000000000000000000",
    usdc: "0xe75d0fb2c24a55ca1e3f96781a2bcc7bdba058f0",
    usdt: "0x05d032ac25d322df992303dca074ee7392c117b9",
    dai: "0x6c851f501a3f24e29a8e39a29591cddf09369080",
    wbtc: "0x03c7054bcb39f7b2e5b2c7acb37583e32d70cfa3",
    weth: "0x4200000000000000000000000000000000000006", // or... may be: 0x148964f7E4f96d347528467BFe8Bff36a953ba60 (ERC20) or 0x140c1A044D7d6650b73D4045b5ea1D2AD4666c2B (ERC-721)
    sov: "0xba20a5e63eeEFfFA6fD365E7e540628F8fC61474",
    // xusd: "0x", // not found in BOB mainnet
    powa: "0xd0c2f08a873186db5cfb7b767db62bef9e495bff",
    sat: "0x78fea795cbfcc5ffd6fb5b845a4f53d25c283bdb",
    tbtc: "0xbba2ef945d523c4e2608c9e1214c2cc64d4fc2e2",
    reth: "0xb5686c4f60904ec2bda6277d6fe1f7caa8d1b41a",
    alex: "0xa669e059fdcbdfc532a2edd658eb2922799eedb8",
    dllr: "0xf3107eec1e6f067552c035fd87199e1a5169cb20",
    wsteth: "0x85008ae6198bc91ac0735cb5497cf125ddaac528",
    // stone: "0x",
};

const logger = new Logs().showInConsole(true);

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
                newMaxFee,
                newMaxPriorityFee,
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

// functions to parse distribution .csv files on NATIVE coin
async function parseFileNATIVE(fileName) {
    console.log(fileName);
    let totalAmount = 0;
    let receivers = [];
    let amounts = [];
    let errorMsg = "";

    return new Promise((resolve, reject) => {
        fs.createReadStream(fileName)
            .pipe(csv())
            .on("data", (row) => {
                const tokenOwner = row[0].trim();
                let rawAmount = row[1].trim();
                let amountStr = rawAmount.replace(",", "").replace(".", "").replace(" ", "");

                if (parseInt(amountStr, 10) !== parseInt(rawAmount, 10)) {
                    errorMsg += `\n${tokenOwner} amount: ${rawAmount}`;
                }

                const amount = parseInt(amountStr, 10);
                totalAmount += amount;

                receivers.push(tokenOwner);
                amounts.push(amount);

                console.log("=======================================");
                console.log(`'${tokenOwner}',`);
                console.log(amount);
            })
            .on("end", () => {
                console.log(receivers);
                console.log(amounts);

                if (errorMsg !== "") {
                    reject(new Error(`Formatting error: ${errorMsg}`));
                } else {
                    resolve({
                        totalAmount,
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

// functions to parse distribution .csv files on ERC20 token
async function parseFile(fileName, multiplier) {
    console.log(fileName);
    let totalAmount = 0;
    let receivers = [];
    let amounts = [];
    let errorMsg = "";

    return new Promise((resolve, reject) => {
        fs.createReadStream(fileName)
            .pipe(csv())
            .on("data", (row) => {
                const tokenOwner = row[0].trim();
                const amountStr = row[1].trim();
                const decimals = amountStr.split(".");

                if (decimals.length !== 2 || decimals[1].length !== 2) {
                    errorMsg += `\n${tokenOwner} amount: ${amountStr}`;
                }

                let amount = amountStr.replace(",", "").replace(".", "");
                amount = parseInt(amount, 10) * multiplier;
                totalAmount += amount;

                receivers.push(tokenOwner);
                amounts.push(amount);

                console.log("=======================================");
                console.log(`'${tokenOwner}',`);
                console.log(amount);
            })
            .on("end", () => {
                console.log(receivers);
                console.log(amounts);

                if (errorMsg !== "") {
                    reject(new Error(`Formatting error: ${errorMsg}`));
                } else {
                    resolve({
                        totalAmount,
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

// a task to use the GenericTokenSender.transferTokensUsingList function to distribute tokens
// way of use: $ hh sendDirect --currency=USDC --path=./scripts/externalData/dist.csv --dryrun=false --multiplier=10*16 --network bobMainnet
task("sendDirect", "Direct token sender script")
    .addParam(
        "currency",
        "The currency type (e.g., NATIVE, USDC, USDT, DAI, WBTC, WETH, SOV, XUSD, POWA, SAT)"
    )
    .addParam("path", "The file path for addresses")
    .addParam("dryrun", "Whether to do a SIMULATION or not")
    .addParam("multiplier", "The multiplier for token amounts", 10 * 16, types.int)
    .setAction(async ({ currency, path, dryrun, multiplier }, hre) => {
        const { ethers } = hre;

        const acct = (await ethers.getSigners())[0]; // Use the first signer from ethers

        const GenericTokenSender = await ethers.getContract("GenericTokenSender");

        const balanceBefore = await acct.getBalance();
        let totalAmount = 0;

        // Data parsing
        const data =
            currency === "NATIVE"
                ? await parseFileNATIVE(path)
                : await parseFile(path, multiplier);
        totalAmount += data.totalAmount;

        // Check if the currency exists in the currencies object
        if (currency !== "NATIVE" && !currencies.hasOwnProperty(currency)) {
            throw new Error(
                `Currency "${currency}" not found in the supported currencies list. Please check for typos or add the currency.`
            );
        }

        // Dry run check
        if (!dryrun) {
            const tx = await GenericTokenSender.transferTokensUsingList(
                currency !== "NATIVE"
                    ? currencies[currency.toLowerCase()]
                    : ethers.constants.AddressZero,
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
        } else {
            // MISSING SCRIPT TO SIMULATE TRANSACTION
        }

        console.log("=======================================");
        console.log(`${currency} amount:`);
        console.log(totalAmount / 10 ** 18);

        const balanceAfter = await conf.acct.getBalance();
        console.log("Execution cost:");
        console.log((balanceBefore - balanceAfter) / 10 ** 18);
    });

// way of use: $ hh simulate-tx --tx-to <address> --tx-value <value> --tx-data <data> --tx-from <address> --tx-gas-limit <gas-limit> --tx-gas-price <gas-price> --tx-nonce <nonce> --url <url>
task("simulate-tx", "Simulates a transaction on forked network")
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
// way of use: $ hh send-tx --network <network-according-hh-config> --tx-to <address> --tx-value <value> --tx-data <data> --tx-from <address> --tx-gas-limit <gas-limit> --tx-gas-price <gas-price> --tx-nonce <nonce> --simulate
task("send-tx", "Creates and sends a raw transaction")
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
            } else if (signer && !simulate) {
                console.log(
                    `WARINIG: REAL TRANSACTION;\n Address ${taskArgs.txFrom} found in wallet, sending transaction...`
                );
                const signedTx = await ethers.provider.getSigner().signTransaction(tx);
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
task("data-parser", "Encode data into abi format")
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
task("unit-parser", "Parse unit from string")
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
task("zero-padder", "Pad an argument with zeros")
    .addParam("arg", "The argument to pad")
    .addParam("bytes", "The length of the argument after padding")
    .setAction(async (taskArgs, hre) => {
        const { ethers } = hre;
        const arg = taskArgs.arg.toLowerCase();
        const bytesLength = taskArgs.bytes;
        const paddedArg = ethers.utils.hexZeroPad(arg, bytesLength);
        console.log("Padded argument: ", paddedArg);
    });
