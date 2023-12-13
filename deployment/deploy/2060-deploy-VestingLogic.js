const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const col = require("cli-color");
const { sendWithMultisig } = require("../helpers/helpers");
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners(); //
    let totalGas = ethers.BigNumber.from(0);

    // Deploy vestingLogic //
    log(col.bgYellow("Deploying VestingLogic..."));
    await deploy("VestingLogic", {
        from: deployer,
        args: [],
        log: true,
        contract: "VestingLogic",
    });

    const vestingLogicDeployment = await get("VestingLogic");

    // Deploy vestingFactory //
    log(col.bgYellow("Deploying VestingFactory..."));
    await deploy("VestingFactory", {
        from: deployer,
        args: [vestingLogicDeployment.address],
        log: true,
        contract: "VestingFactory",
    });

    const vestingFactoryDeployment = await get("VestingFactory");
    const vestingRegistry = await ethers.getContract("VestingRegistry");
    const staking = await ethers.getContract("Staking");

    /** VestingRegistry still owned by Exchequer for Mainnet & tetstnet */
    const multisigDeployment = await get("MultiSigWallet");
    const data = vestingRegistry.interface.encodeFunctionData("setVestingFactory", [
        vestingFactoryDeployment.address,
    ]);
    log(
        col.bgYellow(
            "Generating multisig transaction to set the new vestingFactory contract in vestingRegistry..."
        )
    );
    await sendWithMultisig(multisigDeployment.address, vestingRegistry.address, data, deployer);
    log(
        col.bgBlue(
            `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
        )
    );

    if (hre.network.tags["testnet"]) {
        const dataAddContractCodeHash = staking.interface.encodeFunctionData(
            "addContractCodeHash",
            [vestingLogicDeployment.address]
        );
        log(
            col.bgYellow(
                "Generating multisig transaction to add codeHash of new vestingLogic in staking contract..."
            )
        );
        await sendWithMultisig(
            multisigDeployment.address,
            staking.address,
            dataAddContractCodeHash,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );
    } else if (hre.network.tags["mainnet"]) {
        log(
            col.bgBlue(
                "Prepare and run SIP function in sips.js to create the proposal with params: getArgsSipSov625"
            )
        );
    }
};
func.tags = ["DeployVestingLogic"];
module.exports = func;
