/**
 * Copyright 2017-2021, bZeroX, LLC <https://bzx.network/>. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../interfaces/IERC20.sol";

interface ISwapsImpl {
    function internalSwap(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        address returnToSenderAddress,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount
    ) external payable returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);

    function internalExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address optionalContractAddress
    ) external view returns (uint256);

    function internalExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address sovrynSwapContractRegistryAddress,
        IERC20[] calldata defaultPath
    ) external view returns (uint256 expectedReturn);
}
