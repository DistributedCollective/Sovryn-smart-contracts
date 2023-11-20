pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../swaps/connectors/SwapsImplSovrynSwapInternal.sol";
import "../events/ModulesCommonEvents.sol";

contract SwapsImplSovrynSwapModule is SwapsImplSovrynSwapInternal, ModulesCommonEvents {
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
        _setTarget(this.swapsImplInternalExpectedRate.selector, target);
        _setTarget(this.swapsImplInternalExpectedReturn.selector, target);
        emit ProtocolModuleContractReplaced(
            prevModuleContractAddress,
            target,
            "SwapsImplSovrynSwapModule"
        );
    }

    /**
     * @notice Get the expected rate for 1 source token when exchanging the
     *   given amount of source tokens.
     *
     * @param sourceTokenAddress The address of the source token contract.
     * @param destTokenAddress The address of the destination token contract.
     * @param sourceTokenAmount The amount of source tokens to get the rate for.
     * */
    function swapsImplInternalExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address sovrynSwapContractRegistryAddress
    ) external view returns (uint256) {
        return
            internalExpectedRate(
                sourceTokenAddress,
                destTokenAddress,
                sourceTokenAmount,
                sovrynSwapContractRegistryAddress
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
     * */
    function swapsImplInternalExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address sovrynSwapContractRegistry
    ) external view returns (uint256 expectedReturn) {
        return
            internalExpectedReturn(
                sourceTokenAddress,
                destTokenAddress,
                sourceTokenAmount,
                sovrynSwapContractRegistry
            );
    }
}
