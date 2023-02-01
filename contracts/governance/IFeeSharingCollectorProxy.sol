pragma solidity ^0.5.17;

/**
 * @title Interface for contract governance/FeeSharingCollectorProxy/FeeSharingCollectorProxy.sol
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * */
interface IFeeSharingCollectorProxy {
    function withdrawFees(address[] calldata _token) external;

    function transferTokens(address _token, uint96 _amount) external;

    function withdraw(
        address _loanPoolToken,
        uint32 _maxCheckpoints,
        address _receiver
    ) external;
}
