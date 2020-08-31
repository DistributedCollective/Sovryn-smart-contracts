/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../interfaces/IWbtcERC20.sol";
import "../openzeppelin/Address.sol";

contract Constants {
    IWbtcERC20 public wbtcToken;
    address internal protocolTokenAddress;

    function _setwbtcToken(
        address _wbtcTokenAddress)
        internal
    {
        require(Address.isContract(_wbtcTokenAddress), "_wbtcTokenAddress not a contract");
        wbtcToken = IWbtcERC20(_wbtcTokenAddress);
    }

    function _setProtocolTokenAddress(
        address _protocolTokenAddress)
        internal
    {
        require(Address.isContract(_protocolTokenAddress), "_protocolTokenAddress not a contract");
        protocolTokenAddress = _protocolTokenAddress;
    }
}
