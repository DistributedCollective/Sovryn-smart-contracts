// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../interfaces/perimeter/IExitDelayQueueHook.sol";
import "../../interfaces/IERC20.sol";
import "../../interfaces/IWrbtcERC20.sol";
import "../../openzeppelin/Address.sol";
import "../../openzeppelin/SafeERC20.sol";

/// @title  MockExitDelayQueue
/// @notice Minimal test double for the real 0.8.20 `ExitDelayQueue`, implemented
///         at 0.5.17 so the hardhat suites in this repo can deploy it and wire it
///         behind the product hooks. It mirrors ONLY the behaviour the hooks
///         depend on:
///           - the four `record*` ingress fns (`onlyAllowedSource`), each
///             narrowing to uint128, computing `unlockAt = now + delaySeconds`,
///             proving receipt (pull: transferFrom + measured; measured-delta:
///             surplus >= amount, credit exactly amount), and emitting
///             `ExitQueued`;
///           - the `unwrapOnDelivery` guard (`require(!unwrap || token == wrbtc)`);
///           - an unconditional native `receive()` (via the fallback);
///           - `executeExit`, which pays the immutable receiver (unwrapping WRBTC
///             → native when `unwrapOnDelivery`) after `unlockAt`.
///         It is deliberately NOT the full security model (no block/recovery legs
///         — those are the real queue's, covered by the perimeter Foundry suite).
contract MockExitDelayQueue is IExitDelayQueueHook {
    using Address for address payable;
    using SafeERC20 for IERC20;

    struct Req {
        uint128 amount;
        uint64 createdAt;
        uint64 unlockAt;
        address originator;
        address owner;
        address receiver;
        address token; // address(0) = native
        bytes32 surfaceId;
        address subProduct;
        bool unwrapOnDelivery;
        bool executed;
    }

    address public wrbtc;
    uint32 public minimumDelaySeconds;
    uint256 public lastRequestId;
    mapping(uint256 => Req) internal _requests;
    mapping(address => bool) public allowedSource;
    // token => sum of Queued amounts (backing). address(0) = native.
    mapping(address => uint256) public totalEscrowed;

    event ExitQueued(
        uint256 indexed id,
        address indexed originator,
        address indexed owner,
        address receiver,
        address token,
        uint128 amount,
        uint64 unlockAt,
        bytes32 surfaceId,
        address subProduct
    );
    event ExitExecuted(
        uint256 indexed id,
        address indexed receiver,
        address token,
        uint128 amount
    );

    constructor(address _wrbtc, uint32 _minDelay) public {
        wrbtc = _wrbtc;
        minimumDelaySeconds = _minDelay;
    }

    function() external payable {
        // unconditional native receive() — accepts RBTC from anyone.
    }

    function setAllowedSource(address src, bool ok) external {
        allowedSource[src] = ok;
    }

    modifier onlyAllowedSource() {
        require(allowedSource[msg.sender], "MockQueue: unregistered source");
        _;
    }

    function getRequest(uint256 id) external view returns (Req memory) {
        return _requests[id];
    }

    // ── Ingress ────────────────────────────────────────────────────────────

    function recordERC20Exit(
        address token,
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver,
        bool unwrapOnDelivery
    ) external onlyAllowedSource returns (uint256 id) {
        require(amount > 0, "MockQueue: zero amount");
        require(delaySeconds >= minimumDelaySeconds, "MockQueue: delay below floor");
        require(!unwrapOnDelivery || token == wrbtc, "MockQueue: unwrap non-wrbtc");

        uint256 balBefore = IERC20(token).balanceOf(address(this));
        // pull path: caller must have approved us for `amount`. Use the
        // optional-return `safeTransferFrom` (mirrors the real 0.8.20 queue's
        // SafeERC20) so USDT-style no-return underlyings are supported — a raw
        // high-level `transferFrom` would revert on decode against a no-return
        // signature and mask the iToken-side `_safeApprove` fix under test.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balBefore;
        require(received == amount, "MockQueue: received amount mismatch");

        totalEscrowed[token] += amount;
        Req memory r = _build(
            token,
            amount,
            delaySeconds,
            surfaceId,
            subProduct,
            effOrig,
            effOwner,
            receiver
        );
        r.unwrapOnDelivery = unwrapOnDelivery;
        return _store(r);
    }

    function recordReceivedERC20Exit(
        address token,
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) external onlyAllowedSource returns (uint256 id) {
        require(amount > 0, "MockQueue: zero amount");
        require(delaySeconds >= minimumDelaySeconds, "MockQueue: delay below floor");
        // measured-delta: surplus over backing must cover `amount`; credit exactly.
        uint256 surplus = IERC20(token).balanceOf(address(this)) - totalEscrowed[token];
        require(surplus >= amount, "MockQueue: received amount mismatch");
        totalEscrowed[token] += amount;
        return
            _store(
                _build(
                    token,
                    amount,
                    delaySeconds,
                    surfaceId,
                    subProduct,
                    effOrig,
                    effOwner,
                    receiver
                )
            );
    }

    function recordNativeExit(
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) external payable onlyAllowedSource returns (uint256 id) {
        require(amount > 0, "MockQueue: zero amount");
        require(msg.value == amount, "MockQueue: value mismatch");
        require(delaySeconds >= minimumDelaySeconds, "MockQueue: delay below floor");
        totalEscrowed[address(0)] += amount;
        return
            _store(
                _build(
                    address(0),
                    amount,
                    delaySeconds,
                    surfaceId,
                    subProduct,
                    effOrig,
                    effOwner,
                    receiver
                )
            );
    }

    function recordReceivedNativeExit(
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) external onlyAllowedSource returns (uint256 id) {
        require(amount > 0, "MockQueue: zero amount");
        require(delaySeconds >= minimumDelaySeconds, "MockQueue: delay below floor");
        uint256 surplus = address(this).balance - totalEscrowed[address(0)];
        require(surplus >= amount, "MockQueue: received amount mismatch");
        totalEscrowed[address(0)] += amount;
        return
            _store(
                _build(
                    address(0),
                    amount,
                    delaySeconds,
                    surfaceId,
                    subProduct,
                    effOrig,
                    effOwner,
                    receiver
                )
            );
    }

    function _build(
        address token,
        uint128 amount,
        uint32 delaySeconds,
        bytes32 surfaceId,
        address subProduct,
        address effOrig,
        address effOwner,
        address receiver
    ) internal view returns (Req memory r) {
        r.amount = amount;
        r.createdAt = uint64(block.timestamp);
        r.unlockAt = uint64(block.timestamp + delaySeconds);
        r.originator = effOrig;
        r.owner = effOwner;
        r.receiver = receiver;
        r.token = token;
        r.surfaceId = surfaceId;
        r.subProduct = subProduct;
    }

    function _store(Req memory r) internal returns (uint256 id) {
        id = ++lastRequestId;
        _requests[id] = r;
        emit ExitQueued(
            id,
            r.originator,
            r.owner,
            r.receiver,
            r.token,
            r.amount,
            r.unlockAt,
            r.surfaceId,
            r.subProduct
        );
    }

    // ── Execution (subset) ───────────────────────────────────────────────────

    function executeExit(uint256 id) external {
        Req storage r = _requests[id];
        require(r.amount > 0 && !r.executed, "MockQueue: not queued");
        require(block.timestamp >= r.unlockAt, "MockQueue: not unlocked");
        require(msg.sender == r.originator || msg.sender == r.owner, "MockQueue: not executor");

        r.executed = true;
        totalEscrowed[r.token] -= r.amount;
        uint128 amount = r.amount;
        address receiver = r.receiver;

        if (r.token == address(0)) {
            Address.sendValue(address(uint160(receiver)), amount);
        } else if (r.unwrapOnDelivery) {
            IWrbtcERC20(wrbtc).withdraw(amount);
            Address.sendValue(address(uint160(receiver)), amount);
        } else {
            // optional-return safe transfer (mirrors the real queue) so
            // USDT-style no-return underlyings are paid out without reverting.
            IERC20(r.token).safeTransfer(receiver, amount);
        }
        emit ExitExecuted(id, receiver, r.token, amount);
    }
}
