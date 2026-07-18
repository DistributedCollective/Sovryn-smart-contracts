// first run a local forked mainnet node in a separate terminal window:
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy --fork-block-number 8972322
// now run the test:
//     npx hardhat test tests-onchain/SIP0093.test.js --network rskForkedMainnet

const { expect } = require("chai");
const hre = require("hardhat");
const sipArgs = require("../hardhat/tasks/sips/args/sipArgs");

const SOV = "0xEFc78fc7d48b64958315949279Ba181c2114ABBd";
const BPRO = "0x440cd83c160de5c96ddb20246815ea44c7abbca8";

const EXPECTED_MAINNET_CALLS = {
    LoanToken_iXUSD: [
        [SOV, true],
        [SOV, false],
        [BPRO, true],
        [BPRO, false],
    ],
    LoanToken_iRBTC: [
        [SOV, true],
        [SOV, false],
        [BPRO, true],
        [BPRO, false],
    ],
    LoanToken_iBPRO: [
        [SOV, true],
        [SOV, false],
    ],
    LoanToken_iDOC: [
        [SOV, true],
        [SOV, false],
        [BPRO, true],
        [BPRO, false],
    ],
    LoanToken_iDLLR: [
        [SOV, true],
        [SOV, false],
        [BPRO, true],
        [BPRO, false],
    ],
    LoanToken_iUSDT: [
        [BPRO, true],
        [BPRO, false],
    ],
};

async function getLoanTokenDeploymentsByAddress() {
    const names = [
        "LoanToken_iXUSD",
        "LoanToken_iRBTC",
        "LoanToken_iBPRO",
        "LoanToken_iDOC",
        "LoanToken_iDLLR",
        "LoanToken_iUSDT",
    ];
    const byAddress = new Map();
    for (const name of names) {
        const deployment = await hre.deployments.get(name);
        byAddress.set(deployment.address.toLowerCase(), name);
    }
    return byAddress;
}

async function getLoanParamsId(loanToken, collateralToken, isTorqueLoan) {
    const key = hre.ethers.utils.solidityKeccak256(
        ["address", "bool"],
        [collateralToken, isTorqueLoan]
    );
    return loanToken.loanParamsIds(key);
}

async function getProtocolLoanParams(loanToken, loanParamsId) {
    const sovryn = await hre.ethers.getContractAt(
        [
            "function getLoanParams(bytes32[]) view returns (tuple(bytes32 id,bool active,address owner,address loanToken,address collateralToken,uint256 minInitialMargin,uint256 maintenanceMargin,uint256 maxLoanTerm)[])",
        ],
        await loanToken.sovrynContractAddress()
    );
    const [loanParams] = await sovryn.getLoanParams([loanParamsId]);
    return loanParams;
}

describe("SIP-0093 disable SOV/BPro collateral", function () {
    before(async function () {
        if (!hre.network.tags || !hre.network.tags.mainnet) {
            this.skip();
        }
    });

    it("encodes only active SOV and BPro collateral loan params", async function () {
        const { args, governor } = await sipArgs.getArgsSip0093(hre);
        expect(governor).to.equal("GovernorAdmin");
        expect(args.targets.length).to.be.greaterThan(0);
        expect(args.targets.length).to.equal(args.data.length);
        expect(args.targets.length).to.equal(args.targetOwnerValidationAddresses.length);

        const byAddress = await getLoanTokenDeploymentsByAddress();
        const observedCalls = {};

        for (let i = 0; i < args.targets.length; i++) {
            const loanTokenName = byAddress.get(args.targets[i].toLowerCase());
            expect(loanTokenName, `unexpected target ${args.targets[i]}`).to.not.equal(undefined);

            const loanToken = await hre.ethers.getContractAt(
                [
                    "function admin() view returns (address)",
                    "function loanParamsIds(uint256) view returns (bytes32)",
                    "function sovrynContractAddress() view returns (address)",
                ],
                args.targets[i]
            );
            expect((await loanToken.admin()).toLowerCase()).to.equal(
                args.targetOwnerValidationAddresses[i].toLowerCase()
            );

            const [collateralTokens, isTorqueLoans] = hre.ethers.utils.defaultAbiCoder.decode(
                ["address[]", "bool[]"],
                args.data[i]
            );
            expect(collateralTokens.length).to.equal(isTorqueLoans.length);

            observedCalls[loanTokenName] = [];
            for (let j = 0; j < collateralTokens.length; j++) {
                const collateralToken = collateralTokens[j];
                const isTorqueLoan = isTorqueLoans[j];
                expect([SOV.toLowerCase(), BPRO.toLowerCase()]).to.include(
                    collateralToken.toLowerCase()
                );

                const loanParamsId = await getLoanParamsId(
                    loanToken,
                    collateralToken,
                    isTorqueLoan
                );
                expect(loanParamsId).to.not.equal(hre.ethers.constants.HashZero);

                const loanParams = await getProtocolLoanParams(loanToken, loanParamsId);
                expect(loanParams.id).to.equal(loanParamsId);
                expect(loanParams.active).to.equal(true);
                expect(loanParams.owner.toLowerCase()).to.equal(args.targets[i].toLowerCase());
                expect(loanParams.collateralToken.toLowerCase()).to.equal(
                    collateralToken.toLowerCase()
                );
                expect(loanParams.maxLoanTerm.eq(0)).to.equal(isTorqueLoan);

                observedCalls[loanTokenName].push([collateralToken.toLowerCase(), isTorqueLoan]);
            }
        }

        const chainId = (await hre.ethers.provider.getNetwork()).chainId;
        if (chainId === 30) {
            expect(Object.keys(observedCalls).sort()).to.deep.equal(
                Object.keys(EXPECTED_MAINNET_CALLS).sort()
            );
            for (const [loanTokenName, expectedPairs] of Object.entries(EXPECTED_MAINNET_CALLS)) {
                expect(observedCalls[loanTokenName]).to.deep.equal(
                    expectedPairs.map(([collateralToken, isTorqueLoan]) => [
                        collateralToken.toLowerCase(),
                        isTorqueLoan,
                    ])
                );
            }
        }
    });

    it("executes encoded disables on a mainnet fork", async function () {
        if (!hre.network.tags.forked) {
            this.skip();
        }

        const { args } = await sipArgs.getArgsSip0093(hre);
        const protocol = await hre.ethers.getContractAt(
            [
                "function supportedTokens(address) view returns (bool)",
                "function getLoanParams(bytes32[]) view returns (tuple(bytes32 id,bool active,address owner,address loanToken,address collateralToken,uint256 minInitialMargin,uint256 maintenanceMargin,uint256 maxLoanTerm)[])",
            ],
            await (
                await hre.ethers.getContractAt(
                    ["function sovrynContractAddress() view returns (address)"],
                    args.targets[0]
                )
            ).sovrynContractAddress()
        );

        for (let i = 0; i < args.targets.length; i++) {
            const loanToken = await hre.ethers.getContractAt(
                [
                    "function admin() view returns (address)",
                    "function disableLoanParams(address[],bool[])",
                    "function loanParamsIds(uint256) view returns (bytes32)",
                ],
                args.targets[i]
            );
            const admin = await loanToken.admin();

            await hre.network.provider.request({
                method: "hardhat_setBalance",
                params: [admin, "0x56BC75E2D63100000"],
            });
            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [admin],
            });

            const [collateralTokens, isTorqueLoans] = hre.ethers.utils.defaultAbiCoder.decode(
                ["address[]", "bool[]"],
                args.data[i]
            );
            const loanParamsIds = [];
            for (let j = 0; j < collateralTokens.length; j++) {
                loanParamsIds.push(
                    await getLoanParamsId(loanToken, collateralTokens[j], isTorqueLoans[j])
                );
            }

            await loanToken
                .connect(await hre.ethers.getSigner(admin))
                .disableLoanParams(collateralTokens, isTorqueLoans);

            for (let j = 0; j < collateralTokens.length; j++) {
                expect(
                    await getLoanParamsId(loanToken, collateralTokens[j], isTorqueLoans[j])
                ).to.equal(hre.ethers.constants.HashZero);
            }

            const disabledParams = await protocol.getLoanParams(loanParamsIds);
            for (const loanParams of disabledParams) {
                expect(loanParams.active).to.equal(false);
            }

            await hre.network.provider.request({
                method: "hardhat_stopImpersonatingAccount",
                params: [admin],
            });
        }

        expect(await protocol.supportedTokens(SOV)).to.equal(true);
        expect(await protocol.supportedTokens(BPRO)).to.equal(true);
    });
});
