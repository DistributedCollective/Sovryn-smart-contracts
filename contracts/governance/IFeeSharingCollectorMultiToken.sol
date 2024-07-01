pragma solidity ^0.5.17;

/**
 * @title Interface for contract governance/FeeSharingCollector/FeeSharingCollector.sol
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * */
interface IFeeSharingCollectorMultiToken {
    function withdrawFees(address[] calldata _token) external;

    function transferTokens(address _token, uint96 _amount) external;

    function withdraw(address _token, uint32 _maxCheckpoint, address _receiver) external;

    function withdrawTokens(
        address[] calldata _tokens,
        uint32[] calldata _maxCheckpoints,
        address _receiver
    ) external;
}
