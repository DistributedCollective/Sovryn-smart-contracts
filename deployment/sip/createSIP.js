const hre = require("hardhat");
const { createSIP0049 } = import("./sips");

async function main() {
    await createSIP0049();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
