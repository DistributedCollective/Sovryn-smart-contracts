/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../../../core/State.sol";
import "../../../openzeppelin/SafeERC20.sol";
import "../../ISwapsImpl.sol";
import "../../../feeds/IPriceFeeds.sol";
import "../../../testhelpers/TestToken.sol";
import "../interfaces/IContractRegistry.sol";

/**
 * @title Swaps Implementation Local contract.
 *
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the implementation of swap process and rate calculations.
 * */
contract SwapsImplLocal is State, ISwapsImpl {
    using SafeERC20 for IERC20;

    /**
     * Get the hex name of a contract.
     * @param source The name of the contract.
     * */
    function getContractHexName(string memory source) public pure returns (bytes32 result) {
        assembly {
            result := mload(add(source, 32))
        }
    }

    /**
     * Look up the Sovryn swap network contract registered at the given address.
     * @param sovrynSwapRegistryAddress The address of the registry.
     * */
    function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress)
        public
        view
        returns (ISovrynSwapNetwork)
    {
        /// State variable sovrynSwapContractRegistryAddress is part of
        /// State.sol and set in ProtocolSettings.sol and this function
        /// needs to work without delegate call as well -> therefore pass it.
        IContractRegistry contractRegistry = IContractRegistry(sovrynSwapRegistryAddress);
        return
            ISovrynSwapNetwork(
                contractRegistry.addressOf(getContractHexName("SovrynSwapNetwork"))
            );
    }

    /**
     * @notice Calculate the expected return of swapping a given amount
     *   of tokens.
     *
     * @param sourceTokenAddress The address of the source tokens.
     * @param destTokenAddress The address of the destiny tokens.
     * @param sourceTokenAmount The amount of source tokens.
     * @param unused Fourth parameter ignored.
     * @param defaultPath defaultPath for swap.
     *
     * @return precision The expected return.
     * */
    function internalExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address unused,
        IERC20[] memory defaultPath
    ) public view returns (uint256) {
        (uint256 sourceToDestRate, uint256 sourceToDestPrecision) =
            IPriceFeeds(priceFeeds).queryRate(sourceTokenAddress, destTokenAddress);

        return sourceTokenAmount.mul(sourceToDestRate).div(sourceToDestPrecision);
    }
}
