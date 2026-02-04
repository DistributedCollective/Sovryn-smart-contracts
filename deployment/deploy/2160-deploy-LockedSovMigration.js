const col = require("cli-color");

const func = async function (hre) {
    const {
        ethers,
        deployments: { deploy, log, get },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();

    log("\nDeploying LockedSOVMigration...");

    // Get existing contract addresses
    const SOV = await get("SOV");
    const VestingRegistry = await get("VestingRegistryProxy");
    const LockedSOV = await get("LockedSOV");

    // Get LockedSOV to copy config
    const lockedSOVContract = await ethers.getContractAt("ILockedSOV", LockedSOV.address);

    const cliff = await lockedSOVContract.cliff();
    const duration = await lockedSOVContract.duration();

    // Convert cliff and duration from seconds to 4-week periods
    const FOUR_WEEKS = 4 * 7 * 24 * 60 * 60;
    const cliffPeriods = cliff.div(FOUR_WEEKS);
    const durationPeriods = duration.div(FOUR_WEEKS);

    log(`  SOV Token: ${SOV.address}`);
    log(`  VestingRegistry: ${VestingRegistry.address}`);
    log(`  Cliff: ${cliffPeriods} 4-week periods`);
    log(`  Duration: ${durationPeriods} 4-week periods`);

    // Get multisig as admin
    const multisig = await get("MultiSigWallet");
    const admins = [multisig.address];

    log(`  Admins: ${admins.join(", ")}`);

    const lockedSOVMigration = await deploy("LockedSOVMigration", {
        from: deployer,
        args: [
            SOV.address,
            VestingRegistry.address,
            cliffPeriods.toString(),
            durationPeriods.toString(),
            admins,
        ],
        log: true,
    });

    log(col.bgGreen(`\nLockedSOVMigration deployed at: ${lockedSOVMigration.address}`));

    // Verify contract on block explorer if not local network
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        log("\nWaiting for block confirmations before verification...");
        await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds

        try {
            await hre.run("verify:verify", {
                address: lockedSOVMigration.address,
                constructorArguments: [
                    SOV.address,
                    VestingRegistry.address,
                    cliffPeriods.toString(),
                    durationPeriods.toString(),
                    admins,
                ],
            });
            log(col.bgGreen("Contract verified on block explorer"));
        } catch (error) {
            log(col.bgYellow(`Verification failed: ${error.message}`));
        }
    }

    return true;
};

func.tags = ["LockedSOVMigration"];
func.dependencies = ["SOV", "VestingRegistryProxy", "MultiSigWallet", "LockedSOV"];
module.exports = func;
