const col = require("cli-color");

const func = async function (hre) {
    const {
        deployments: { deploy, log },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();

    log(col.bgYellow("Deploying DummyMoCMedianizer..."));
    const result = await deploy("DummyMoCMedianizer", {
        from: deployer,
        args: [],
        log: true,
    });
    log(col.bgGreen(`DummyMoCMedianizer deployed at ${result.address}`));
    log(
        col.bgYellow(
            "Next step: submit a Sovryn multisig tx calling " +
                "setMoCOracleAddress(<this address>) on the shared RBTC sub-oracle " +
                "0x4106e4Bb0C339cf7e8adc64Cf889F261Fef1e789. " +
                "Use scripts/contractInteraction/tasks/pause_amm_v2_via_oracle.py."
        )
    );
};
func.tags = ["DummyMoCMedianizer"];
module.exports = func;
