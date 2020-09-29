/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../openzeppelin/SafeERC20.sol";
import "../core/State.sol";


contract VaultController is State {
    using SafeERC20 for IERC20Sovryn;

    event VaultDeposit(
        address indexed asset,
        address indexed from,
        uint256 amount
    );
    event VaultWithdraw(
        address indexed asset,
        address indexed to,
        uint256 amount
    );

    function vaultEtherDeposit(
        address from,
        uint256 value)
        internal
    {
        IWrbtcERC20 _wrbtcToken = wrbtcToken;
        _wrbtcToken.deposit.value(value)();

        emit VaultDeposit(
            address(_wrbtcToken),
            from,
            value
        );
    }

    function vaultEtherWithdraw(
        address to,
        uint256 value)
        internal
    {
        if (value != 0) {
            IWrbtcERC20 _wrbtcToken = wrbtcToken;
            uint256 balance = address(this).balance;
            if (value > balance) {
                _wrbtcToken.withdraw(value - balance);
            }
            AddressSovryn.sendValue(to, value);

            emit VaultWithdraw(
                address(_wrbtcToken),
                to,
                value
            );
        }
    }

    function vaultDeposit(
        address token,
        address from,
        uint256 value)
        internal
    {
        if (value != 0) {
            IERC20Sovryn(token).safeTransferFrom(
                from,
                address(this),
                value
            );

            emit VaultDeposit(
                token,
                from,
                value
            );
        }
    }

    function vaultWithdraw(
        address token,
        address to,
        uint256 value)
        internal
    {
        if (value != 0) {
            IERC20Sovryn(token).safeTransfer(
                to,
                value
            );

            emit VaultWithdraw(
                token,
                to,
                value
            );
        }
    }

    function vaultTransfer(
        address token,
        address from,
        address to,
        uint256 value)
        internal
    {
        if (value != 0) {
            if (from == address(this)) {
                IERC20Sovryn(token).safeTransfer(
                    to,
                    value
                );
            } else {
                IERC20Sovryn(token).safeTransferFrom(
                    from,
                    to,
                    value
                );
            }
        }
    }

    function vaultApprove(
        address token,
        address to,
        uint256 value)
        internal
    {
        if (value != 0 && IERC20Sovryn(token).allowance(address(this), to) != 0) {
            IERC20Sovryn(token).safeApprove(to, 0);
        }
        IERC20Sovryn(token).safeApprove(to, value);
    }
}
