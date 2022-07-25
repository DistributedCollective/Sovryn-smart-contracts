/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying proxy and
 * implementation on every test.
 *
 * Total time elapsed: 4.3s
 * After optimization: 4.1s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const chai = require("chai");
const { expect } = chai;

const hre = require("hardhat");
const { ethers, waffle, deployments, network, getNamedAccounts } = hre;
const { loadFixture } = waffle;
const { getStakingModulesNames } = require("../../deployment/helpers/helpers");
const {
    expectRevert,
    expectEvent,
    constants,
    BN,
    balance,
    time,
} = require("@openzeppelin/test-helpers");

const {
    MockContractFactory,
    MockContract,
    FakeContract,
    smock,
} = require("@defi-wonderland/smock");

const ZERO_ADDRESS = ethers.constants.ZERO_ADDRESS;

chai.use(smock.matchers);

describe("Modules Proxy", () => {
    let acct1, acct2, deployer;
    let accountOwner;
    let moduleNames, modulesProxy;
    let adminModuleDeploymentNew;

    let proxy;
    let modulesObject = {};

    async function deployNoRegister(_wallets, _provider) {
        await deployments.fixture(["StakingModulesProxy", "StakingModules"]); //using hh deployments script to deploy proxy
        await deployments.deploy("StakingAdminModuleNew", {
            contract: "StakingAdminModule",
            from: deployer.address,
        });
    }

    before(async () => {
        moduleNames = getStakingModulesNames();
        [deployer, acct1] = await ethers.getSigners(); //getNamedAccounts();
        await deployNoRegister();
    });

    beforeEach(async () => {
        await loadFixture(deployNoRegister);
        modulesProxy = await ethers.getContract("StakingModulesProxy");
    });

    describe("Modules Proxy deployment", async () => {
        it("Should deploy ModulesProxy and register modules", async () => {
            for (let moduleName in moduleNames) {
                const fakeModule = await smock.fake(moduleName);
                await modulesProxy.addModule(fakeModule.address);
                expect(fakeModule.getFunctionsList).to.have.been.called;
            }
        });

        it("Does not allow to override registered functions (replaceModule should be used instead)", async () => {
            const {
                deployments: { get },
                ethers,
            } = hre;
            const adminModuleDeployment = await get("StakingAdminModule");
            const adminModuleDeploymentNew = await get("StakingAdminModuleNew");
            await modulesProxy.addModule(adminModuleDeployment.address);
            await expect(
                modulesProxy.addModule(adminModuleDeploymentNew.address)
            ).to.be.revertedWith("MR02"); //func already registered
        });

        //TODO: using smock.fake causes failures when deploying/using the same contract in the upfollowing tests
        it("Registers Staking modules correctly", async () => {
            const {
                deployments: { get },
                ethers,
            } = hre;

            const adminModuleDeployment = await get("StakingAdminModule");

            await expect(modulesProxy.addModule(adminModuleDeployment.address))
                .to.emit(modulesProxy, "AddModule")
                .withArgs(adminModuleDeployment.address);

            const adminModuleAtProxy = await ethers.getContractAt(
                "StakingAdminModule",
                modulesProxy.address
            );
            const fakeModule = await smock.fake(moduleNames.StakingAdminModule, {
                address: adminModuleDeployment.address,
            });
            await adminModuleAtProxy.addAdmin(acct1.address);
            expect(fakeModule.addAdmin).to.have.been.calledWith(acct1.address);
        });

        it("Removes module correctly", async () => {
            const {
                deployments: { get },
                ethers,
            } = hre;

            const adminModuleDeployment = await get("StakingAdminModule");

            await expect(modulesProxy.addModule(adminModuleDeployment.address))
                .to.emit(modulesProxy, "AddModule")
                .withArgs(adminModuleDeployment.address);

            await expect(modulesProxy.removeModule(adminModuleDeployment.address))
                .to.emit(modulesProxy, "RemoveModule")
                .withArgs(adminModuleDeployment.address);

            const adminModuleAtProxy = await ethers.getContractAt(
                "StakingAdminModule",
                modulesProxy.address
            );
            await expect(adminModuleAtProxy.addAdmin(acct1.address)).to.be.revertedWith("MP03"); // module was removed - func is not registered
        });

        it("Replaces module correctly", async () => {
            const {
                deployments: { deploy, get },
                ethers,
            } = hre;

            const adminModuleDeployment = await get("StakingAdminModule");
            const adminModuleDeploymentNew = await get("StakingAdminModuleNew");

            await expect(
                modulesProxy.replaceModule(
                    adminModuleDeployment.address,
                    adminModuleDeploymentNew.address
                )
            )
                .to.emit(modulesProxy, "ReplaceModule")
                .withArgs(adminModuleDeployment.address, adminModuleDeploymentNew.address);

            const adminModuleAtProxy = await ethers.getContractAt(
                "StakingAdminModule",
                modulesProxy.address
            );
            const fakeModule = await smock.fake(moduleNames.StakingAdminModule, {
                address: adminModuleDeploymentNew.address,
            });
            await adminModuleAtProxy.addAdmin(acct1.address);
            expect(fakeModule.addAdmin).to.have.been.calledWith(acct1.address);
        });
    });
});

//TODO: add tests
//[X] remove module
//[ ] replace modules

/* expectEvent(receipt, "AddModule");

            const abi = ["event AddModule(address moduleAddress)"];
            const iface = new ethers.utils.Interface(abi);
            const parsedLogs = iface.parseLog(receipt.logs[receipt.logs.length - 1]);
            expect(parsedLogs.args["moduleAddress"], `${abi[0]} is not emitted properly`).to.eql(
                adminModuleDeployment.address
            );*/
