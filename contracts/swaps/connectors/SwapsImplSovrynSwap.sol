pragma solidity 0.5.17;

import "../../core/State.sol";
import "../../feeds/IPriceFeeds.sol";
import "../../openzeppelin/SafeERC20.sol";
import "../ISwapsImpl.sol";
import "./interfaces/ISovrynSwapNetwork.sol";
import "./interfaces/IContractRegistry.sol";

/**
 * @title Swaps Implementation Sovryn contract.
 *
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the implementation of swap process and rate
 * calculations for Sovryn network.
 * */
contract SwapsImplSovrynSwap is State, ISwapsImpl {
    using SafeERC20 for IERC20;

    /// bytes32 contractName = hex"42616e636f724e6574776f726b"; /// "SovrynSwapNetwork"

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
     * @notice Get the expected return amount when exchanging the given
     *   amount of source tokens.
     *
     * @notice Right now, this function is being called directly by _swapsExpectedReturn from the protocol
     * So, this function is not using getConversionPath function since it will try to read the defaultPath storage which is stored in the protocol's slot, and it will cause an issue for direct call.
     * Instead, this function is accepting additional parameters called defaultPath which value can be declared by the caller (protocol in this case).
     *
     * @param sourceTokenAddress The address of the source token contract.
     * @param destTokenAddress The address of the destination token contract.
     * @param sourceTokenAmount The amount of source tokens to get the return for.
     * @param sovrynSwapContractRegistry The sovryn swap contract reigstry address.
     * @param defaultPath The default path for specific pairs.
     * */
    function internalExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address sovrynSwapContractRegistry,
        IERC20[] memory defaultPath
    ) public view returns (uint256 expectedReturn) {
        ISovrynSwapNetwork sovrynSwapNetwork =
            getSovrynSwapNetworkContract(sovrynSwapContractRegistry);

        IERC20[] memory path =
            defaultPath.length >= 3
                ? defaultPath
                : sovrynSwapNetwork.conversionPath(
                    IERC20(sourceTokenAddress),
                    IERC20(destTokenAddress)
                );

        /// Is returning the total amount of destination tokens.
        expectedReturn = sovrynSwapNetwork.rateByPath(path, sourceTokenAmount);
    }
}
