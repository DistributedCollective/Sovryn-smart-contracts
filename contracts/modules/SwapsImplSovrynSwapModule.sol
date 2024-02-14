pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../swaps/connectors/SwapsImplSovrynSwapLib.sol";
import "../events/ModulesCommonEvents.sol";

contract SwapsImplSovrynSwapModule is State, ModulesCommonEvents {
    /**
     * @notice Empty public constructor.
     * */
    constructor() public {}

    /**
     * @notice Fallback function is to react to receiving value (rBTC).
     * */
    function() external {
        revert("fallback not allowed");
    }

    /**
     * @notice Set function selectors on target contract.
     *
     * @param target The address of the target contract.
     * */
    function initialize(address target) external onlyOwner {
        address prevModuleContractAddress =
            logicTargets[this.getSovrynSwapNetworkContract.selector];
        _setTarget(this.getSovrynSwapNetworkContract.selector, target);
        _setTarget(this.getContractHexName.selector, target);
        _setTarget(this.swapsImplExpectedRate.selector, target);
        _setTarget(this.swapsImplExpectedReturn.selector, target);
        emit ProtocolModuleContractReplaced(
            prevModuleContractAddress,
            target,
            "SwapsImplSovrynSwapModule"
        );
    }

    /**
     * Get the hex name of a contract.
     * @param source The name of the contract.
     * */
    function getContractHexName(string memory source) public pure returns (bytes32 result) {
        return SwapsImplSovrynSwapLib.getContractHexName(source);
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
        return SwapsImplSovrynSwapLib.getSovrynSwapNetworkContract(sovrynSwapRegistryAddress);
    }

    /**
     * @notice Get the expected rate for 1 source token when exchanging the
     *   given amount of source tokens.
     *
     * @param sourceTokenAddress The address of the source token contract.
     * @param destTokenAddress The address of the destination token contract.
     * @param sourceTokenAmount The amount of source tokens to get the rate for.
     * */
    function swapsImplExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount
    ) external view returns (uint256) {
        return
            SwapsImplSovrynSwapLib.getExpectedRate(
                sourceTokenAddress,
                destTokenAddress,
                sourceTokenAmount
            );
    }

    /**
     * @notice Get the expected return amount when exchanging the given
     *   amount of source tokens.
     *
     * @notice Right now, this function is being called directly by _swapsExpectedReturn from the protocol
     * So, this function is not using _getConversionPath function since it will try to read the defaultPath storage which is stored in the protocol's slot, and it will cause an issue for direct call.
     * Instead, this function is accepting additional parameters called defaultPath which value can be declared by the caller (protocol in this case).
     *
     * @param sourceTokenAddress The address of the source token contract.
     * @param destTokenAddress The address of the destination token contract.
     * @param sourceTokenAmount The amount of source tokens to get the return for.
     * */
    function swapsImplExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount
    ) external view returns (uint256 expectedReturn) {
        return
            SwapsImplSovrynSwapLib.getExpectedReturn(
                sourceTokenAddress,
                destTokenAddress,
                sourceTokenAmount
            );
    }
}
