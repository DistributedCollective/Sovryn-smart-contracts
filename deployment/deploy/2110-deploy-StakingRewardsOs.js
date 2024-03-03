const { deployWithCustomProxy } = require("../helpers/helpers");
const Logs = require("node-logs");
const { sendWithMultisig } = require("../helpers/helpers");
const logger = new Logs().showInConsole(true);
const col = require("cli-color");
const func = async function (hre) {
    const {
        deployments: { get, log, getArtifact },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();
    await logger.warn("Deploying StakingRewardsOs...");
    await deployWithCustomProxy(
        deployer,
        "StakingRewardsOs",
        "StakingRewardsOsProxy",
        "",
        "StakingRewardsOs_Proxy",
        true
    );
    const signer = await ethers.getSigner(deployer);
    const stakingRewards = await ethers.getContract("StakingRewardsOs", signer);
    const stakingRewardsProxy = await ethers.getContract("StakingRewardsOs_Proxy");
    const osSOV = await ethers.getContract("OsSOV");
    const osSOVDeployment = await get("OsSOV");
    const osSOVAddress = osSOV.address;
    const stakingAddress = (await get("Staking")).address;
    const multisigAddress = (await get("MultiSigWallet")).address;

    if ((await stakingRewards.getOsSOV()) === ethers.constants.AddressZero) {
        if ((await stakingRewards.owner()) === deployer) {
            await stakingRewards.initialize(osSOVAddress, stakingAddress, 30);
        } else {
            const stakingRewardsInterface = new ethers.utils.Interface(
                (await getArtifact("StakingRewardsOs")).abi
            );
            const data = stakingRewardsInterface.encodeFunctionData("initialize", [
                osSOVAddress,
                stakingAddress,
                30,
            ]);
            log(col.yellow("Creating multisig tx to initialize StakingRewardsOs..."));
            await sendWithMultisig(multisigAddress, stakingRewards.address, data, deployer);
        }
    }
    if ((await stakingRewardsProxy.getProxyOwner()) !== multisigAddress) {
        logger.warn("Setting StakingRewardsOs proxy owner to multisig...");
        await stakingRewardsProxy.setProxyOwner(multisigAddress);
    }
    if ((await stakingRewards.owner()) === deployer) {
        logger.warn("Transferring StakingRewardsOs ownership to multisig...");
        await stakingRewards.transferOwnership(multisigAddress);
    }

    const AUTHORISED_MINTER_ROLE = await osSOV.AUTHORISED_MINTER_ROLE();
    if (!(await osSOV.hasRole(AUTHORISED_MINTER_ROLE, stakingRewards.address))) {
        logger.warn("Processing OsSOV UPGRADE...");
        if ((await osSOV.owner()) === multisigAddress) {
            const osSOVInterface = new ethers.utils.Interface(osSOVDeployment.abi);
            const data = osSOVInterface.encodeFunctionData("grantRole", [
                AUTHORISED_MINTER_ROLE,
                stakingRewards.address,
            ]);
            log(col.yellow("Granting role AUTHORISED_MINTER_ROLE to StakingRewardsOs..."));
            await sendWithMultisig(multisigAddress, osSOV.address, data, deployer);
            log(col.yellow("This multisig tx requires signatures and execution"));
        } else {
            await osSOV.grantRole(AUTHORISED_MINTER_ROLE, stakingRewards.address);
        }
    }
};

func.tags = ["StakingRewardsOs"];
func.dependencies = ["OsSOV"];
module.exports = func;
