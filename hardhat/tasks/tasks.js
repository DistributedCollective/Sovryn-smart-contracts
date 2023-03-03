const { task } = require("hardhat/config");

// const { ethers } = hre;
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
/// this is for use with ethers.js
task("accounts", "Prints the list of accounts", async () => {
    const {
        ethers,
        getNamedAccounts,
        deployments: { get, getNetworkName },
    } = hre;
    const accounts = await ethers.getSigners();
    console.log(accounts);

    for (const account of accounts) {
        const wallet = ethers.Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0"
        );

        console.log(account.address);
    }
});
