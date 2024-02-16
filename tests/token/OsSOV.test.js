const hre = require("hardhat");
const {
    ethers,
    deployments: { createFixture },
    network,
} = hre;
const { impersonateAccount, setBalance } = require("@nomicfoundation/hardhat-network-helpers");

describe("OsSOV", () => {
    let osSOV, stakingRewards;
    let user1, user2, multisigSigner, mockStakingRewards;

    const setupTest = createFixture(async ({ deployments }) => {
        await deployments.fixture(["OsSOV"]);
        [user1, user2, mockStakingRewards] = (await ethers.getSigners()).map(
            (signer) => signer.address
        );
        return {
            contracts: {
                osSOV: await ethers.getContract("OsSOV"),
                stakingRewards:
                    network.tags.mainnet || network.tags.testnet
                        ? await ethers.getContract("StakingRewardsOs")
                        : await ethers.getSigner(mockStakingRewards),
            },
        };
    });

    before(async () => {
        const contracts = (await setupTest()).contracts;
        osSOV = contracts.osSOV;
        stakingRewards = contracts.stakingRewards;
        const multisig = await ethers.getContract("MultiSigWallet");
        await impersonateAccount(multisig.address);
        multisigSigner = await ethers.getSigner(multisig.address);
    });

    it("osSOV initialized", async () => {
        expect(await osSOV.name()).to.equal("BitcoinOS Sovryn Transition Token");
        expect(await osSOV.symbol()).to.equal("osSOV");
        expect(await osSOV.decimals()).to.equal(18);
        expect(await osSOV.totalSupply()).to.equal(0);

        expect(await osSOV.hasRole(await osSOV.DEFAULT_ADMIN_ROLE(), multisigSigner.address));
        expect(
            await osSOV.hasRole(await osSOV.AUTHORISED_MINTER_ROLE(), ethers.constants.AddressZero)
        );
        expect(await osSOV.owner()).to.equal(multisigSigner.address);
        await setBalance(multisigSigner.address, ethers.utils.parseEther("1"));
        await osSOV.connect(multisigSigner).setAuthorisedMinterRole(stakingRewards.address);
        expect(await osSOV.hasRole(await osSOV.AUTHORISED_MINTER_ROLE(), stakingRewards.address));
    });

    it("osSOV is non-approvable", async () => {
        osSOV = await osSOV.connect(ethers.provider.getSigner(mockStakingRewards));
        await osSOV.mint(user1, ethers.utils.parseEther("100"));
        await expect(
            osSOV
                .connect(ethers.provider.getSigner(user1))
                .approve(user2, ethers.utils.parseEther("1"))
        ).to.be.revertedWithCustomError(osSOV, "NonApprovable");
    });

    it("osSOV is non-transferable", async () => {
        await expect(
            osSOV
                .connect(ethers.provider.getSigner(user1))
                .transfer(user2, ethers.utils.parseEther("1"))
        ).to.be.revertedWithCustomError(osSOV, "NonTransferable");
    });

    it("osSOV is non-receivable", async () => {
        tx = {
            to: osSOV.address,
            value: ethers.utils.parseEther("1", "ether"),
        };
        const signer = ethers.provider.getSigner(user1);
        await expect(signer.sendTransaction(tx)).to.be.revertedWithCustomError(
            osSOV,
            "NonReceivable"
        );
    });

    it("osSOV is 100M capped", async () => {
        expect(await osSOV.cap()).to.eql(ethers.utils.parseEther("100000000"));
    });

    it("osSOV - StakingRewardsOs is an authorised minter", async () => {
        expect(await osSOV.hasRole(await osSOV.AUTHORISED_MINTER_ROLE(), stakingRewards.address));
    });

    it("osSOV - MultiSigWallet is the default admin", async () => {
        expect(await osSOV.hasRole(await osSOV.DEFAULT_ADMIN_ROLE(), multisigSigner.address));
    });
});
