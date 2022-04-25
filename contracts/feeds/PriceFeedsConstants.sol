/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../interfaces/IWrbtcERC20.sol";
import "../openzeppelin/Address.sol";

/**
 * @title The Price Feeds Constants contract.
 *
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract keep the addresses of token instances for wrBTC, base token
 * and protocol token.
 * */
contract Constants {
    IWrbtcERC20 public wrbtcToken;
    IWrbtcERC20 public baseToken;
    address internal protocolTokenAddress;

    /**
     * @notice Set wrBTC token address.
     *
     * @param _wrbtcTokenAddress The address of the wrapped wrBTC token.
     * */
    function _setWrbtcToken(address _wrbtcTokenAddress) internal {
        require(Address.isContract(_wrbtcTokenAddress), "_wrbtcTokenAddress not a contract");
        wrbtcToken = IWrbtcERC20(_wrbtcTokenAddress);
    }

    /**
     * @notice Set protocol token address.
     *
     * @param _protocolTokenAddress The address of the protocol token.
     * */
    function _setProtocolTokenAddress(address _protocolTokenAddress) internal {
        require(Address.isContract(_protocolTokenAddress), "_protocolTokenAddress not a contract");
        protocolTokenAddress = _protocolTokenAddress;
    }

    /**
     * @notice Set base token address.
     *
     * @param _baseTokenAddress The address of the base token.
     * */
    function _setBaseToken(address _baseTokenAddress) internal {
        require(Address.isContract(_baseTokenAddress), "_baseTokenAddress not a contract");
        baseToken = IWrbtcERC20(_baseTokenAddress);
    }
}
