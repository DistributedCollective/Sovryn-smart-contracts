const { ethers } = require("hardhat");
const { provider, utils, BigNumber } = ethers;

// This data deploys the mutex contract as it exists in the commit ddd1acdd6f29ae18f4e4f563856c29a15148d95a
const SAVED_DEPLOY_DATA = {
    serializedDeployTx:
        "0xf9010e808502540be400830179f98080b8bc6080604052348015600f57600080fd5b50609e8061001e6000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80633fa4f245146037578063ed04e1c314604f575b600080fd5b603d6055565b60408051918252519081900360200190f35b603d605b565b60005481565b60008054600101908190559056fea265627a7a72315820f79c4407b7526ade841bbdb3d7f3e3b304b0c37a6b8cc3e6b125622b7535c99164736f6c634300051100321ba06d757465786d757465786d757465786d757465786d757465786d757465786d75a06d757465786d757465786d757465786d757465786d757465786d757465786d75",
    deployerAddress: "0xeF09929A478dEc70E3AF6b8F396C9aC173Cb58D8",
    contractAddress: "0xba10edD6ABC7696Eae685839217BdcC42139612b",
    transactionCostWei: BigNumber.from(967610000000000),
};

/**
 * Deploy the Mutex contract in the precalculated address
 * @returns {Promise<void>}
 */
const getOrDeployMutex = async () => {
    const { serializedDeployTx, deployerAddress, contractAddress, transactionCostWei } =
        SAVED_DEPLOY_DATA;
    const Mutex = await ethers.getContractFactory("Mutex");
    const deployedCode = await provider.getCode(contractAddress);
    if (deployedCode.replace(/0+$/) !== "0x") {
        // Contract is deployed
        // it's practically impossible to deploy to this address with malicious bytecode so we don't need to check
        return Mutex.attach(contractAddress);
    }

    // Not deployed, we need to deploy

    // Fund the account
    const deployerBalance = await provider.getBalance(deployerAddress);
    if (deployerBalance.lt(transactionCostWei)) {
        const requiredBalance = transactionCostWei.sub(deployerBalance);
        const whale = (await ethers.getSigners())[0];
        const tx = await whale.sendTransaction({
            to: deployerAddress,
            value: requiredBalance,
        });
        await tx.wait();
    }

    const tx = await provider.sendTransaction(serializedDeployTx);
    await tx.wait();
    return Mutex.attach(contractAddress);
};

/**
 * Create transaction that deploys Mutex to the same static address in all chains using Nick's method,
 * like with ERC1820Registry.
 *
 * Use this method to create the transaction the first time. After that, we can use the hardcoded address
 * and serialized deploy transaction
 *
 * Returns an object containing the transaction and related metadata.
 *
 * @returns {Promise<*>}
 */
async function createMutexDeployTransaction() {
    const Mutex = await ethers.getContractFactory("Mutex");
    const { data: bytecode } = await Mutex.getDeployTransaction();

    // vrs are set deterministically to make sure no one knows the private key of the
    const signature = {
        v: 27, // must not be eip-155 to allow cross-chain deployments
        // "mutex" in hex: 6d75746578
        //  0xm u t e x m u t e x m u t e x m u t e x m u t e x m u t e x m u
        r: "0x6d757465786d757465786d757465786d757465786d757465786d757465786d75",
        s: "0x6d757465786d757465786d757465786d757465786d757465786d757465786d75",
    };

    // NOTE: the Hardhat gas estimation fails here.
    // Calling estimateGas against the real RSK network returned 96761 as the gas
    // limit, whereas this method only returned 87557.
    // Thus, we will have to hardcode.
    const hardhatGasLimit = await provider.estimateGas({ data: bytecode });
    const gasLimit = BigNumber.from(96761);
    if (hardhatGasLimit.gt(gasLimit)) {
        throw new Error(
            `Hardhat estimates the gas limit as ${hardhatGasLimit.toString()}, ` +
                `which is higher than the hardcoded gas limit ${gasLimit.toString()}`
        );
    }

    // 10 gwei, should be enough to also mine on other chains. Could also be 100 like with erc1820
    const gasPrice = BigNumber.from(10000000000);

    const transactionCostWei = gasLimit.mul(gasPrice);

    const deployTx = {
        data: bytecode, // We could hardcode this too
        nonce: 0,
        gasLimit,
        gasPrice,
    };

    const serializedDeployTx = utils.serializeTransaction(deployTx, signature);
    const parsedDeployTx = utils.parseTransaction(serializedDeployTx);
    const contractAddress = ethers.utils.getContractAddress(parsedDeployTx);
    const deployerAddress = parsedDeployTx.from;

    return {
        serializedDeployTx,
        deployerAddress,
        contractAddress,
        transactionCostWei,
    };
}

/**
 * Create transaction that deploys LoanIdMutex to the same static address in all chains using Nick's method,
 * like with ERC1820Registry and Mutex.
 *
 * Use this method to create the transaction the first time. After that, we can use the hardcoded address
 * and serialized deploy transaction
 *
 * Returns an object containing the transaction and related metadata.
 *
 * @returns {Promise<*>}
 */
async function createLoanIdMutexDeployTransaction() {
    const LoanIdMutex = await ethers.getContractFactory("LoanIdMutex");
    const { data: bytecode } = await LoanIdMutex.getDeployTransaction();

    // vrs are set deterministically to make sure no one knows the private key
    const signature = {
        v: 27, // must not be eip-155 to allow cross-chain deployments
        // "mutex" in hex: 6d75746578
        //  0xm u t e x m u t e x m u t e x m u t e x m u t e x m u t e x m u
        r: "0x6d757465786d757465786d757465786d757465786d757465786d757465786d75",
        s: "0x6d757465786d757465786d757465786d757465786d757465786d757465786d75",
    };

    // Estimate gas - may need to be adjusted based on actual deployment
    const hardhatGasLimit = await provider.estimateGas({ data: bytecode });
    // Adding buffer for safety - LoanIdMutex is slightly larger than Mutex
    const gasLimit = hardhatGasLimit.mul(120).div(100); // 20% buffer

    console.log(`Estimated gas limit for LoanIdMutex: ${hardhatGasLimit.toString()}`);
    console.log(`Using gas limit: ${gasLimit.toString()}`);

    // 0.06 gwei, the minimum gas price for RSK
    // RSK has a much lower gas price cap than Ethereum
    const gasPrice = BigNumber.from(60000000);

    const transactionCostWei = gasLimit.mul(gasPrice);

    const deployTx = {
        data: bytecode,
        nonce: 0,
        gasLimit,
        gasPrice,
    };

    const serializedDeployTx = utils.serializeTransaction(deployTx, signature);
    const parsedDeployTx = utils.parseTransaction(serializedDeployTx);

    // Recover the deployer address from the signature
    // parseTransaction doesn't always populate the 'from' field automatically
    const deployerAddress =
        parsedDeployTx.from ||
        utils.recoverAddress(utils.keccak256(utils.serializeTransaction(deployTx)), {
            r: signature.r,
            s: signature.s,
            v: signature.v,
        });

    // Calculate contract address from deployer and nonce
    const contractAddress = ethers.utils.getContractAddress({
        from: deployerAddress,
        nonce: deployTx.nonce,
    });

    console.log("=".repeat(80));
    console.log("LoanIdMutex Deployment Transaction Created");
    console.log("=".repeat(80));
    console.log("Deployer Address:", deployerAddress);
    console.log("Contract Address:", contractAddress);
    console.log("Transaction Cost (wei):", transactionCostWei.toString());
    console.log("Serialized TX:", serializedDeployTx);
    console.log("=".repeat(80));
    console.log("\nUpdate LOAN_ID_MUTEX_DEPLOY_DATA with these values!");
    console.log("Also update LoanIdGuard.sol with the contract address:", contractAddress);
    console.log("=".repeat(80));

    return {
        serializedDeployTx,
        deployerAddress,
        contractAddress,
        transactionCostWei,
    };
}

// TODO: After running createLoanIdMutexDeployTransaction(), update this object
// with the actual values. This is a placeholder.
const LOAN_ID_MUTEX_DEPLOY_DATA = {
    serializedDeployTx:
        "0xf9020080840393870083028cac8080b901ae608060405234801561001057600080fd5b5061018e806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c806347378145146100465780639c552f1814610075578063a65355c614610094575b600080fd5b6100636004803603602081101561005c57600080fd5b50356100b1565b60408051918252519081900360200190f35b6100926004803603602081101561008b57600080fd5b50356100c3565b005b610063600480360360208110156100aa57600080fd5b5035610125565b60009081526020819052604090205490565b600081815260208190526040902054438114156101115760405162461bcd60e51b81526004018080602001828103825260228152602001806101386022913960400191505060405180910390fd5b506000908152602081905260409020439055565b6000602081905290815260409020548156fe6c6f616e20494420616c7265616479207573656420696e207468697320626c6f636ba265627a7a72315820ebff2c630aa6681a6b8cbfa58464f339e9ee1f74b7641ba5e11cfe159558ed2d64736f6c634300051100321ba06d757465786d757465786d757465786d757465786d757465786d757465786d75a06d757465786d757465786d757465786d757465786d757465786d757465786d75",
    deployerAddress: "0x3e0ADE2E321E455cDcC164bc13F78f167194c66e",
    contractAddress: "0x6B8F44710CdCC7D5A5F60a3665F7B181Cda7ED27",
    transactionCostWei: BigNumber.from(10025040000000),
};

/**
 * Deploy the LoanIdMutex contract at the precalculated address
 * @returns {Promise<*>}
 */
const getOrDeployLoanIdMutex = async () => {
    const { serializedDeployTx, deployerAddress, contractAddress, transactionCostWei } =
        LOAN_ID_MUTEX_DEPLOY_DATA;
    const LoanIdMutex = await ethers.getContractFactory("LoanIdMutex");
    const deployedCode = await provider.getCode(contractAddress);

    if (deployedCode.replace(/0+$/) !== "0x") {
        // Contract is deployed
        return LoanIdMutex.attach(contractAddress);
    }

    // Not deployed, we need to deploy
    console.log("Loan id mutex not deployed, deploying...");
    const deployerBalance = await provider.getBalance(deployerAddress);
    if (deployerBalance.lt(transactionCostWei)) {
        const requiredBalance = transactionCostWei.sub(deployerBalance);
        const whale = (await ethers.getSigners())[0];
        const tx = await whale.sendTransaction({
            to: deployerAddress,
            value: requiredBalance,
        });
        await tx.wait();
    }

    const tx = await provider.sendTransaction(serializedDeployTx);
    await tx.wait();
    return LoanIdMutex.attach(contractAddress);
};

module.exports = {
    getOrDeployMutex,
    createMutexDeployTransaction,
    SAVED_DEPLOY_DATA,
    getOrDeployLoanIdMutex,
    createLoanIdMutexDeployTransaction,
    LOAN_ID_MUTEX_DEPLOY_DATA,
};
