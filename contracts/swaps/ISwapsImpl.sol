/**
 * Copyright 2017-2021, bZeroX, LLC <https://bzx.network/>. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../interfaces/IERC20.sol";
import "./connectors/interfaces/ISovrynSwapNetwork.sol";

interface ISwapsImpl {
    function internalExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address sovrynSwapContractRegistryAddress,
        IERC20[] calldata defaultPath
    ) external view returns (uint256 expectedReturn);

    function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress)
        external
        view
        returns (ISovrynSwapNetwork);
}
