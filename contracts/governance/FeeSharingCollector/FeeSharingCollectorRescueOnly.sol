// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

interface ICollectorRescueToken {
    function balanceOf(address account) external view returns (uint256);
}

/** @notice Temporary proxy logic: only its proxy owner can move custody to itself. */
contract FeeSharingCollectorRescueOnly {
    bytes32 private constant PROXY_OWNER_SLOT = keccak256("key.proxy.owner");
    bytes32 private constant RESCUE_LOCK_SLOT =
        keccak256("sovryn.feeCollector.rescueOnly.lock.v1");

    event NativeRescued(address indexed receiver, uint256 amount);
    event TokenRescued(address indexed token, address indexed receiver, uint256 amount);

    modifier onlyProxyOwner() {
        require(msg.sender == _proxyOwner() && msg.sender != address(0), "RESCUE:not-owner");
        _;
    }

    modifier rescueLock() {
        bytes32 slot = RESCUE_LOCK_SLOT;
        uint256 entered;
        assembly {
            entered := sload(slot)
        }
        require(entered == 0, "RESCUE:reentrant");
        assembly {
            sstore(slot, 1)
        }
        _;
        assembly {
            sstore(slot, 0)
        }
    }

    function _proxyOwner() private view returns (address owner) {
        bytes32 slot = PROXY_OWNER_SLOT;
        assembly {
            owner := sload(slot)
        }
    }

    function rescueNative() external onlyProxyOwner rescueLock {
        address payable receiver = address(uint160(_proxyOwner()));
        require(receiver != address(this), "RESCUE:self-recipient");
        uint256 amount = address(this).balance;
        if (amount != 0) {
            uint256 beforeBalance = receiver.balance;
            (bool success, ) = receiver.call.value(amount)("");
            require(success, "RESCUE:native-transfer");
            require(
                receiver.balance >= beforeBalance && receiver.balance - beforeBalance == amount,
                "RESCUE:native-receipt"
            );
            require(address(this).balance == 0, "RESCUE:native-remains");
        }
        emit NativeRescued(receiver, amount);
    }

    function rescueERC20(address token) external onlyProxyOwner rescueLock {
        require(token != address(0) && token != address(this), "RESCUE:invalid-token");
        address receiver = _proxyOwner();
        require(receiver != address(this), "RESCUE:self-recipient");
        ICollectorRescueToken asset = ICollectorRescueToken(token);
        uint256 amount = asset.balanceOf(address(this));
        if (amount != 0) {
            uint256 beforeBalance = asset.balanceOf(receiver);
            (bool success, bytes memory result) = token.call(
                abi.encodeWithSelector(
                    bytes4(keccak256("transfer(address,uint256)")),
                    receiver,
                    amount
                )
            );
            require(
                success &&
                    (result.length == 0 || (result.length == 32 && abi.decode(result, (bool)))),
                "RESCUE:token-transfer"
            );
            uint256 afterBalance = asset.balanceOf(receiver);
            require(
                afterBalance >= beforeBalance && afterBalance - beforeBalance == amount,
                "RESCUE:token-receipt"
            );
            require(asset.balanceOf(address(this)) == 0, "RESCUE:token-remains");
        }
        emit TokenRescued(token, receiver, amount);
    }

    function() external payable {
        revert("RESCUE:maintenance");
    }
}
