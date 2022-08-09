const { task } = require("hardhat/config");
const { deploymentToABI } = require("../helpers");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
/// this is for use with ethers.js
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const { ethers } = hre;
    const accounts = await ethers.getSigners();

    for (const account of accounts.address) {
        const wallet = ethers.Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0"
        );

        console.log(account);
    }
});

task("hello", "Prints 'Hello, World!'", async (taskArgs, hre) => {
    const { ethers } = hre;
    console.log("Hello, World! From chainId: ", (await ethers.provider.getNetwork()).chainId);
});

task(
    "legacy-deployments-to-hardhat",
    "Converts legacy deployment data to minimal hardhat-deploy",
    async (taskArgs, hre) => {
        const mainnet_contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const testnet_contracts = require("../../scripts/contractInteraction/testnet_contracts.json");

        const {
            deployments: { getOrNull, save: saveDeployment },
            ethers,
            network,
        } = hre;
        const chainId = (await ethers.provider.getNetwork()).chainId;
        console.log(
            "Initializing network deployments in hh format:",
            network.name,
            "id: ",
            chainId,
            "..."
        );
        const noDeployNorArtifacts = {};
        const conflictABIs = {};
        const deploymentsCreated = {};
        const deploymentsExist = {};
        const legacyNoAddress = {};
        const legacyContractsList =
            network.name == "rskSovrynMainnet"
                ? mainnet_contracts
                : network.name == "rskSovrynTestnet"
                ? testnet_contracts
                : "";
        for (const key in legacyContractsList) {
            if (!ethers.utils.isAddress(legacyContractsList[key].toLowerCase())) {
                legacyNoAddress[key] = legacyContractsList[key];
                continue;
            }
            let contract = await getOrNull(key);
            let gotArtifact = true;
            let contractArtifact;
            try {
                const contractName = deploymentToABI[key];
                //if (contractName) console.log(key, "->", contractName);
                contractArtifact = contractName
                    ? await deployments.getArtifact(contractName)
                    : await deployments.getArtifact(key);
            } catch (e) {
                gotArtifact = false;
            }
            if (contract == null) {
                if (!gotArtifact) {
                    noDeployNorArtifacts[key] = legacyContractsList[key];
                    continue;
                } else {
                    await saveDeployment(key, {
                        address: legacyContractsList[key],
                        abi: contractArtifact.abi,
                    });
                    deploymentsCreated[key] = legacyContractsList[key];
                }
            } else if (
                gotArtifact &&
                JSON.stringify(contract.abi) != JSON.stringify(contractArtifact.abi)
            )
                conflictABIs[key] = legacyContractsList[key];
            else {
                deploymentsExist[key] = legacyContractsList[key];
            }
        }
        if (Object.keys(deploymentsExist).length !== 0)
            console.log("Invalid legacy deployment address: \n", legacyNoAddress);
        if (Object.keys(deploymentsExist).length !== 0)
            console.log("Deployments exist: \n", deploymentsExist);
        if (Object.keys(deploymentsCreated).length !== 0)
            console.log("Deployments created: \n", deploymentsCreated);
        if (Object.keys(conflictABIs).length !== 0)
            console.log(
                "Conflicting ABIs artifact vs deployment, resolve manually: \n",
                conflictABIs
            );
        if (Object.keys(noDeployNorArtifacts).length !== 0)
            console.log("No artifacts nor deployment: \n", noDeployNorArtifacts);
    }
);
