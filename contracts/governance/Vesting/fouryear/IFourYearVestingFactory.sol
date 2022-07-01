pragma solidity ^0.5.17;

/**
 * @title Interface for Four Year Vesting Factory contract.
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * This interface is used by FourYearVestingFactory contract to override empty
 * implemention of deployFourYearVesting function
 * and use an instance of FourYearVestingFactory.
 */
interface IFourYearVestingFactory {
    function deployFourYearVesting(
        address _SOV,
        address _staking,
        address _tokenOwner,
        address _feeSharing,
        address _vestingOwnerMultisig,
        address _fourYearVestingLogic,
        uint256 _extendDurationFor
    ) external returns (address);
}
