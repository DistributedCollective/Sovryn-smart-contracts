// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../contracts/utils/BorrowerExitPerimeterOps.sol";
import "../../contracts/interfaces/perimeter/IExitFeeController.sol";

/// Stateful invariant for the Perimeter fee-leg (#4). A handler drives a random
/// sequence of charges — native (WRBTC) and ERC20, normal and hostile fee
/// receivers — through a payable proxy that delegatecalls the Ops (the real
/// execution context: the Ops runs in a contract that can receive the
/// unwrapped RBTC). After ANY sequence:
///   - no orphan native is ever left in the host (the native re-wrap restores
///     WRBTC on a failed send);
///   - value is conserved per asset: the host balance == the net still owed to
///     users (sum of toUser);
/// and foundry.toml's `fail_on_revert = true` independently proves the charge
/// never reverts — the fail-open guarantee — even with a hostile fee receiver.

interface Vm {
    function store(address, bytes32, bytes32) external;
    function deal(address, uint256) external;
}

contract FeeLegController {
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

/// ERC20 whose `transfer` returns false for blocked recipients (fee-leg
/// fail-open without reverting).
contract FeeLegERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public blocked;

    function mint(address to, uint256 amt) public {
        balanceOf[to] += amt;
    }

    function setBlocked(address who, bool b) public {
        blocked[who] = b;
    }

    function transfer(address to, uint256 amt) public returns (bool) {
        if (blocked[to]) return false;
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;
        return true;
    }
}

/// Minimal WRBTC: deposit mints, withdraw burns + sends native to the caller.
contract FeeLegWrbtc {
    mapping(address => uint256) public balanceOf;

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 wad) external {
        balanceOf[msg.sender] -= wad;
        (bool ok, ) = msg.sender.call.value(wad)("");
        require(ok, "wrbtc:withdraw");
    }

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function() external payable {}
}

/// Fee receiver that reverts on native receipt (forces the re-wrap path).
contract FeeLegHostile {
    function() external payable {
        revert("hostile");
    }
}

/// Payable proxy that delegatecalls the Ops impl — gives the Ops code a context
/// that can receive the unwrapped RBTC (as the sovrynProtocol proxy does).
contract OpsHost {
    bytes32 internal constant IMPL_SLOT = keccak256("test.perimeter.opsImpl");

    function setImpl(address impl) external {
        bytes32 s = IMPL_SLOT;
        assembly {
            sstore(s, impl)
        }
    }

    function() external payable {
        if (msg.data.length == 0) return; // accept native (withdraw inbound)
        bytes32 s = IMPL_SLOT;
        address impl;
        assembly {
            impl := sload(s)
            calldatacopy(0, 0, calldatasize)
            let r := delegatecall(gas, impl, 0, calldatasize, 0, 0)
            returndatacopy(0, 0, returndatasize)
            switch r
            case 0 {
                revert(0, returndatasize)
            }
            default {
                return(0, returndatasize)
            }
        }
    }
}

contract FeeLegHandler {
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    bytes32 internal constant CTRL_SLOT =
        bytes32(uint256(keccak256("sovryn.perimeterExitFeeController")) - 1);
    bytes32 internal constant WRBTC_SLOT = bytes32(uint256(45));
    address internal constant USER = address(0xCAFE);

    OpsHost public host;
    FeeLegController public controller;
    FeeLegWrbtc public wrbtc;
    FeeLegERC20 public erc20;
    FeeLegHostile public hostile;
    address public normal;

    uint256 public ghostNetWrbtc;
    uint256 public ghostNetErc20;

    constructor() public {
        BorrowerExitPerimeterOps ops = new BorrowerExitPerimeterOps();
        host = new OpsHost();
        host.setImpl(address(ops));

        controller = new FeeLegController();
        wrbtc = new FeeLegWrbtc();
        erc20 = new FeeLegERC20();
        hostile = new FeeLegHostile();
        normal = address(0xB0B);

        // Pin controller + wrbtcToken in the HOST storage (where the delegated
        // Ops code reads them).
        vm.store(address(host), CTRL_SLOT, bytes32(uint256(uint160(address(controller)))));
        vm.store(address(host), WRBTC_SLOT, bytes32(uint256(uint160(address(wrbtc)))));
    }

    function charge(
        uint256 gross,
        uint256 feeAmount,
        bool useNative,
        bool hostileReceiver
    ) public {
        gross = gross % 1e24;
        feeAmount = gross == 0 ? 0 : feeAmount % (gross + 1); // 0..gross

        address feeReceiver;
        address asset;
        if (useNative) {
            feeReceiver = hostileReceiver ? address(hostile) : normal;
            asset = address(wrbtc);
            wrbtc.mint(address(host), gross);
            vm.deal(address(wrbtc), address(wrbtc).balance + gross); // native backing
        } else {
            feeReceiver = normal;
            asset = address(erc20);
            erc20.setBlocked(normal, hostileReceiver); // hostile → transfer returns false
            erc20.mint(address(host), gross);
        }

        IExitFeeController.ExitFeeQuote memory q;
        q.active = true;
        q.rateBps = 0;
        q.feeAmount = feeAmount;
        q.netAmount = gross - feeAmount;
        q.feeReceiver = feeReceiver;
        q.reason = 0;
        controller.set(q);

        uint256 toUser = BorrowerExitPerimeterOps(address(host)).chargeExitFeeAndPay(
            bytes32(0),
            address(this),
            USER,
            asset,
            gross
        );

        if (useNative) ghostNetWrbtc += toUser;
        else ghostNetErc20 += toUser;
    }
}

contract PerimeterFeeLegInvariant {
    FeeLegHandler internal handler;

    function setUp() public {
        handler = new FeeLegHandler();
    }

    function targetContracts() public view returns (address[] memory t) {
        t = new address[](1);
        t[0] = address(handler);
    }

    /// The native re-wrap never strands RBTC in the host.
    function invariant_noOrphanNative() public view {
        require(address(handler.host()).balance == 0, "orphan native");
    }

    /// Per-asset conservation: the host holds exactly the net still owed.
    function invariant_wrbtcConserved() public view {
        require(
            handler.wrbtc().balanceOf(address(handler.host())) == handler.ghostNetWrbtc(),
            "wrbtc conservation"
        );
    }

    function invariant_erc20Conserved() public view {
        require(
            handler.erc20().balanceOf(address(handler.host())) == handler.ghostNetErc20(),
            "erc20 conservation"
        );
    }
}
