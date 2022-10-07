const { ethers } = require("hardhat");
const { provider, utils, BigNumber } = ethers;


// This data deploys the mutex contract as it exists in the commit ddd1acdd6f29ae18f4e4f563856c29a15148d95a
const SAVED_DEPLOY_DATA = {
    serializedDeployTx: '0xf9010e808502540be400830156058080b8bc6080604052348015600f57600080fd5b50609e8061001e6000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80633fa4f245146037578063ed04e1c314604f575b600080fd5b603d6055565b60408051918252519081900360200190f35b603d605b565b60005481565b60008054600101908190559056fea265627a7a72315820f79c4407b7526ade841bbdb3d7f3e3b304b0c37a6b8cc3e6b125622b7535c99164736f6c634300051100321ba06d757465786d757465786d757465786d757465786d757465786d757465786d75a06d757465786d757465786d757465786d757465786d757465786d757465786d75',
    deployerAddress: '0xc66eFf2ED65C1877b8C6ECBed38A6a8AB3640f3d',
    contractAddress: '0xc783106a68d2Dc47b443C20067448a9c53121207',
    transactionCostWei: BigNumber.from(875570000000000)
}


/**
 * Deploy the Mutex contract in the precalculated address
 * @returns {Promise<void>}
 */
const getOrDeployMutex = async () => {
    const {
        serializedDeployTx,
        deployerAddress,
        contractAddress,
        transactionCostWei,
    } = SAVED_DEPLOY_DATA;
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
            value: transactionCostWei,
        })
        await tx.wait();
    }

    const tx = await provider.sendTransaction(serializedDeployTx);
    await tx.wait();
    return Mutex.attach(contractAddress);
}

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
    const { data: bytecode } = await Mutex.getDeployTransaction()

    // vrs are set deterministically to make sure no one knows the private key of the
    const signature = {
        v: 27, // must not be eip-155 to allow cross-chain deployments
        // "mutex" in hex: 6d75746578
        //  0xm u t e x m u t e x m u t e x m u t e x m u t e x m u t e x m u
        r: "0x6d757465786d757465786d757465786d757465786d757465786d757465786d75",
        s: "0x6d757465786d757465786d757465786d757465786d757465786d757465786d75",
    }

    // calculated what deploying the contract actually requires
    const gasLimit = await provider.estimateGas({ data: bytecode });

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
    }
}


module.exports = {
    getOrDeployMutex,
    createMutexDeployTransaction,
    SAVED_DEPLOY_DATA
}