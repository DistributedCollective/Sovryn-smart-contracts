const { deployWithCustomProxy } = require("../helpers/helpers");
const { sendWithMultisig } = require("../helpers/helpers");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const func = async function (hre) {
    const {
        deployments: { get, getOrNull },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();
    await logger.warn("Deploying FeeSharingCollector...");
    await deployWithCustomProxy(
        deployer,
        "FeeSharingCollector",
        "FeeSharingCollectorProxy",
        "",
        "FeeSharingCollector_Proxy",
        true,
        [],
        [(await get("SovrynProtocol")).address, (await get("StakingProxy")).address]
    );

    const feeSharingCollector = await ethers.getContract("FeeSharingCollector");
    const multisigDeployment = await get("MultiSigWallet");
    const multisigAddress = multisigDeployment.address;

    // This script generates multisig txs only when multisig controls FeeSharingCollector.
    if ((await feeSharingCollector.owner()).toLowerCase() !== multisigAddress.toLowerCase()) {
        await logger.warn(
            `Skipping addProtocolWithholdToken multisig tx generation: owner (${await feeSharingCollector.owner()}) is not multisig (${multisigAddress}).`
        );
        return;
    }

    const wrbtcToken = (await get("WRBTC")).address;
    const zusdDeployment = (await getOrNull("ZUSDToken")) || (await getOrNull("ZUSD"));
    if (!zusdDeployment) {
        throw new Error("Unable to resolve ZUSD token deployment (expected ZUSDToken or ZUSD)");
    }
    const zusdToken = zusdDeployment.address;
    const rbtcDummyAddress = await feeSharingCollector.RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT();

    const withholdTokens = [
        { name: "RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT", address: rbtcDummyAddress },
        { name: "ZUSD", address: zusdToken },
    ];

    for (const token of withholdTokens) {
        let isAlreadyWithheld = false;
        try {
            isAlreadyWithheld = await feeSharingCollector.isTokenInProtocolWithholdList(
                token.address
            );
        } catch (error) {
            // If the current implementation is old and doesn't expose the read method yet,
            // still generate multisig txs so they can be executed after the implementation upgrade.
            await logger.warn(
                `Unable to check existing withhold status for ${token.name}; creating multisig tx anyway.`
            );
        }

        if (isAlreadyWithheld) {
            await logger.warn(`${token.name} already in protocol withhold list, skipping.`);
            continue;
        }

        const data = feeSharingCollector.interface.encodeFunctionData("addProtocolWithholdToken", [
            token.address,
        ]);

        await logger.warn(
            `Generating multisig tx: addProtocolWithholdToken(${token.name}: ${token.address})`
        );
        await sendWithMultisig(multisigAddress, feeSharingCollector.address, data, deployer);
    }
};
func.tags = ["FeeSharingCollector"];
module.exports = func;
