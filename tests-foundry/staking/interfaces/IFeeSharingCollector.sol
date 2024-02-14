pragma solidity ^0.8.17;

/**
 * @title Interface for contract governance/FeeSharingCollector/FeeSharingCollector.sol
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * */

import { IERC20 } from "./ITokens.sol";

interface IFeeSharingCollector {
    function withdrawFees(address[] calldata _token) external;

    function transferTokens(address _token, uint96 _amount) external;

    function withdraw(
        address _loanPoolToken,
        uint32 _maxCheckpoints,
        address _receiver
    ) external;
}

/**
 * @title Interface for contract governance/FeeSharingCollector/FeeSharingCollector.sol
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * */
interface IFeeSharingCollectorProxy {
    function setImplementation(address _feeSharingCollector) external;
}

interface IProtocol {
    /**
     *
     * @param tokens The array address of the token instance.
     * @param receiver The address of the withdrawal recipient.
     *
     * @return totalWRBTCWithdrawn The withdrawn total amount in wRBTC
     * */
    function withdrawFees(address[] calldata tokens, address receiver)
        external
        returns (uint256 totalWRBTCWithdrawn);

    function underlyingToLoanPool(address token) external view returns (address);

    function wrbtcToken() external view returns (IERC20);

    function getSovTokenAddress() external view returns (address);
}
