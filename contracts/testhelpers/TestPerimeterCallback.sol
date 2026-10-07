pragma solidity 0.5.17;

/// @notice Configurable native receiver for exercising authorized callback operations in tests.
contract TestPerimeterCallback {
    address public trigger;
    address public target;
    bytes public callData;
    bool public armed;
    bool public rejectPayment;
    uint256 public callbackCount;
    bool public callbackSucceeded;
    bytes public callbackResult;

    function configure(
        address _trigger,
        address _target,
        bytes calldata _callData,
        bool _rejectPayment
    ) external {
        trigger = _trigger;
        target = _target;
        callData = _callData;
        armed = true;
        rejectPayment = _rejectPayment;
    }

    function execute(
        address _target,
        bytes calldata _callData
    ) external payable returns (bytes memory) {
        (bool ok, bytes memory result) = _target.call.value(msg.value)(_callData);
        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        return result;
    }

    function() external payable {
        if (armed && msg.sender == trigger) {
            armed = false;
            callbackCount++;
            (callbackSucceeded, callbackResult) = target.call(callData);
        }
        require(!rejectPayment, "TestCallback: payment rejected");
    }
}
