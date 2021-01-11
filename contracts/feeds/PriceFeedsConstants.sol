/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../interfaces/IWrbtcERC20.sol";
import "../openzeppelin/Address.sol";

contract Constants {
    IWrbtcERC20 public wrbtcToken;
    IWrbtcERC20 public baseToken;
    address internal protocolTokenAddress;

    function _setWrbtcToken(address _wrbtcTokenAddress) internal {
        require(
            Address.isContract(_wrbtcTokenAddress),
            "_wrbtcTokenAddress not a contract"
        );
        wrbtcToken = IWrbtcERC20(_wrbtcTokenAddress);
    }

    function _setProtocolTokenAddress(address _protocolTokenAddress) internal {
        require(
            Address.isContract(_protocolTokenAddress),
            "_protocolTokenAddress not a contract"
        );
        protocolTokenAddress = _protocolTokenAddress;
    }

    function _setBaseToken(address _baseTokenAddress) internal {
        require(
            Address.isContract(_baseTokenAddress),
            "_baseTokenAddress not a contract"
        );
        baseToken = IWrbtcERC20(_baseTokenAddress);
    }
}
