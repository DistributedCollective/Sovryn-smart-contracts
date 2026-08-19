// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../contracts/utils/PerimeterLib.sol";
import "../../contracts/utils/BorrowerExitPerimeterOps.sol";
import "../../contracts/interfaces/perimeter/IExitFeeController.sol";

/// Foundry fuzz coverage for the Perimeter amount split — the trust boundary with
/// the untrusted ExitFeeController. The contracts are 0.5.17, so the tests are
/// written in 0.5.17 (forge-std is 0.8): properties are asserted with `require`
/// (a fuzz function that reverts = a failing case) and cheatcodes come from an
/// inline Vm interface.
///
///   #1 quoteIsValid  — the validity gate ⟺ conservation (fee<=gross,
///                      net==gross-fee, receiver!=0, rate<=10000).
///   #2 safeQuote     — the word-wise decode never reverts on ANY controller
///                      return bytes, and falls open to CONTROLLER_REVERT.
///   #3 charge split  — chargeExitFeeAndPay never over-pays, conserves value,
///                      and never reverts, for arbitrary and valid quotes.

interface Vm {
    function store(address, bytes32, bytes32) external;
    function assume(bool) external;
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amt) public {
        balanceOf[to] += amt;
    }

    function transfer(address to, uint256 amt) public returns (bool) {
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;
        return true;
    }
}

/// Returns a configurable structured quote (for #3).
contract MockQuoteController {
    IExitFeeController.ExitFeeQuote internal q;

    function set(IExitFeeController.ExitFeeQuote memory _q) public {
        q = _q;
    }

    function quoteExitFee(
        bytes32,
        address,
        address,
        uint256
    ) external view returns (IExitFeeController.ExitFeeQuote memory) {
        return q;
    }
}

/// Returns arbitrary raw bytes for any call (for #2 — fuzz the return payload).
contract MockBytesController {
    bytes internal data;

    function set(bytes memory d) public {
        data = d;
    }

    function() external {
        bytes memory d = data;
        assembly {
            return(add(d, 0x20), mload(d))
        }
    }
}

contract PerimeterSplitFuzzTest {
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    BorrowerExitPerimeterOps internal ops;
    MockQuoteController internal controller;
    MockBytesController internal bytesController;
    MockERC20 internal asset;

    // PerimeterLib.EXIT_FEE_CONTROLLER_SLOT (unstructured).
    bytes32 internal constant CTRL_SLOT =
        bytes32(uint256(keccak256("sovryn.exitFeeController")) - 1);
    // BorrowerExitPerimeterOps.wrbtcToken (State storage layout, slot 45).
    bytes32 internal constant WRBTC_SLOT = bytes32(uint256(45));
    address internal constant DUMMY_WRBTC = address(0xdEaD);

    function setUp() public {
        ops = new BorrowerExitPerimeterOps();
        controller = new MockQuoteController();
        bytesController = new MockBytesController();
        asset = new MockERC20();
        // Pin the controller in the Ops' OWN storage (direct call runs there),
        // and a dummy wrbtcToken so payoutAsset != wrbtc → ERC20 fee leg.
        vm.store(address(ops), CTRL_SLOT, bytes32(uint256(uint160(address(controller)))));
        vm.store(address(ops), WRBTC_SLOT, bytes32(uint256(uint160(DUMMY_WRBTC))));
    }

    // ── #1 quoteIsValid ⟺ conservation ──────────────────────────────────────

    /// A quote the gate accepts MUST satisfy the conservation invariants.
    function testFuzz_validImpliesConservation(
        uint16 rateBps,
        uint256 feeAmount,
        uint256 netAmount,
        address feeReceiver,
        uint256 gross
    ) public pure {
        IExitFeeController.ExitFeeQuote memory q;
        q.rateBps = rateBps;
        q.feeAmount = feeAmount;
        q.netAmount = netAmount;
        q.feeReceiver = feeReceiver;

        if (PerimeterLib.quoteIsValid(q, gross)) {
            require(feeReceiver != address(0), "v:receiver");
            require(feeAmount <= gross, "v:fee<=gross");
            require(netAmount == gross - feeAmount, "v:net==gross-fee");
            require(rateBps <= 10000, "v:rate<=10000");
        }
    }

    /// The converse: any quote that satisfies the invariants MUST be accepted.
    function testFuzz_conservationImpliesValid(
        uint16 rateBps,
        uint256 feeAmount,
        address feeReceiver,
        uint256 gross
    ) public pure {
        if (feeReceiver == address(0) || feeAmount > gross || rateBps > 10000) return;
        IExitFeeController.ExitFeeQuote memory q;
        q.active = true;
        q.rateBps = rateBps;
        q.feeAmount = feeAmount;
        q.netAmount = gross - feeAmount;
        q.feeReceiver = feeReceiver;
        require(PerimeterLib.quoteIsValid(q, gross), "c:should-be-valid");
    }

    // ── #2 safeQuote decode is total (never reverts) ────────────────────────

    /// For ANY bytes the controller returns, safeQuote returns without
    /// reverting, and a non-decoded result falls open to CONTROLLER_REVERT with
    /// net == gross.
    function testFuzz_safeQuoteNeverReverts(bytes memory ret, uint256 gross) public {
        bytesController.set(ret);
        IExitFeeController.ExitFeeQuote memory q = PerimeterLib.safeQuote(
            address(bytesController),
            bytes32(0),
            address(0),
            address(0),
            gross
        );
        if (q.reason == uint8(IExitFeeController.SkipReason.CONTROLLER_REVERT)) {
            require(q.netAmount == gross, "cr:net==gross");
            require(q.feeAmount == 0, "cr:fee==0");
            require(!q.active, "cr:inactive");
        }
    }

    /// An unpinned controller (address(0)) always falls open.
    function testFuzz_safeQuoteUnpinnedFailsOpen(uint256 gross) public view {
        IExitFeeController.ExitFeeQuote memory q = PerimeterLib.safeQuote(
            address(0),
            bytes32(0),
            address(0),
            address(0),
            gross
        );
        require(q.netAmount == gross, "u:net==gross");
        require(q.feeAmount == 0 && !q.active, "u:inactive");
        require(q.reason == uint8(IExitFeeController.SkipReason.CONTROLLER_REVERT), "u:reason");
    }

    // ── #3 chargeExitFeeAndPay: bounded, conserving, total ──────────────────

    /// Arbitrary controller quote: the charge never over-pays, conserves value
    /// (fee transferred == gross - toUser), and never reverts.
    function testFuzz_chargeBoundedAndConserving(
        bool active,
        uint16 rateBps,
        uint256 feeAmount,
        uint256 netAmount,
        address feeReceiver,
        uint8 reason,
        uint256 gross
    ) public {
        gross = gross % 1e30; // keep mint arithmetic sane
        // exclude receivers that alias the accounting parties
        vm.assume(feeReceiver != address(ops));
        vm.assume(feeReceiver != address(asset));

        IExitFeeController.ExitFeeQuote memory q;
        q.active = active;
        q.rateBps = rateBps;
        q.feeAmount = feeAmount;
        q.netAmount = netAmount;
        q.feeReceiver = feeReceiver;
        q.reason = reason;
        controller.set(q);

        asset.mint(address(ops), gross);
        uint256 opsBefore = asset.balanceOf(address(ops));

        uint256 toUser = ops.chargeExitFeeAndPay(
            bytes32(0),
            address(this), // subProduct (immaterial to the split)
            address(0x1234), // receiver
            address(asset),
            gross
        );

        require(toUser <= gross, "split:toUser<=gross");
        require(toUser == gross || toUser == netAmount, "split:toUser in {gross,net}");
        uint256 feeTransferred = opsBefore - asset.balanceOf(address(ops));
        require(feeTransferred == gross - toUser, "split:conservation");
    }

    /// A VALID active quote is charged exactly: user gets net, feeReceiver gets
    /// the fee, value conserved.
    function testFuzz_chargeValidQuote(
        uint16 rateBps,
        uint256 feeAmount,
        address feeReceiver,
        uint256 gross
    ) public {
        gross = gross % 1e30;
        feeAmount = gross == 0 ? 0 : feeAmount % gross; // 0 <= fee < gross
        vm.assume(feeReceiver != address(0));
        vm.assume(feeReceiver != address(ops));
        vm.assume(feeReceiver != address(asset));
        vm.assume(feeAmount > 0);
        if (rateBps > 10000) rateBps = 10000;

        IExitFeeController.ExitFeeQuote memory q;
        q.active = true;
        q.rateBps = rateBps;
        q.feeAmount = feeAmount;
        q.netAmount = gross - feeAmount;
        q.feeReceiver = feeReceiver;
        q.reason = uint8(IExitFeeController.SkipReason.NONE);
        controller.set(q);

        asset.mint(address(ops), gross);
        uint256 feeRecvBefore = asset.balanceOf(feeReceiver);

        uint256 toUser = ops.chargeExitFeeAndPay(
            bytes32(0),
            address(this),
            address(0x1234),
            address(asset),
            gross
        );

        require(toUser == gross - feeAmount, "valid:toUser==net");
        require(
            asset.balanceOf(feeReceiver) - feeRecvBefore == feeAmount,
            "valid:feeReceiver==fee"
        );
    }
}
