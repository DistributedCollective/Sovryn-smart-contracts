const { task } = require("hardhat/config");
task("fastBTC-roles", "Manage roles")
    .addPositionalParam("action", "add/remove/check")
    .addPositionalParam("role", "name of role")
    .addOptionalParam("account", "Account to manage the role of")
    .addFlag("force", "Force removal of admin role from myself, if needed")
    .addOptionalParam("privateKey", "Admin private key (else deployer is used)")
    .addOptionalParam("accessControl", "Access control address")
    .setAction(async (args, hre) => {
        const { action, account, privateKey, force } = args;
        if (["add", "remove", "check"].indexOf(action) === -1) {
            throw new Error(`invalid action: ${action}`);
        }
        if (action !== "check" && !account) {
            throw new Error("Account must be provided if action is not check");
        }
        const role = args.role.toUpperCase();
        if (["ADMIN", "FEDERATOR", "PAUSER", "GUARD"].indexOf(role) === -1) {
            throw new Error(`invalid role: ${role}`);
        }

        const signer = await getSignerFromPrivateKeyOrDeployer(privateKey, hre);
        const signerAddress = await signer.getAddress();
        const accessControl = await hre.ethers.getContractAt(
            "FastBTCAccessControl",
            await getDeploymentAddress(args.accessControl, hre, "FastBTCAccessControl"),
            signer
        );

        console.log(`${action} role ${role}`, account ? `for ${account}` : "");
        const roleHash = await accessControl[`ROLE_${role}`]();
        console.log("role hash:", roleHash);
        const numRoleMembers = await accessControl.getRoleMemberCount(roleHash);
        console.log(`Members with the role (${numRoleMembers} in total):`);
        for (let i = 0; i < numRoleMembers; i++) {
            console.log("- ", await accessControl.getRoleMember(roleHash, i));
        }

        if (!account) {
            return;
        }

        if (action === "remove" && role === "ADMIN") {
            if (numRoleMembers <= 1) {
                throw new Error("Refusing to remove the only admin!");
            }
            if (account.toLowerCase() === signerAddress.toLowerCase()) {
                if (!force) {
                    throw new Error(
                        "refusing to remove the admin role from myself without --force!"
                    );
                } else {
                    console.warn(
                        "WARNING: going to remove the admin role from myself! Think about it for a while!"
                    );
                    await sleep(2000);
                }
            }
        }

        const hasRole = await accessControl.hasRole(roleHash, account);
        console.log(account, "has role:", hasRole);

        let tx;
        if (action === "add") {
            if (hasRole) {
                console.log("account already has the role, not adding");
                return;
            }
            console.log("adding role in 5s...");
            await sleep(5000);
            tx = await accessControl.grantRole(roleHash, account);
        } else if (action === "remove") {
            if (!hasRole) {
                console.log("account does not have the role, not removing");
                return;
            }
            console.log("removing role in 5s...");
            await sleep(5000);
            tx = await accessControl.revokeRole(roleHash, account);
        } else {
            return;
        }
        console.log("tx hash:", tx.hash);
        console.log("waiting for tx...");
        await tx.wait();
        console.log("all done");
    });

async function getSignerFromPrivateKeyOrDeployer(privateKey, hre) {
    const { ethers, getNamedAccounts } = hre;
    if (privateKey) {
        return new ethers.Wallet(privateKey, ethers.provider);
    }
    const { deployer } = await getNamedAccounts("deployer");
    return ethers.getSigner(deployer);
}

async function getDeploymentAddress(addressOrName, hre, contractName) {
    if (addressOrName && hre.ethers.utils.isAddress(addressOrName)) {
        return addressOrName;
    }
    // fallback to deployments if not an address
    const deployment = await hre.deployments.get(contractName);
    return deployment.address;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
