pragma solidity ^0.5.17;

import "../../../openzeppelin/Ownable.sol";
import "./FourYearVesting.sol";
import "./IFourYearVestingFactory.sol";

/**
 * @title Four Year Vesting Factory: Contract to deploy four year vesting contracts.
 * @notice Factory pattern allows to create multiple instances
 * of the same contract and keep track of them easier.
 * */
contract FourYearVestingFactory is IFourYearVestingFactory, Ownable {
    /// @dev Added an event to keep track of the vesting contract created for a token owner
    event FourYearVestingCreated(address indexed tokenOwner, address indexed vestingAddress);

    /**
     * @notice Deploys four year vesting contract.
     * @param _SOV the address of SOV token.
     * @param _staking The address of staking contract.
     * @param _tokenOwner The owner of the tokens.
     * @param _feeSharing The address of fee sharing contract.
     * @param _vestingOwnerMultisig The address of an owner of vesting contract.
     * @dev _vestingOwnerMultisig should ALWAYS be multisig.
     * @param _fourYearVestingLogic The implementation contract.
     * @param _extendDurationFor Duration till the unlocked tokens are extended.
     * @return The four year vesting contract address.
     * */
    function deployFourYearVesting(
        address _SOV,
        address _staking,
        address _tokenOwner,
        address _feeSharing,
        address _vestingOwnerMultisig,
        address _fourYearVestingLogic,
        uint256 _extendDurationFor
    ) external onlyOwner returns (address) {
        address fourYearVesting =
            address(
                new FourYearVesting(
                    _fourYearVestingLogic,
                    _SOV,
                    _staking,
                    _tokenOwner,
                    _feeSharing,
                    _extendDurationFor
                )
            );
        Ownable(fourYearVesting).transferOwnership(_vestingOwnerMultisig);
        emit FourYearVestingCreated(_tokenOwner, fourYearVesting);
        return fourYearVesting;
    }
}
