// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../contracts/connectors/loantoken/LoanTokenLogicShared.sol";
import "../../contracts/interfaces/perimeter/IExitFeeController.sol";

/// Foundry fuzz coverage for the INLINE iToken charge hook
/// (`LoanTokenLogicShared._chargeExitFeeAndPay`) — the lender-burn twin of the
/// protocol-side split fuzzed in `PerimeterSplit.fuzz.t.sol`.
///
/// The two hooks are hand-written twins: the protocol tree charges through a
/// delegatecall into `BorrowerExitPerimeterOps`, the iToken tree charges inline
/// with no backstop. Fuzzing only the former leaves the latter's behaviour
/// under ARBITRARY controller quotes asserted by example alone. The properties
/// here are the same three the protocol split proves:
///
///   #1 never over-pays  — the user leg is `gross` or the quoted `net`, nothing
///                         else, for any quote shape.
///   #2 conserves value  — what leaves the iToken equals what the receiver and
///                         the fee receiver gained.
///   #3 is total         — the hook never reverts, so a hostile or broken
///                         controller can never block a burn (a fuzz function
///                         that reverts is a failing case).
///
/// The contracts are 0.5.17, so the test is too (forge-std is 0.8): properties
/// are asserted with `require` and cheatcodes come from an inline Vm interface.

interface VmITokenSplit {
    function assume(bool) external;
}

/// Unchecked ERC20: no SafeMath, no zero-address guard, always returns true.
/// Deliberately total, so the only reverts a fuzz run can surface come from the
/// hook itself rather than from the underlying token.
contract MockUncheckedERC20 {
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

/// Returns a settable quote verbatim — the Foundry twin of
/// `contracts/mockup/perimeter/MockArbitraryQuoteExitFeeController.sol`.
contract MockVerbatimQuoteController {
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

/// The iToken reads its controller THROUGH the protocol
/// (`PerimeterLib.safeControllerLookup(sovrynContractAddress)`), so the harness
/// needs a protocol stub serving `exitFeeController()`.
contract MockProtocolPointer {
    address public exitFeeController;

    constructor(address ctrl) public {
        exitFeeController = ctrl;
    }
}

/// Exposes the internal inline hook, and the two storage fields it reads, on
/// the REAL production base contract — no reimplementation.
contract ITokenChargeHarness is LoanTokenLogicShared {
    function initTest(address protocol, address underlying) public {
        sovrynContractAddress = protocol;
        loanTokenAddress = underlying;
    }

    function charge(address receiver, uint256 gross) public {
        _chargeExitFeeAndPay(receiver, gross, "harness: user leg");
    }
}

contract PerimeterITokenSplitFuzzTest {
    VmITokenSplit internal constant vm = VmITokenSplit(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    ITokenChargeHarness internal iToken;
    MockVerbatimQuoteController internal controller;
    MockProtocolPointer internal protocol;
    MockUncheckedERC20 internal asset;

    function setUp() public {
        controller = new MockVerbatimQuoteController();
        protocol = new MockProtocolPointer(address(controller));
        asset = new MockUncheckedERC20();
        iToken = new ITokenChargeHarness();
        iToken.initTest(address(protocol), address(asset));
    }

    /// Exclude accounting parties whose balances would alias each other.
    function _assumeDistinct(address receiver, address feeReceiver) internal {
        vm.assume(receiver != address(iToken) && receiver != address(asset));
        vm.assume(feeReceiver != address(iToken) && feeReceiver != address(asset));
        vm.assume(receiver != feeReceiver);
    }

    // ── Arbitrary quote: bounded, conserving, total ─────────────────────────

    /// For ANY quote shape the controller can return — including the two the
    /// honest `MockExitFeeController` cannot express (zero fee receiver, net
    /// desynced from gross) — the inline hook pays the receiver either the full
    /// gross or exactly the quoted net, conserves value, and never reverts.
    function testFuzz_inlineChargeBoundedAndConserving(
        bool active,
        uint16 rateBps,
        uint256 feeAmount,
        uint256 netAmount,
        address feeReceiver,
        uint8 reason,
        uint256 gross,
        address receiver
    ) public {
        gross = gross % 1e30; // keep mint arithmetic sane
        _assumeDistinct(receiver, feeReceiver);

        IExitFeeController.ExitFeeQuote memory q;
        q.active = active;
        q.rateBps = rateBps;
        q.feeAmount = feeAmount;
        q.netAmount = netAmount;
        q.feeReceiver = feeReceiver;
        q.reason = reason;
        controller.set(q);

        asset.mint(address(iToken), gross);
        uint256 poolBefore = asset.balanceOf(address(iToken));
        uint256 receiverBefore = asset.balanceOf(receiver);
        uint256 feeRecvBefore = asset.balanceOf(feeReceiver);

        iToken.charge(receiver, gross);

        uint256 toUser = asset.balanceOf(receiver) - receiverBefore;
        uint256 toFee = asset.balanceOf(feeReceiver) - feeRecvBefore;

        require(toUser <= gross, "split:toUser<=gross");
        require(toUser == gross || toUser == netAmount, "split:toUser in {gross,net}");
        require(
            poolBefore - asset.balanceOf(address(iToken)) == toUser + toFee,
            "split:conservation"
        );
    }

    /// A quote that FAILS the defensive gate must never move fee value: the
    /// receiver is made whole with the full gross. This is the property the
    /// JS `LenderExit.adversarial` arms pin by example, generalised.
    function testFuzz_inlineInvalidQuotePaysFullGross(
        uint16 rateBps,
        uint256 feeAmount,
        uint256 netAmount,
        address feeReceiver,
        uint256 gross,
        address receiver
    ) public {
        gross = gross % 1e30;
        _assumeDistinct(receiver, feeReceiver);
        vm.assume(feeAmount > 0);

        IExitFeeController.ExitFeeQuote memory q;
        q.active = true;
        q.rateBps = rateBps;
        q.feeAmount = feeAmount;
        q.netAmount = netAmount;
        q.feeReceiver = feeReceiver;
        q.reason = uint8(IExitFeeController.SkipReason.NONE);
        controller.set(q);

        // Only look at quotes the gate REJECTS.
        vm.assume(!PerimeterLib.quoteIsValid(q, gross));

        asset.mint(address(iToken), gross);
        uint256 receiverBefore = asset.balanceOf(receiver);
        uint256 feeRecvBefore = asset.balanceOf(feeReceiver);

        iToken.charge(receiver, gross);

        require(asset.balanceOf(receiver) - receiverBefore == gross, "invalid:full gross to user");
        require(asset.balanceOf(feeReceiver) == feeRecvBefore, "invalid:no fee moved");
    }

    /// A VALID active quote is charged exactly: the receiver gets net, the fee
    /// receiver gets the fee.
    function testFuzz_inlineChargeValidQuote(
        uint16 rateBps,
        uint256 feeAmount,
        address feeReceiver,
        uint256 gross,
        address receiver
    ) public {
        gross = gross % 1e30;
        feeAmount = gross == 0 ? 0 : feeAmount % gross; // 0 <= fee < gross
        vm.assume(feeAmount > 0);
        vm.assume(feeReceiver != address(0));
        _assumeDistinct(receiver, feeReceiver);
        if (rateBps > 10000) rateBps = 10000;

        IExitFeeController.ExitFeeQuote memory q;
        q.active = true;
        q.rateBps = rateBps;
        q.feeAmount = feeAmount;
        q.netAmount = gross - feeAmount;
        q.feeReceiver = feeReceiver;
        q.reason = uint8(IExitFeeController.SkipReason.NONE);
        controller.set(q);

        asset.mint(address(iToken), gross);
        uint256 receiverBefore = asset.balanceOf(receiver);
        uint256 feeRecvBefore = asset.balanceOf(feeReceiver);

        iToken.charge(receiver, gross);

        require(
            asset.balanceOf(receiver) - receiverBefore == gross - feeAmount,
            "valid:toUser==net"
        );
        require(
            asset.balanceOf(feeReceiver) - feeRecvBefore == feeAmount,
            "valid:feeReceiver==fee"
        );
    }
}
