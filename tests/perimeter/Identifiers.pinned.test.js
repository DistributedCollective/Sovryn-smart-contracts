/**
 * Perimeter — the on-chain identifiers are pinned to literal values.
 *
 * Storage-pointer slots and surface ids are `keccak256` of a name, so the name
 * IS the value: change a character and every pointer moves, the controller
 * resolves no policy, and the fee silently stops being charged. The names are
 * also duplicated across three contract repos and the dapp, which is exactly
 * the shape that drifts.
 *
 * Pinning the preimage alone is not enough — a bulk rename can rewrite the
 * preimage and the assertion together and stay green. So each is pinned twice:
 * to its expected preimage AND to the literal 32 bytes it must hash to. The
 * literals below are the values Phase 1 deploys against and Phase 2 inherits
 * unchanged; a diff here means a redeploy and a re-pin, never a test edit.
 *
 * Run:
 *   npx hardhat test tests/perimeter/Identifiers.pinned.test.js
 */

const { expect } = require("chai");

const keccak = (s) => web3.utils.keccak256(s);
const minusOne = (h) => "0x" + (BigInt(h) - 1n).toString(16).padStart(64, "0");

/// Pointer slots. The stored slot is `keccak256(name) - 1`, EIP-1967 style, so
/// no Solidity variable can ever be assigned to it by the compiler.
const SLOTS = [
    {
        name: "sovryn.perimeterExitFeeController",
        slot: "0x3d5704dffa26c356d6b67639c4ccefa7798677b7f52196eb2d0a71d1837fe77e",
    },
    {
        name: "sovryn.perimeterBorrowerExitOps",
        slot: "0x36a049d46d11aeba02ad82fc6473c2fcc3b7194e4110c985ac03675bf62d3ac1",
    },
];

/// Surface ids, keyed straight off the name with no offset.
const SURFACES = [
    {
        name: "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW",
        id: "0xd4896528a9fba849e3d3db442dea05ef8f08c93e00cc760acac34c42a7dacffe",
    },
    {
        name: "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW",
        id: "0xfa502ea562018a194d7f66e337810fa8b882ec21f706f3b3c709a53fa126b018",
    },
    {
        name: "PERIMETER_SURFACE_ZERO_WITHDRAW_COLL",
        id: "0xfb3234ca0cf70fe9c90b73939f36a37fadcfdef4628afc42dd57d1f26dfd8fb5",
    },
    {
        name: "PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS",
        id: "0x44224716871939619faf861b30e39bac8861d4f76b5dd0468d31bf4b7dc684be",
    },
    {
        name: "PERIMETER_SURFACE_AMM_REMOVE_LIQUIDITY",
        id: "0x785cea9856c907f8eb318fa26cc03e32cc9b61b22144c7a093eec9a60354a9b2",
    },
];

contract("Perimeter — pinned identifiers", () => {
    SLOTS.forEach(({ name, slot }) => {
        it(`slot ${name} hashes to its pinned value`, () => {
            expect(minusOne(keccak(name))).to.equal(slot);
        });
    });

    SURFACES.forEach(({ name, id }) => {
        it(`surface ${name} hashes to its pinned value`, () => {
            expect(keccak(name)).to.equal(id);
        });
    });

    it("no two identifiers collide", () => {
        const all = SLOTS.map((s) => s.slot).concat(SURFACES.map((s) => s.id));
        expect(new Set(all).size, "duplicate identifier value").to.equal(all.length);
    });

    it("the source still declares exactly these names", () => {
        const fs = require("fs");
        const lib = fs.readFileSync("contracts/utils/PerimeterLib.sol", "utf8");
        SLOTS.forEach(({ name }) => {
            expect(lib, `PerimeterLib must derive ${name}`).to.contain(`keccak256("${name}")`);
        });

        /// The old Phase-1 names must be gone from the source entirely: leaving
        /// one behind is a live pointer at a slot nothing writes.
        ["sovryn.exitFeeController", "sovryn.colFeeBorrowerExitOps"].forEach((stale) => {
            expect(lib, `stale identifier ${stale} still present`).to.not.contain(`"${stale}"`);
        });

        /// Surfaces are checked against the DERIVATION, not just the name. The
        /// preimage is the whole name and nothing else: Phase 1 shipped
        /// `keccak256("COLFEE:" + name)`, and a rename that leaves any prefix
        /// in place produces a plausible-looking constant that hashes somewhere
        /// no policy is stored, so the fee silently stops.
        const consumers = [
            "contracts/mixins/BorrowerExitPerimeter.sol",
            "contracts/connectors/loantoken/LoanTokenLogicShared.sol",
        ]
            .map((f) => fs.readFileSync(f, "utf8"))
            .join("\n");

        [
            "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW",
            "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW",
        ].forEach((name) => {
            /// Assert on a boolean, not the file: a `contain` failure here
            /// would print the whole source and bury the finding.
            expect(
                consumers.includes(`keccak256("${name}")`),
                `${name} must be derived from its bare name`
            ).to.be.true;
        });
        const prefixed = consumers.match(/"[A-Za-z_]+:[A-Za-z_]*SURFACE_[A-Z_]*"/g) || [];
        expect(prefixed, "a surface id is derived from a prefixed preimage").to.deep.equal([]);
    });
});
