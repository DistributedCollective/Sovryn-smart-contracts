/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../interfaces/IWethERC20.sol";
import "../openzeppelin/Address.sol";

contract Constants {
    IWethERC20 public wethToken;
    address internal protocolTokenAddress;

    function _setWethToken(
        address _wethTokenAddress)
    internal
    {
        require(Address.isContract(_wethTokenAddress), "_wethTokenAddress not a contract");
        wethToken = IWethERC20(_wethTokenAddress);
    }

    function _setProtocolTokenAddress(
        address _protocolTokenAddress)
    internal
    {
        require(Address.isContract(_protocolTokenAddress), "_protocolTokenAddress not a contract");
        protocolTokenAddress = _protocolTokenAddress;
    }
}
