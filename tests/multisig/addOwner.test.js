const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { getMultisigWallet } = require("../../deployment/helpers/helpers");

describe("multisig:add-owner", () => {
    let originalDefault;
    let originalSelected;

    before(async () => {
        originalDefault = await deployments.getOrNull("MultiSigWallet");
        originalSelected = await deployments.getOrNull("SelectedMultisig");
    });

    after(async () => {
        for (const [name, original] of [
            ["MultiSigWallet", originalDefault],
            ["SelectedMultisig", originalSelected],
        ]) {
            if (original) await deployments.save(name, original);
            else await deployments.delete(name);
        }
    });

    async function fixture() {
        const [owner, secondOwner, newOwner] = await ethers.getSigners();
        const factory = await ethers.getContractFactory("MultiSigWallet");
        const fallback = await factory.deploy([owner.address, secondOwner.address], 2);
        const selected = await factory.deploy([owner.address, secondOwner.address], 2);
        await deployments.save("MultiSigWallet", {
            address: fallback.address,
            abi: (await deployments.getArtifact("MultiSigWallet")).abi,
        });
        await deployments.save("SelectedMultisig", {
            address: selected.address,
            abi: (await deployments.getArtifact("MultiSigWallet")).abi,
        });
        return { owner, secondOwner, newOwner, fallback, selected };
    }

    async function assertProposal(wallet, newOwner) {
        expect(await wallet.transactionCount()).to.equal(1);
        const proposal = await wallet.transactions(0);
        expect(proposal.destination).to.equal(wallet.address);
        expect(proposal.value).to.equal(0);
        expect(proposal.data).to.equal(
            "0x7065cb48" + newOwner.toLowerCase().slice(2).padStart(64, "0")
        );
        expect(proposal.executed).to.equal(false);
        expect(await wallet.getConfirmationCount(0)).to.equal(1);
        expect(await wallet.isOwner(newOwner)).to.equal(false);
    }

    it("submits to an explicit address without an address-named deployment", async () => {
        const { selected, fallback, newOwner, secondOwner } = await loadFixture(fixture);
        await hre.run("multisig:add-owner", {
            address: newOwner.address,
            multisig: selected.address,
        });
        await assertProposal(selected, newOwner.address);
        expect(await fallback.transactionCount()).to.equal(0);
        await selected.connect(secondOwner).confirmTransaction(0);
        expect(await selected.isOwner(newOwner.address)).to.equal(true);
    });

    it("resolves an explicit deployment name", async () => {
        const { selected, fallback, newOwner } = await loadFixture(fixture);
        await hre.run("multisig:add-owner", {
            address: newOwner.address,
            multisig: "SelectedMultisig",
        });
        await assertProposal(selected, newOwner.address);
        expect(await fallback.transactionCount()).to.equal(0);
    });

    it("uses the default deployment only when no wallet is selected", async () => {
        const { fallback, selected, newOwner } = await loadFixture(fixture);
        await hre.run("multisig:add-owner", { address: newOwner.address });
        await assertProposal(fallback, newOwner.address);
        expect(await selected.transactionCount()).to.equal(0);
    });

    it("accepts lowercase addresses and an explicit signer", async () => {
        const { selected, fallback, newOwner, secondOwner } = await loadFixture(fixture);
        await hre.run("multisig:add-owner", {
            address: newOwner.address.toLowerCase(),
            multisig: selected.address.toLowerCase(),
            signer: secondOwner.address,
        });
        await assertProposal(selected, newOwner.address);
        expect(await selected.getConfirmations(0)).to.deep.equal([secondOwner.address]);
        expect(await fallback.transactionCount()).to.equal(0);
    });

    // Literal EIP-1191 fixtures; expectations do not use the production normalizer.
    for (const [chainId, walletAddress, newOwner] of [
        [
            30,
            "0xBd687d470A7e8B36C666968bb79376904725e4Dd",
            "0x78a0DE7a48cCE1a8759f353987731394d5c0ffa7",
        ],
        [
            31,
            "0xBD687D470a7E8b36C666968BB79376904725e4dd",
            "0x78a0De7A48cce1A8759F353987731394d5c0fFA7",
        ],
    ]) {
        it(`accepts Rootstock chain ${chainId} checksums for wallet and new owner`, async () => {
            const { selected, fallback } = await loadFixture(fixture);
            const originalChainId = hre.network.config.chainId;
            // Install code locally to exercise address resolution without a public RPC.
            await hre.network.provider.send("hardhat_setCode", [
                walletAddress.toLowerCase(),
                await ethers.provider.getCode(selected.address),
            ]);
            hre.network.config.chainId = chainId;
            try {
                const resolved = await getMultisigWallet(walletAddress);
                expect(resolved.address.toLowerCase()).to.equal(walletAddress.toLowerCase());
                // Use the initialized fixture for submission; checksum validation remains real.
                await hre.run("multisig:add-owner", {
                    address: newOwner,
                    multisig: selected.address,
                });
                await assertProposal(selected, newOwner.toLowerCase());
                expect(await fallback.transactionCount()).to.equal(0);
            } finally {
                hre.network.config.chainId = originalChainId;
            }
        });
    }

    it("rejects a Rootstock mainnet checksum on the testnet chain", async () => {
        await loadFixture(fixture);
        const originalChainId = hre.network.config.chainId;
        hre.network.config.chainId = 31;
        try {
            await expect(
                getMultisigWallet("0xBd687d470A7e8B36C666968bb79376904725e4Dd")
            ).to.be.rejectedWith(/checksum/i);
        } finally {
            hre.network.config.chainId = originalChainId;
        }
    });

    for (const multisig of [
        "UnknownMultisig",
        "",
        "0x1234",
        "0xBd687d470A7e8B36C666968bb79376904725e4DD",
        ethers.constants.AddressZero,
    ]) {
        it(`rejects invalid or unavailable wallet ${JSON.stringify(multisig)}`, async () => {
            const { fallback, selected, newOwner } = await loadFixture(fixture);
            const originalChainId = hre.network.config.chainId;
            hre.network.config.chainId = 30;
            try {
                await expect(
                    hre.run("multisig:add-owner", { address: newOwner.address, multisig })
                ).to.be.rejectedWith(/multisig/i);
            } finally {
                hre.network.config.chainId = originalChainId;
            }
            expect(await fallback.transactionCount()).to.equal(0);
            expect(await selected.transactionCount()).to.equal(0);
        });
    }

    it("rejects a new owner with an invalid checksum before submission", async () => {
        const { selected } = await loadFixture(fixture);
        const originalChainId = hre.network.config.chainId;
        hre.network.config.chainId = 30;
        try {
            await expect(
                hre.run("multisig:add-owner", {
                    address: "0x78a0DE7a48cCE1a8759f353987731394d5c0ffa8",
                    multisig: selected.address,
                })
            ).to.be.rejectedWith(/address|checksum/i);
        } finally {
            hre.network.config.chainId = originalChainId;
        }
        expect(await selected.transactionCount()).to.equal(0);
    });
});
